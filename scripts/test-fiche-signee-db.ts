/**
 * LA FICHE D'ENTRETIEN SIGNÉE SUR PLACE — sa demande du 17 novembre 2026 :
 * *« si le client est là, ils lui font signer ; s'il n'est pas là, ils ne lui
 * font pas signer. Il ne faut pas que ça soit obligatoire pour enregistrer la
 * fiche »*. Sa planche, puis « tu peux coder » le 18.
 *
 * Sur la base, sous le rôle de l'application :
 *
 *   A. sans signature, la fiche part comme avant, et rien ne parle de signature ;
 *   B. signée, la fiche garde le trait, le nom du client tel qu'il s'imprime
 *      (civilité comprise) et le jour, et la page du client les reçoit ;
 *   C. un cadre touché sans vraie signature (un tap) ne part pas, et le dit ;
 *   D. l'empreinte scelle la signature avec le contenu : deux fiches
 *      identiques, l'une signée, n'ont pas la même ;
 *   E. une fiche partie ne se re-signe pas.
 *
 * **Sait échouer** : sans le passage de `signature` à `figerPassage`, B et D
 * tombent ; sans `signatureAuDoigtValable`, C.
 *
 *   npx tsx scripts/test-fiche-signee-db.ts   (sur atlas_test)
 */
import assert from "node:assert/strict";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import { creerClient } from "../src/server/repositories/clients";
import {
  cocherLigne,
  figerPassage,
  lirePassage,
  lireRapportParJeton,
  nommerClient,
  ouvrirPassage,
} from "../src/server/repositories/passages-entretien";
import { nettoyerBase } from "./_test-db";
import { SIGNATURE_ESSAI } from "./_signature-essai";

let echecs = 0;
async function cas(nom: string, verifier: () => Promise<void>) {
  try {
    await verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${e instanceof Error ? e.message : e}`);
  }
}

const QUAND = new Date("2026-11-17T15:05:00Z");

/** Une fiche prête à partir : un client nommé, une prestation du modèle d'Atlas cochée. */
async function fichePrete(suffixe: string) {
  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise(
    { nom: `Perret ${suffixe}` },
    { email: `fiche-signee-${suffixe}-${Date.now()}@atlas.test` }
  );
  const ctx = { utilisateurId, entrepriseId: entreprise.id };
  const client = await creerClient(ctx, { nom: "Lefèvre", civilite: "mme" });
  const ouverte = await ouvrirPassage(ctx, "2026-11-17");
  assert.ok(ouverte.ok, "La fiche ne s'ouvre pas.");
  if (!ouverte.ok) throw new Error("fiche non ouverte");
  assert.equal((await nommerClient(ctx, ouverte.id, client.id)).ok, true);
  const premiere = (await lirePassage(ctx, ouverte.id))!.lignes[0];
  assert.ok(premiere, "Le modèle d'Atlas n'a pas été copié dans la fiche.");
  assert.equal((await cocherLigne(ctx, ouverte.id, premiere.id, true)).ok, true);
  return { ctx, id: ouverte.id };
}

async function main() {
  await nettoyerBase();
  console.log("La fiche d'entretien signée sur place\n");

  await cas("A. sans signature, la fiche part comme avant", async () => {
    const f = await fichePrete("sans");
    const r = await figerPassage(f.ctx, f.id, null, QUAND);
    assert.ok(r.ok, `La fiche sans signature ne part pas : ${JSON.stringify(r)}`);
    const p = await lirePassage(f.ctx, f.id);
    assert.equal(p!.signaturePng, null);
    assert.equal(p!.signeeLe, null);
    if (!r.ok) return;
    assert.equal((await lireRapportParJeton(r.jeton))!.signature, null, "La page du client parle d'une signature absente.");
  });

  await cas("B. signée : le trait, son nom avec sa civilité, le jour, jusque chez le client", async () => {
    const f = await fichePrete("signee");
    const r = await figerPassage(f.ctx, f.id, SIGNATURE_ESSAI, QUAND);
    assert.ok(r.ok, `La fiche signée ne part pas : ${JSON.stringify(r)}`);
    if (!r.ok) return;
    const rapport = await lireRapportParJeton(r.jeton);
    assert.deepEqual(rapport!.signature, { png: SIGNATURE_ESSAI.png, signataire: "Mme Lefèvre", jour: "2026-11-17" });
  });

  await cas("C. un tap n'est pas une signature : la fiche ne part pas, et le dit", async () => {
    const f = await fichePrete("tap");
    const r = await figerPassage(f.ctx, f.id, { png: SIGNATURE_ESSAI.png, points: 2 }, QUAND);
    assert.deepEqual(r, { ok: false, phrase: "Faites signer le client au doigt, ou effacez le cadre." });
    assert.equal((await lirePassage(f.ctx, f.id))!.envoyeLe, null, "La fiche est partie avec un faux trait.");
  });

  await cas("D. l'empreinte scelle la signature avec le contenu", async () => {
    const sans = await fichePrete("empreinte-sans");
    const avec = await fichePrete("empreinte-avec");
    const a = await figerPassage(sans.ctx, sans.id, null, QUAND);
    const b = await figerPassage(avec.ctx, avec.id, SIGNATURE_ESSAI, QUAND);
    assert.ok(a.ok && b.ok);
    if (!a.ok || !b.ok) return;
    assert.notEqual(a.empreinte, b.empreinte, "La signature n'entre pas dans la preuve.");
  });

  await cas("E. une fiche partie ne se re-signe pas", async () => {
    const f = await fichePrete("deux-fois");
    assert.ok((await figerPassage(f.ctx, f.id, null, QUAND)).ok);
    const encore = await figerPassage(f.ctx, f.id, SIGNATURE_ESSAI, QUAND);
    assert.equal(encore.ok, false, "Une fiche partie a reçu une signature après coup.");
    assert.equal((await lirePassage(f.ctx, f.id))!.signaturePng, null);
  });

  await pool.end();
  console.log(echecs ? `\n❌ ${echecs} échec(s)` : "\n✅ La fiche signée sur place tient.");
  process.exit(echecs ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
