// LE CODE DE VÉRIFICATION, EN BASE — ce que le dépôt écrit, efface, et refuse.
//
// Les règles sont éprouvées sans base dans `test-code-verification.ts` ; ici
// on vérifie que la ligne de `codes_verification_email` suit ces règles pour
// de bon : qu'elle naît à l'ouverture, qu'elle compte les essais, qu'elle
// disparaît sur le bon code en datant `users.email_verified`, et que la
// politique d'isolation la cache hors de son contexte.
//
// **Le code n'est jamais lu en clair** — il n'existe pas en base. La suite
// forge l'empreinte d'un code connu avec le même secret que le serveur, comme
// le fera la suite navigateur : c'est la seule façon honnête de « recevoir »
// l'e-mail sans service d'envoi.
import assert from "node:assert";
import { eq, sql } from "drizzle-orm";
import { db, pool } from "../src/server/db/client";
import { codesVerificationEmail, users } from "../src/server/db/schema";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import {
  ouvrirLaVerification,
  renvoyerLeCode,
  verificationEnAttente,
  verifierLeCode,
} from "../src/server/repositories/verification-email";
import { empreinteDuCode } from "../src/server/empreinte-du-code";
import { ESSAIS_MAX, VALIDITE_CODE_MS } from "../src/lib/code-verification";
import { getEnv } from "../src/server/env";
import { nettoyerBase } from "./_test-db";

let passed = 0;
let failed = 0;

async function test(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`✅ ${nom}`);
    passed++;
  } catch (err) {
    console.error(`❌ ${nom}`);
    console.error(`   ${err instanceof Error ? err.message : err}`);
    failed++;
  }
}

async function creerUtilisateur(email: string): Promise<string> {
  const { utilisateurId } = await entreprisesRepo.creerEntreprise({ nom: `Entreprise ${email}` }, { email });
  return utilisateurId;
}

/** Pose un code CONNU sur la ligne — ce que ferait la réception de l'e-mail. */
async function forgerLeCode(utilisateurId: string, code: string, extra: Partial<{ expireLe: Date; essais: number }> = {}) {
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.utilisateur_id', ${utilisateurId}, true)`);
    await tx
      .update(codesVerificationEmail)
      .set({ empreinte: empreinteDuCode(code, utilisateurId, getEnv().authSecret), ...extra })
      .where(eq(codesVerificationEmail.utilisateurId, utilisateurId));
  });
}

async function ligneDe(utilisateurId: string) {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.utilisateur_id', ${utilisateurId}, true)`);
    const [l] = await tx.select().from(codesVerificationEmail).where(eq(codesVerificationEmail.utilisateurId, utilisateurId));
    return l;
  });
}

async function main() {
  await nettoyerBase();
  console.log("=== Le code de vérification, en base ===\n");

  await test("un compte qui n'a pas ouvert de vérification n'attend rien", async () => {
    const id = await creerUtilisateur("ancien@exemple.fr");
    assert.strictEqual(await verificationEnAttente(id), false);
    // Et « vérifier » sans ligne ne refuse rien : il n'y a rien à vérifier.
    assert.deepStrictEqual(await verifierLeCode(id, "000000"), { ok: true });
  });

  await test("ouvrir la vérification pose une ligne, et le compte attend", async () => {
    const id = await creerUtilisateur("neuf@exemple.fr");
    const envoi = await ouvrirLaVerification(id, "neuf@exemple.fr");
    assert.strictEqual(envoi.ok, true, "en dev, l'envoi journalise et réussit");
    assert.strictEqual(await verificationEnAttente(id), true);
    const l = await ligneDe(id);
    assert.ok(l, "aucune ligne écrite");
    assert.strictEqual(l.essais, 0);
    assert.strictEqual(l.envois, 1);
    assert.notStrictEqual(l.empreinte.length, 6, "l'empreinte ne doit pas être le code");
    assert.ok(l.expireLe.getTime() - Date.now() <= VALIDITE_CODE_MS, "le code vit un quart d'heure au plus");
  });

  await test("le bon code efface la ligne et date email_verified", async () => {
    const id = await creerUtilisateur("juste@exemple.fr");
    await ouvrirLaVerification(id, "juste@exemple.fr");
    await forgerLeCode(id, "004213");
    assert.deepStrictEqual(await verifierLeCode(id, " 004 213 "), { ok: true });
    assert.strictEqual(await verificationEnAttente(id), false);
    const [u] = await db.select({ v: users.emailVerified }).from(users).where(eq(users.id, id));
    assert.ok(u.v instanceof Date, "email_verified n'est pas daté");
  });

  await test("un mauvais code compte un essai, et le cinquième tue le code", async () => {
    const id = await creerUtilisateur("devineur@exemple.fr");
    await ouvrirLaVerification(id, "devineur@exemple.fr");
    await forgerLeCode(id, "004213");
    for (let i = 1; i < ESSAIS_MAX; i += 1) {
      const v = await verifierLeCode(id, "000000");
      assert.strictEqual(v.ok, false);
      assert.strictEqual((await ligneDe(id)).essais, i, `l'essai ${i} n'a pas été compté`);
    }
    const dernier = await verifierLeCode(id, "000000");
    assert.strictEqual(dernier.ok, false);
    if (!dernier.ok) assert.strictEqual(dernier.codeMort, true);
    // Le bon code, trop tard : la ligne reste, le compte attend toujours.
    const tard = await verifierLeCode(id, "004213");
    assert.strictEqual(tard.ok, false, "un code mort ne se rouvre pas avec la bonne réponse");
    assert.strictEqual(await verificationEnAttente(id), true);
  });

  await test("un code expiré est refusé, même juste", async () => {
    const id = await creerUtilisateur("lent@exemple.fr");
    await ouvrirLaVerification(id, "lent@exemple.fr");
    await forgerLeCode(id, "004213", { expireLe: new Date(Date.now() - 1000) });
    const v = await verifierLeCode(id, "004213");
    assert.strictEqual(v.ok, false);
    if (!v.ok) assert.strictEqual(v.codeMort, true);
  });

  await test("« Renvoyer » remplace le code, remet les essais à zéro, et se borne", async () => {
    const id = await creerUtilisateur("renvoi@exemple.fr");
    await ouvrirLaVerification(id, "renvoi@exemple.fr");
    await forgerLeCode(id, "004213", { essais: 3 });
    const avant = await ligneDe(id);

    // Trop tôt : trente secondes n'ont pas passé depuis l'ouverture.
    const tropTot = await renvoyerLeCode(id, "renvoi@exemple.fr");
    assert.strictEqual(tropTot.ok, false);

    // On vieillit le dernier envoi, comme si trente secondes avaient passé.
    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT set_config('app.utilisateur_id', ${id}, true)`);
      await tx
        .update(codesVerificationEmail)
        .set({ dernierEnvoi: new Date(Date.now() - 60_000) })
        .where(eq(codesVerificationEmail.utilisateurId, id));
    });
    const ok = await renvoyerLeCode(id, "renvoi@exemple.fr");
    assert.strictEqual(ok.ok, true);
    const apres = await ligneDe(id);
    assert.notStrictEqual(apres.empreinte, avant.empreinte, "le code n'a pas changé");
    assert.strictEqual(apres.essais, 0, "les essais ne sont pas repartis de zéro");
    assert.strictEqual(apres.envois, 2);
    // L'ancien code est mort avec le renvoi.
    const ancien = await verifierLeCode(id, "004213");
    assert.strictEqual(ancien.ok, false);
  });

  await test("« Renvoyer » sur un compte qui n'attend rien est refusé", async () => {
    const id = await creerUtilisateur("rien@exemple.fr");
    const v = await renvoyerLeCode(id, "rien@exemple.fr");
    assert.strictEqual(v.ok, false);
  });

  await test("hors de son contexte, la ligne est invisible (RLS)", async () => {
    const id = await creerUtilisateur("isole@exemple.fr");
    await ouvrirLaVerification(id, "isole@exemple.fr");
    const fuite = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT set_config('app.utilisateur_id', '', true)`);
      return tx.execute(sql`SELECT count(*)::int AS n FROM codes_verification_email`);
    });
    const lignes = (fuite as unknown as { rows: { n: number }[] }).rows;
    assert.strictEqual(lignes[0].n, 0, "des codes sont lisibles hors contexte");
    // Et sous un AUTRE utilisateur non plus.
    const autre = await creerUtilisateur("voisin@exemple.fr");
    assert.strictEqual(await verificationEnAttente(autre), false);
  });

  console.log(`\n${passed} réussis, ${failed} échoués`);
  await pool.end();
  if (failed > 0) process.exit(1);
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
