// MOT DE PASSE OUBLIÉ, EN BASE — sous `atlas_app`, le rôle de la production.
//
// Ce qui est éprouvé ici, c'est le chemin du patron sans l'écran : l'adresse,
// le code reçu, le nouveau mot de passe, puis la connexion avec lui. Et
// surtout les refus : un jeton faux, périmé ou déjà servi ne change RIEN, et
// une adresse sans compte ne laisse aucune trace.
//
// Le code n'existe pas en clair en base : la suite forge l'empreinte d'un code
// connu avec le même secret que le serveur (comme `test-verification-email-db`).
import assert from "node:assert";
import { eq, sql } from "drizzle-orm";
import { Pool } from "pg";
import { hash } from "bcryptjs";
import { db, pool } from "../src/server/db/client";
import { codesMotDePasse, codesVerificationEmail, users } from "../src/server/db/schema";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import {
  envoyerUnCode,
  poserLeNouveauMotDePasse,
  verifierLeCodeOublie,
} from "../src/server/repositories/mot-de-passe-oublie";
import { identifiantSiMotDePasseJuste, poserCondensatSurJeton } from "../src/server/secret-authentification";
import { empreinteDuCode, empreinteDuJeton } from "../src/server/empreinte-du-code";
import { ESSAIS_MAX } from "../src/lib/code-verification";
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

/** Le propriétaire pose le décor : `atlas_app` n'a pas le droit d'écrire un condensat. */
const proprio = new Pool({
  connectionString:
    process.env.DATABASE_ADMIN_URL ?? "postgresql://atlas_owner:atlas_owner_ci_pw@localhost:5432/atlas_test",
});

const ANCIEN = "ancien mot de passe";
const NOUVEAU = "trois mots courts";

async function creerCompte(email: string): Promise<string> {
  const { utilisateurId } = await entreprisesRepo.creerEntreprise({ nom: `Entreprise ${email}` }, { email });
  await proprio.query("UPDATE users SET password_hash = $1 WHERE id = $2", [await hash(ANCIEN, 10), utilisateurId]);
  return utilisateurId;
}

async function ligneDe(utilisateurId: string) {
  const [ligne] = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.utilisateur_id', ${utilisateurId}, true)`);
    return tx.select().from(codesMotDePasse).where(eq(codesMotDePasse.utilisateurId, utilisateurId)).limit(1);
  });
  return ligne;
}

async function forger(utilisateurId: string, valeurs: Partial<typeof codesMotDePasse.$inferInsert>) {
  await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT set_config('app.utilisateur_id', ${utilisateurId}, true)`);
    await tx.update(codesMotDePasse).set(valeurs).where(eq(codesMotDePasse.utilisateurId, utilisateurId));
  });
}

/** Un code demandé puis « reçu » : le seul moyen d'avoir le code, puisqu'il n'est pas en base. */
async function codeRecu(utilisateurId: string, email: string, code = "482913"): Promise<string> {
  const envoi = await envoyerUnCode(email);
  assert.deepStrictEqual(envoi, { ok: true });
  await forger(utilisateurId, { empreinte: empreinteDuCode(code, utilisateurId, getEnv().authSecret) });
  return code;
}

async function jetonObtenu(utilisateurId: string, email: string): Promise<string> {
  const code = await codeRecu(utilisateurId, email);
  const verdict = await verifierLeCodeOublie(email, code);
  assert.ok(verdict.ok, "le bon code doit donner un jeton");
  return verdict.jeton;
}

async function main() {
  console.log("=== Mot de passe oublié, en base ===\n");
  await nettoyerBase();

  await test("une adresse sans compte : même réponse, et aucune ligne nulle part", async () => {
    const r = await envoyerUnCode("personne@exemple.fr");
    assert.deepStrictEqual(r, { ok: true });
    const { rows } = await proprio.query("SELECT count(*)::int AS n FROM codes_mot_de_passe");
    assert.strictEqual(rows[0].n, 0);
  });

  await test("une adresse connue : une ligne naît, et le compte n'est PAS mis en attente de vérification", async () => {
    const id = await creerCompte("anne@exemple.fr");
    await envoyerUnCode("  Anne@Exemple.fr ");
    const ligne = await ligneDe(id);
    assert.ok(ligne, "la ligne du code existe");
    assert.strictEqual(ligne.envois, 1);
    assert.strictEqual(ligne.jetonEmpreinte, null);
    const attente = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT set_config('app.utilisateur_id', ${id}, true)`);
      return tx.select().from(codesVerificationEmail).where(eq(codesVerificationEmail.utilisateurId, id));
    });
    assert.strictEqual(attente.length, 0, "une ligne ici enfermerait le compte derrière /verifier-email");
  });

  await test("hors de son contexte, la ligne est invisible (RLS)", async () => {
    const id = await creerCompte("rls@exemple.fr");
    await envoyerUnCode("rls@exemple.fr");
    const autre = await creerCompte("autre-rls@exemple.fr");
    const vue = await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT set_config('app.utilisateur_id', ${autre}, true)`);
      return tx.select().from(codesMotDePasse).where(eq(codesMotDePasse.utilisateurId, id));
    });
    assert.strictEqual(vue.length, 0);
  });

  await test("« Renvoyer » deux fois dans la même seconde : le second est refusé", async () => {
    await creerCompte("double@exemple.fr");
    assert.deepStrictEqual(await envoyerUnCode("double@exemple.fr"), { ok: true });
    const second = await envoyerUnCode("double@exemple.fr");
    assert.strictEqual(second.ok, false);
  });

  await test("un mauvais code compte un essai et ne donne rien", async () => {
    const id = await creerCompte("faux@exemple.fr");
    await codeRecu(id, "faux@exemple.fr", "111111");
    const r = await verifierLeCodeOublie("faux@exemple.fr", "222222");
    assert.deepStrictEqual(r, { ok: false, refus: "Code incorrect.", codeMort: false });
    assert.strictEqual((await ligneDe(id))?.essais, 1);
    assert.strictEqual((await ligneDe(id))?.jetonEmpreinte, null);
  });

  await test("une adresse sans compte, ou sans code demandé : la même phrase qu'un mauvais code", async () => {
    await creerCompte("sans-code@exemple.fr");
    for (const email of ["inconnu@exemple.fr", "sans-code@exemple.fr"]) {
      const r = await verifierLeCodeOublie(email, "123456");
      assert.deepStrictEqual(r, { ok: false, refus: "Code incorrect.", codeMort: false });
    }
  });

  await test("le bon code donne un jeton, et meurt : retapé, il ne donne plus rien", async () => {
    const id = await creerCompte("bon@exemple.fr");
    const code = await codeRecu(id, "bon@exemple.fr");
    const r = await verifierLeCodeOublie("bon@exemple.fr", code);
    assert.ok(r.ok && r.jeton.length >= 40);
    const ligne = await ligneDe(id);
    assert.strictEqual(ligne?.essais, ESSAIS_MAX);
    assert.strictEqual(ligne?.jetonEmpreinte, empreinteDuJeton(r.jeton), "la base ne garde que l'empreinte");
    const encore = await verifierLeCodeOublie("bon@exemple.fr", code);
    assert.strictEqual(encore.ok, false);
  });

  await test("un jeton FAUX ne change pas le mot de passe", async () => {
    const id = await creerCompte("jeton-faux@exemple.fr");
    await jetonObtenu(id, "jeton-faux@exemple.fr");
    const r = await poserLeNouveauMotDePasse("jeton-faux@exemple.fr", "pas-le-bon-jeton", NOUVEAU, NOUVEAU);
    assert.deepStrictEqual(r, { ok: false, refus: "jeton-mort" });
    assert.strictEqual(await identifiantSiMotDePasseJuste("jeton-faux@exemple.fr", ANCIEN), id);
    assert.strictEqual(await identifiantSiMotDePasseJuste("jeton-faux@exemple.fr", NOUVEAU), null);
  });

  await test("un jeton PÉRIMÉ ne change pas le mot de passe", async () => {
    const id = await creerCompte("perime@exemple.fr");
    const jeton = await jetonObtenu(id, "perime@exemple.fr");
    await forger(id, { jetonExpireLe: new Date(Date.now() - 1000) });
    const r = await poserLeNouveauMotDePasse("perime@exemple.fr", jeton, NOUVEAU, NOUVEAU);
    assert.deepStrictEqual(r, { ok: false, refus: "jeton-mort" });
    assert.strictEqual(await identifiantSiMotDePasseJuste("perime@exemple.fr", ANCIEN), id);
  });

  await test("le jeton d'un compte ne sert pas sur un autre", async () => {
    const a = await creerCompte("a@exemple.fr");
    const b = await creerCompte("b@exemple.fr");
    const jetonDeA = await jetonObtenu(a, "a@exemple.fr");
    await jetonObtenu(b, "b@exemple.fr");
    const r = await poserLeNouveauMotDePasse("b@exemple.fr", jetonDeA, NOUVEAU, NOUVEAU);
    assert.deepStrictEqual(r, { ok: false, refus: "jeton-mort" });
    assert.strictEqual(await identifiantSiMotDePasseJuste("b@exemple.fr", ANCIEN), b);
  });

  await test("un mot de passe trop court est refusé, et le jeton reste bon", async () => {
    const id = await creerCompte("court@exemple.fr");
    const jeton = await jetonObtenu(id, "court@exemple.fr");
    assert.deepStrictEqual(await poserLeNouveauMotDePasse("court@exemple.fr", jeton, "court", "court"), {
      ok: false,
      refus: "trop-court",
    });
    assert.ok((await ligneDe(id))?.jetonEmpreinte, "le jeton n'a pas été consommé");
  });

  await test("le bon jeton : le nouveau mot de passe ouvre, l'ancien non, et tout le reste est fermé", async () => {
    const id = await creerCompte("change@exemple.fr");
    const jeton = await jetonObtenu(id, "change@exemple.fr");
    const avant = Date.now();
    const r = await poserLeNouveauMotDePasse("change@exemple.fr", jeton, NOUVEAU, NOUVEAU);
    assert.deepStrictEqual(r, { ok: true });
    assert.strictEqual(await identifiantSiMotDePasseJuste("change@exemple.fr", NOUVEAU), id);
    assert.strictEqual(await identifiantSiMotDePasseJuste("change@exemple.fr", ANCIEN), null);
    assert.strictEqual(await ligneDe(id), undefined, "la ligne est consommée");

    const [u] = await db.select({ depuis: users.jetonsValidesDepuis }).from(users).where(eq(users.id, id));
    assert.ok(u?.depuis, "les sessions ouvertes avant sont coupées");
    // Arrondie vers le BAS : une session ouverte dans la seconde qui suit survit.
    assert.strictEqual(u.depuis.getTime() % 1000, 0);
    assert.ok(u.depuis.getTime() <= Date.now() && u.depuis.getTime() >= Math.floor(avant / 1000) * 1000);

    const rejoue = await poserLeNouveauMotDePasse("change@exemple.fr", jeton, "encore un autre mot", "encore un autre mot");
    assert.deepStrictEqual(rejoue, { ok: false, refus: "jeton-mort" }, "un jeton ne sert qu'une fois");
  });

  await test("la fonction en base refuse une empreinte inventée, même sous atlas_app", async () => {
    const id = await creerCompte("direct@exemple.fr");
    await jetonObtenu(id, "direct@exemple.fr");
    const ok = await poserCondensatSurJeton(id, "0".repeat(64), await hash(NOUVEAU, 10));
    assert.strictEqual(ok, false);
    assert.strictEqual(await identifiantSiMotDePasseJuste("direct@exemple.fr", ANCIEN), id);
  });

  await test("atlas_app n'écrit toujours pas password_hash lui-même", async () => {
    const id = await creerCompte("droits@exemple.fr");
    await assert.rejects(
      db.execute(sql`UPDATE users SET password_hash = 'x' WHERE id = ${id}`),
      (e: unknown) => (e as { cause?: { code?: string }; code?: string }).cause?.code === "42501" || (e as { code?: string }).code === "42501"
    );
  });

  console.log(`\n${passed} réussi(s), ${failed} échoué(s)`);
  await proprio.end();
  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error(err);
  await proprio.end();
  await pool.end();
  process.exit(1);
});
