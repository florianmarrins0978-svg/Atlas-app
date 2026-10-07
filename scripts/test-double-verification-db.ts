// La double vérification, en base, sous `atlas_app` : la RLS est donc jouée.
//
// **Ce que cette suite tient.** Que la porte ne se ferme qu'après un premier
// code juste ; qu'un code ne serve qu'une fois ; qu'une connexion en attente
// meure au cinquième essai ; qu'un jeton forgé au nom d'un autre n'ouvre rien ;
// et qu'aucune de ces lignes ne se lise hors de la personne qui les porte.
import assert from "node:assert";
import { eq, sql } from "drizzle-orm";
import { db, pool } from "../src/server/db/client";
import { appareilsRetenus, doubleVerification } from "../src/server/db/schema";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import {
  appareilRetenu,
  codeExige,
  commencerActivation,
  confirmerActivation,
  consommerConnexionEnAttente,
  desactiver,
  etatDoubleVerification,
  oublierAppareils,
  ouvrirConnexionEnAttente,
  retenirAppareil,
} from "../src/server/repositories/double-verification";
import { fermerToutesLesSessions } from "../src/server/repositories/compte";
import { chiffrer, dechiffrer } from "../src/server/agenda/secret-au-repos";
import { ESSAIS_MAX_CODE, base32Decode, codeTotp, pasDeTemps } from "../src/lib/double-verification";
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

async function creerCompte(email: string): Promise<string> {
  const { utilisateurId } = await entreprisesRepo.creerEntreprise({ nom: `Entreprise ${email}` }, { email });
  return utilisateurId;
}

/**
 * Le code que l'appli afficherait, décalé de `tranches` : un code ne sert
 * qu'une fois, donc chaque étape d'une même suite prend la tranche suivante,
 * comme le ferait un artisan trente secondes plus tard.
 */
function codeDuTelephone(secretBase32: string, tranches = 0): string {
  return codeTotp(base32Decode(secretBase32)!, pasDeTemps(Date.now()) + tranches);
}

async function activer(utilisateurId: string, email: string) {
  const debut = await commencerActivation(utilisateurId, email);
  assert.ok(debut.ok);
  const fin = await confirmerActivation(utilisateurId, codeDuTelephone(debut.secretBase32, -1));
  assert.ok(fin.ok, "l'activation n'aboutit pas");
  return { secret: debut.secretBase32, codes: fin.codesSecours };
}

async function lignesVuesPar(contexte: string | null, table: typeof doubleVerification | typeof appareilsRetenus) {
  return db.transaction(async (tx) => {
    if (contexte) await tx.execute(sql`SELECT set_config('app.utilisateur_id', ${contexte}, true)`);
    return tx.select().from(table);
  });
}

async function main() {
  await nettoyerBase();

  await test("un compte neuf n'a rien à donner", async () => {
    const id = await creerCompte("neuf@exemple.fr");
    assert.deepStrictEqual(await etatDoubleVerification(id), { active: false, codesRestants: 0 });
    assert.strictEqual(await codeExige(id, undefined), false);
  });

  // Un secret affiché mais jamais confirmé ne ferme rien : sinon un artisan qui
  // abandonne à l'étape 1 serait enfermé dehors à sa prochaine connexion.
  await test("l'étape 1 seule ne ferme pas la porte", async () => {
    const id = await creerCompte("etape1@exemple.fr");
    const debut = await commencerActivation(id, "etape1@exemple.fr");
    assert.ok(debut.ok);
    assert.match(debut.uri, /^otpauth:\/\/totp\//);
    assert.strictEqual(await codeExige(id, undefined), false);
  });

  await test("un faux code ne confirme pas l'activation", async () => {
    const id = await creerCompte("faux@exemple.fr");
    await commencerActivation(id, "faux@exemple.fr");
    assert.deepStrictEqual(await confirmerActivation(id, "000000"), { ok: false, refus: "code-faux" });
    assert.strictEqual((await etatDoubleVerification(id)).active, false);
  });

  await test("le bon code active, et donne dix codes de secours", async () => {
    const id = await creerCompte("active@exemple.fr");
    const { codes } = await activer(id, "active@exemple.fr");
    assert.strictEqual(codes.length, 10);
    assert.strictEqual(new Set(codes).size, 10);
    assert.deepStrictEqual(await etatDoubleVerification(id), { active: true, codesRestants: 10 });
    assert.strictEqual(await codeExige(id, undefined), true);
    assert.deepStrictEqual(await commencerActivation(id, "active@exemple.fr"), { ok: false, refus: "deja-active" });
  });

  await test("le secret n'est jamais en clair en base", async () => {
    const id = await creerCompte("clair@exemple.fr");
    const { secret } = await activer(id, "clair@exemple.fr");
    const [ligne] = await lignesVuesPar(id, doubleVerification);
    const stocke = (ligne as { secretChiffre: string }).secretChiffre;
    assert.ok(!stocke.includes(secret), "le secret est lisible tel quel");
    assert.strictEqual(dechiffrer(stocke, "agenda"), null, "la clé de l'agenda le relit");
    assert.strictEqual(dechiffrer(stocke, "double-verification"), secret);
  });

  await test("l'agenda garde sa clé à l'octet près", async () => {
    assert.strictEqual(dechiffrer(chiffrer("jeton google")), "jeton google");
    assert.strictEqual(dechiffrer(chiffrer("jeton google"), "double-verification"), null);
  });

  console.log("");

  await test("la connexion en attente aboutit avec le bon code, une seule fois", async () => {
    const id = await creerCompte("attente@exemple.fr");
    const { secret } = await activer(id, "attente@exemple.fr");
    const jeton = await ouvrirConnexionEnAttente(id);
    assert.deepStrictEqual(await consommerConnexionEnAttente(jeton, codeDuTelephone(secret, 0)), {
      ok: true,
      utilisateurId: id,
    });
    assert.deepStrictEqual(await consommerConnexionEnAttente(jeton, codeDuTelephone(secret, 1)), {
      ok: false,
      refus: "expiree",
    });
  });

  // Lu par-dessus l'épaule, un code est mort : il a déjà servi.
  await test("un code déjà servi ne rouvre pas une seconde connexion", async () => {
    const id = await creerCompte("rejeu@exemple.fr");
    const { secret } = await activer(id, "rejeu@exemple.fr");
    const code = codeDuTelephone(secret, 0);
    assert.ok((await consommerConnexionEnAttente(await ouvrirConnexionEnAttente(id), code)).ok);
    const r = await consommerConnexionEnAttente(await ouvrirConnexionEnAttente(id), code);
    assert.strictEqual(r.ok, false);
  });

  await test(`au ${ESSAIS_MAX_CODE}ᵉ faux code, même le bon n'ouvre plus`, async () => {
    const id = await creerCompte("essais@exemple.fr");
    const { secret } = await activer(id, "essais@exemple.fr");
    const jeton = await ouvrirConnexionEnAttente(id);
    for (let i = 0; i < ESSAIS_MAX_CODE; i++) {
      const r = await consommerConnexionEnAttente(jeton, "000000");
      assert.strictEqual(r.ok, false);
    }
    assert.deepStrictEqual(await consommerConnexionEnAttente(jeton, codeDuTelephone(secret, 0)), {
      ok: false,
      refus: "expiree",
    });
  });

  await test("un jeton forgé au nom d'un autre n'ouvre rien", async () => {
    const a = await creerCompte("a@exemple.fr");
    const b = await creerCompte("b@exemple.fr");
    const { secret } = await activer(a, "a@exemple.fr");
    const jetonDeA = await ouvrirConnexionEnAttente(a);
    const forge = `${b}${jetonDeA.slice(jetonDeA.indexOf("."))}`;
    const r = await consommerConnexionEnAttente(forge, codeDuTelephone(secret, 0));
    assert.deepStrictEqual(r, { ok: false, refus: "expiree" });
    assert.deepStrictEqual(await consommerConnexionEnAttente("n'importe quoi", "123456"), { ok: false, refus: "expiree" });
  });

  await test("un code de secours ouvre une fois, et se décompte", async () => {
    const id = await creerCompte("secours@exemple.fr");
    const { codes } = await activer(id, "secours@exemple.fr");
    // Il le recopie de son papier, en minuscules et sans tiret.
    const tape = codes[3].toLowerCase().replace("-", " ");
    assert.ok((await consommerConnexionEnAttente(await ouvrirConnexionEnAttente(id), tape)).ok);
    assert.strictEqual((await consommerConnexionEnAttente(await ouvrirConnexionEnAttente(id), codes[3])).ok, false);
    assert.strictEqual((await etatDoubleVerification(id)).codesRestants, 9);
  });

  console.log("");

  await test("un appareil retenu entre sans code, trente jours, et pour son seul compte", async () => {
    const a = await creerCompte("retenu-a@exemple.fr");
    const b = await creerCompte("retenu-b@exemple.fr");
    await activer(a, "retenu-a@exemple.fr");
    await activer(b, "retenu-b@exemple.fr");
    const { jeton, expireLe } = await retenirAppareil(a);
    const jours = (expireLe.getTime() - Date.now()) / 86_400_000;
    assert.ok(jours > 29.9 && jours <= 30, `${jours} jours`);
    assert.strictEqual(await codeExige(a, jeton), false);
    assert.strictEqual(await codeExige(b, jeton), true, "le jeton de A ouvre chez B");
    assert.strictEqual(await appareilRetenu(a, `${a}.autre-chose-de-long-assez-pour-passer`), false);
  });

  await test("un appareil dont les trente jours sont passés redemande le code", async () => {
    const id = await creerCompte("expire@exemple.fr");
    await activer(id, "expire@exemple.fr");
    const { jeton } = await retenirAppareil(id);
    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT set_config('app.utilisateur_id', ${id}, true)`);
      await tx
        .update(appareilsRetenus)
        .set({ expireLe: new Date(Date.now() - 1000) })
        .where(eq(appareilsRetenus.utilisateurId, id));
    });
    assert.strictEqual(await codeExige(id, jeton), true);
  });

  await test("« me déconnecter partout » oublie les appareils retenus", async () => {
    const id = await creerCompte("partout@exemple.fr");
    await activer(id, "partout@exemple.fr");
    const { jeton } = await retenirAppareil(id);
    await fermerToutesLesSessions(id, new Date());
    assert.strictEqual(await codeExige(id, jeton), true);
    const autre = await retenirAppareil(id);
    await oublierAppareils(id);
    assert.strictEqual(await codeExige(id, autre.jeton), true);
  });

  console.log("");

  await test("désactiver demande un code juste, puis tout part", async () => {
    const id = await creerCompte("desactiver@exemple.fr");
    const { secret } = await activer(id, "desactiver@exemple.fr");
    const { jeton } = await retenirAppareil(id);
    assert.deepStrictEqual(await desactiver(id, "000000"), { ok: false });
    assert.strictEqual((await etatDoubleVerification(id)).active, true);
    assert.deepStrictEqual(await desactiver(id, codeDuTelephone(secret, 0)), { ok: true });
    assert.deepStrictEqual(await etatDoubleVerification(id), { active: false, codesRestants: 0 });
    assert.strictEqual(await appareilRetenu(id, jeton), false);
    assert.strictEqual(await codeExige(id, undefined), false);
  });

  // La RLS : sans contexte, ou dans le contexte d'un autre, rien ne se lit.
  await test("personne d'autre ne lit ces lignes, et sans contexte personne", async () => {
    const a = await creerCompte("rls-a@exemple.fr");
    const b = await creerCompte("rls-b@exemple.fr");
    await activer(a, "rls-a@exemple.fr");
    await retenirAppareil(a);
    assert.strictEqual((await lignesVuesPar(a, doubleVerification)).length, 1);
    assert.strictEqual((await lignesVuesPar(b, doubleVerification)).length, 0);
    assert.strictEqual((await lignesVuesPar(null, doubleVerification)).length, 0);
    assert.strictEqual((await lignesVuesPar(b, appareilsRetenus)).length, 0);
    assert.strictEqual((await lignesVuesPar(null, appareilsRetenus)).length, 0);
  });

  console.log(`\n${passed} réussi(s), ${failed} échoué(s)`);
  await pool.end();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
