/**
 * ACCEPTER SON DEVIS, C'EST LE SIGNER — sa planche du 17 novembre 2026
 * (`appli/soignee/devis-signe-par-le-client.html`), codée sur son « les deux me
 * vont, tu peux coder » du 18.
 *
 * Ce que cette suite garde, sur la base, sous le rôle de l'application (la RLS
 * s'applique, et le lien du client n'a aucune session) :
 *
 *   A. accepter sans signature est refusé, et rien n'est écrit ni posé ;
 *   B. un tap, ou une image qui n'est pas un PNG, ne valent pas signature ;
 *   C. signé, l'accord passe et le trait est gardé avec lui ;
 *   D. un refus et une correction ne demandent rien, et ne gardent rien ;
 *   E. le lien sert alors le devis SIGNÉ, rangé une seule fois, à côté de
 *      celui de l'envoi qui ne change pas ;
 *   F. l'écran du patron ouvre le même exemplaire signé ;
 *   G. l'accord défait garde la signature dans sa preuve, et le lien revient
 *      au devis de l'envoi.
 *
 * **Sait échouer** : sans la règle de `enregistrerReponse`, A et B tombent ;
 * sans `cleDuDevisSigne`, E et F.
 *
 *   npx tsx scripts/test-devis-signe-db.ts   (sur atlas_test)
 */
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { pool } from "../src/server/db/client";
import { withEntreprise } from "../src/server/db/with-entreprise";
import { acceptationsDefaites, devis as tableDevis, envoisDevis } from "../src/server/db/schema";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as clientsRepo from "../src/server/repositories/clients";
import * as devisRepo from "../src/server/repositories/devis";
import * as prixRepo from "../src/server/repositories/lignes-prix";
import {
  cleSigneeDuDevis,
  creerEnvoi,
  deposerLeDevisSigne,
  enregistrerReponse,
  pdfDevisParJeton,
} from "../src/server/repositories/envois-devis";
import { defaireLAcceptation } from "../src/server/repositories/acceptation-defaite";
import { versJourIso, ajouterJours } from "../src/lib/disponibilites";
import { nettoyerBase } from "./_test-db";
import { SIGNATURE_ESSAI } from "./_signature-essai";

let reussis = 0;
let echoues = 0;
async function test(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`✅ ${nom}`);
    reussis++;
  } catch (err) {
    console.error(`❌ ${nom}`);
    console.error(`   ${err instanceof Error ? err.message : err}`);
    echoues++;
  }
}

const MARDI = new Date("2026-03-03T09:00:00Z");
const PROPOSEE = versJourIso(ajouterJours(MARDI, 21));

type Ctx = { utilisateurId: string; entrepriseId: string };

async function contexte(email: string): Promise<Ctx> {
  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise({ nom: "Perret Paysage" }, { email });
  return { utilisateurId, entrepriseId: entreprise.id };
}

/** Un devis réellement parti, son lien prêt à être ouvert par la cliente. */
async function devisParti(ctx: Ctx, nom: string) {
  const client = await clientsRepo.creerClient(ctx, { nom: "Lefèvre", civilite: "mme", email: "lefevre@test.local" });
  await clientsRepo.mettreAJourClient(ctx, client.id, { canalCommunication: "email" });
  const chantier = await chantiersRepo.creerChantier(ctx, { nom, clientId: client.id });
  await prixRepo.ajouterLignePrix(ctx, chantier.id, "Taille de la haie de charmes", "540.00");
  const d = await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);
  await devisRepo.envoyerDevis(ctx, d.id);
  const envoi = await creerEnvoi(
    ctx,
    { chantierId: chantier.id, devisId: d.id, canal: "email", datesProposees: [PROPOSEE], contenuDevis: nom },
    MARDI
  );
  return { chantierId: chantier.id, devisId: d.id, jeton: envoi.jeton, envoiId: envoi.id };
}

const accepter = (jeton: string, signature: { png: unknown; points: unknown } | null) =>
  enregistrerReponse(jeton, { decision: "accepte", dateRetenue: PROPOSEE, signature }, MARDI);

async function lireEnvoi(ctx: Ctx, envoiId: string) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [e] = await tx.select().from(envoisDevis).where(eq(envoisDevis.id, envoiId)).limit(1);
    return e;
  });
}

async function cleDeLEnvoi(ctx: Ctx, devisId: string) {
  return withEntreprise(ctx.utilisateurId, ctx.entrepriseId, async (tx) => {
    const [d] = await tx.select({ cle: tableDevis.pdfStorageKey }).from(tableDevis).where(eq(tableDevis.id, devisId));
    return d.cle;
  });
}

async function main() {
  await nettoyerBase();

  await test("A. accepter sans signature est refusé, et rien n'est écrit ni posé", async () => {
    const ctx = await contexte(`sans-${Date.now()}@t.test`);
    const c = await devisParti(ctx, "Haie");
    for (const signature of [null, { png: "", points: 0 }]) {
      const r = await accepter(c.jeton, signature);
      assert.deepEqual(r, { succes: false, motif: "signature_manquante" }, `Accord sans trait : ${JSON.stringify(r)}`);
    }
    const e = await lireEnvoi(ctx, c.envoiId);
    assert.equal(e.reponse, null, "L'envoi est noté accepté sans signature.");
    assert.equal(e.signaturePng, null);
    assert.equal((await chantiersRepo.getChantier(ctx, c.chantierId))?.datePlanifiee ?? null, null, "Le chantier a été posé.");
  });

  await test("B. un tap, ou une image qui n'est pas un PNG, ne valent pas signature", async () => {
    const ctx = await contexte(`faux-${Date.now()}@t.test`);
    const c = await devisParti(ctx, "Massif");
    for (const signature of [
      { png: SIGNATURE_ESSAI.png, points: 3 },
      { png: "data:image/png;base64,PHN2Zz48L3N2Zz4=", points: 60 },
      { png: `data:image/png;base64,iVBORw0KGgo${"A".repeat(600_000)}`, points: 60 },
    ]) {
      const r = await accepter(c.jeton, signature);
      assert.equal(r.succes, false, `Passé pour une signature : ${String(signature.png).slice(0, 40)}…, ${signature.points} points`);
    }
    assert.equal((await lireEnvoi(ctx, c.envoiId)).reponse, null);
  });

  await test("C. signé, l'accord passe et le trait est gardé avec lui", async () => {
    const ctx = await contexte(`signe-${Date.now()}@t.test`);
    const c = await devisParti(ctx, "Pelouse");
    const r = await accepter(c.jeton, SIGNATURE_ESSAI);
    assert.equal(r.succes, true, `L'accord signé est refusé : ${JSON.stringify(r)}`);
    const e = await lireEnvoi(ctx, c.envoiId);
    assert.equal(e.reponse, "acceptee");
    assert.equal(e.signaturePng, SIGNATURE_ESSAI.png, "Le trait du client n'est pas gardé avec son accord.");
  });

  await test("D. un refus et une correction ne demandent rien, et ne gardent rien", async () => {
    const ctx = await contexte(`refus-${Date.now()}@t.test`);
    const refus = await devisParti(ctx, "Élagage");
    assert.equal((await enregistrerReponse(refus.jeton, { decision: "refuse", signature: SIGNATURE_ESSAI }, MARDI)).succes, true);
    assert.equal((await lireEnvoi(ctx, refus.envoiId)).signaturePng, null, "Un refus garde une signature.");
    const correction = await devisParti(ctx, "Clôture");
    const r = await enregistrerReponse(correction.jeton, { decision: "correction", precision: "La haie fait 30 m." }, MARDI);
    assert.equal(r.succes, true, `Une correction demande une signature : ${JSON.stringify(r)}`);
  });

  await test("E. le lien sert le devis signé, rangé une seule fois, et celui de l'envoi ne change pas", async () => {
    const ctx = await contexte(`pdf-${Date.now()}@t.test`);
    const c = await devisParti(ctx, "Terrasse");
    const avant = await pdfDevisParJeton(c.jeton, MARDI);
    assert.ok(avant, "Le lien ne sert aucun PDF avant l'accord.");
    assert.ok(!avant.nom.includes("signe"), `Un devis non signé se dit signé : ${avant.nom}`);
    const cleEnvoi = await cleDeLEnvoi(ctx, c.devisId);

    assert.equal((await accepter(c.jeton, SIGNATURE_ESSAI)).succes, true);
    await deposerLeDevisSigne(c.jeton);
    const premiere = (await lireEnvoi(ctx, c.envoiId)).pdfSigneCle;
    assert.ok(premiere, "L'exemplaire signé n'a pas été rangé après l'accord.");

    const apres = await pdfDevisParJeton(c.jeton, MARDI);
    assert.ok(apres && apres.nom.endsWith("-signe.pdf"), `Le lien ne sert pas l'exemplaire signé : ${apres?.nom}`);
    assert.notDeepEqual(apres.octets, avant.octets, "Le PDF servi après l'accord est celui d'avant.");
    assert.equal((await lireEnvoi(ctx, c.envoiId)).pdfSigneCle, premiere, "L'exemplaire signé a été recomposé.");
    assert.equal(await cleDeLEnvoi(ctx, c.devisId), cleEnvoi, "Le PDF de l'envoi a été remplacé.");
  });

  await test("F. l'écran du patron ouvre le même exemplaire signé", async () => {
    const ctx = await contexte(`patron-${Date.now()}@t.test`);
    const c = await devisParti(ctx, "Arrosage");
    assert.equal(
      await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) => cleSigneeDuDevis(tx, c.devisId)),
      null,
      "Un devis sans accord a un exemplaire signé."
    );
    assert.equal((await accepter(c.jeton, SIGNATURE_ESSAI)).succes, true);
    // Sans `deposerLeDevisSigne` : l'écran du patron rattrape un accord dont
    // la composition aurait échoué.
    const cle = await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) => cleSigneeDuDevis(tx, c.devisId));
    assert.ok(cle, "Le patron n'ouvre pas l'exemplaire signé.");
    assert.equal((await lireEnvoi(ctx, c.envoiId)).pdfSigneCle, cle);
    const autre = await contexte(`voisin-${Date.now()}@t.test`);
    assert.equal(
      await withEntreprise(autre.utilisateurId, autre.entrepriseId, (tx) => cleSigneeDuDevis(tx, c.devisId)),
      null,
      "Une autre entreprise lit l'exemplaire signé."
    );
  });

  await test("G. l'accord défait garde la signature dans sa preuve, et le lien revient au devis de l'envoi", async () => {
    const ctx = await contexte(`defait-${Date.now()}@t.test`);
    const c = await devisParti(ctx, "Potager");
    assert.equal((await accepter(c.jeton, SIGNATURE_ESSAI)).succes, true);
    await deposerLeDevisSigne(c.jeton);
    await defaireLAcceptation(ctx, c.chantierId, "attente");

    const e = await lireEnvoi(ctx, c.envoiId);
    assert.equal(e.signaturePng, null, "La signature survit à l'accord défait.");
    assert.equal(e.pdfSigneCle, null, "Le lien servirait encore un devis signé.");
    const [trace] = await withEntreprise(ctx.utilisateurId, ctx.entrepriseId, (tx) =>
      tx.select().from(acceptationsDefaites).where(eq(acceptationsDefaites.envoiId, c.envoiId))
    );
    assert.equal(trace?.signaturePng, SIGNATURE_ESSAI.png, "La preuve de l'accord défait a perdu la signature.");
    const lien = await pdfDevisParJeton(c.jeton, MARDI);
    assert.ok(lien && !lien.nom.includes("signe"), `Le lien sert encore l'exemplaire signé : ${lien?.nom}`);
  });

  console.log(`\n${reussis} réussi(s), ${echoues} échoué(s)`);
  await pool.end();
  process.exit(echoues === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
