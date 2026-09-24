import assert from "node:assert";
import { Pool } from "pg";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as clientsRepo from "../src/server/repositories/clients";
import * as devisRepo from "../src/server/repositories/devis";
import * as prixRepo from "../src/server/repositories/lignes-prix";
import { emettreFacture, terminerChantier } from "../src/server/repositories/factures";
import { facturesAvecPaiements, noterPaiement } from "../src/server/repositories/paiements-facture";
import { avoirsDeLaFacture, faireUnAvoir, pdfDeLAvoir } from "../src/server/repositories/avoirs";
import { declarerNonPayee, listerFacturesNonPayees } from "../src/server/repositories/factures-non-payees";
import { creerEnvoiFacture, factureParJeton, pdfAvoirParJeton } from "../src/server/repositories/envois-factures";
import { fermerLimiteur } from "../src/server/rate-limit";
import { nettoyerBase } from "./_test-db";

// **L'AVOIR ET « IL NE ME PAIERA PAS », EN BASE** (migration 0101, planches du
// 24 septembre 2026). Les règles sont éprouvées sans base (`test-avoir.ts`,
// `test-exigibilite-tva.ts`) ; cette suite tient ce qu'aucune règle pure ne
// peut tenir :
//
//   1. l'avoir naît complet, numéroté dans SA suite (« A »), avec son PDF ;
//   2. il ne se modifie ni ne se supprime, même par le propriétaire des tables ;
//   3. le reste dû se compte après lui, et un paiement ne peut pas le dépasser ;
//   4. « Il ne me paiera pas » range la facture, et le paiement l'en sort seul ;
//   5. rien ne se voit d'une entreprise à l'autre (FORCE RLS).

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

type Ctx = { utilisateurId: string; entrepriseId: string };
const MAINTENANT = new Date("2026-09-24T09:00:00Z");

async function contexte(suffixe: string): Promise<Ctx> {
  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise(
    { nom: "Atelier Avoir" },
    { email: `avoir-${suffixe}-${Date.now()}@t.test` }
  );
  return { utilisateurId, entrepriseId: entreprise.id };
}

/** La facture de M. Martin sur sa planche : 1 200 € HT, en deux lignes. */
async function factureEmise(ctx: Ctx) {
  const client = await clientsRepo.creerClient(ctx, { nom: "M. Martin", telephone: "0679984514" });
  const chantier = await chantiersRepo.creerChantier(ctx, { nom: "Taille de haie", clientId: client.id });
  await prixRepo.ajouterLignePrix(ctx, chantier.id, "Taille de haie de thuyas", "456.00", {
    quantite: "38",
    prixUnitaire: "12.00",
    unite: "ml",
  });
  await prixRepo.ajouterLignePrix(ctx, chantier.id, "Évacuation des déchets verts", "744.00");
  const devis = await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);
  await devisRepo.envoyerDevis(ctx, devis.id);
  const brouillon = await terminerChantier(ctx, chantier.id, MAINTENANT);
  return emettreFacture(ctx, brouillon.id, MAINTENANT);
}

async function main() {
  await nettoyerBase();
  const ctx = await contexte("a");
  const facture = await factureEmise(ctx);

  await test("un avoir de 300 € naît avec son numéro « A », son PDF, et 250 € HT + 50 € de TVA", async () => {
    const r = await faireUnAvoir(ctx, facture.id, { portee: null, montantTtc: "300", motif: "Geste commercial" }, MAINTENANT);
    assert.ok(r.ok, r.ok ? "" : r.refus);
    assert.match(r.avoir.numero, /^A/);
    const [a] = await avoirsDeLaFacture(ctx, facture.id);
    assert.equal(a!.totalHt, "250.00");
    assert.equal(a!.totalTva, "50.00");
    const pdf = await pdfDeLAvoir(ctx, a!.id);
    assert.ok(pdf && pdf.pdf.subarray(0, 4).toString() === "%PDF", "le PDF de l'avoir manque");
  });

  await test("le reste dû se compte après l'avoir : 1 140 €, et 1 140,01 € est refusé", async () => {
    const f = (await facturesAvecPaiements(ctx)).find((x) => x.id === facture.id)!;
    assert.equal(f.reste, "1140.00");
    const trop = await noterPaiement(ctx, facture.id, { date: "2026-09-25", montant: "1140.01" });
    assert.equal(trop.ok, false);
  });

  await test("le deuxième avoir prend le numéro suivant de SA suite, sans toucher à celle des factures", async () => {
    const r = await faireUnAvoir(ctx, facture.id, { portee: null, montantTtc: "40", motif: "Retard" }, MAINTENANT);
    assert.ok(r.ok, r.ok ? "" : r.refus);
    const [premier, second] = await avoirsDeLaFacture(ctx, facture.id);
    const n = (x: string) => Number(x.split("-").pop());
    assert.equal(n(second!.numero), n(premier!.numero) + 1);
    assert.ok(facture.numeroCommercial.startsWith("F"));
  });

  await test("un avoir qui dépasse ce qui reste est refusé, avec sa phrase", async () => {
    const r = await faireUnAvoir(ctx, facture.id, { portee: null, montantTtc: "1200", motif: "x" }, MAINTENANT);
    assert.equal(r.ok, false);
    assert.match(r.ok ? "" : r.refus, /plus que la facture/);
  });

  await test("UN AVOIR NE SE MODIFIE NI NE SE SUPPRIME, même par le propriétaire des tables", async () => {
    const admin = new Pool({ connectionString: process.env.DATABASE_ADMIN_URL });
    try {
      const client = await admin.connect();
      try {
        await client.query("BEGIN");
        await client.query("SELECT set_config('app.entreprise_id', $1, true)", [ctx.entrepriseId]);
        await assert.rejects(client.query("UPDATE avoirs SET motif = 'autre'"), /immuable/);
        await client.query("ROLLBACK");
        await client.query("BEGIN");
        await client.query("SELECT set_config('app.entreprise_id', $1, true)", [ctx.entrepriseId]);
        await assert.rejects(client.query("DELETE FROM avoirs"), /immuable/);
        await client.query("ROLLBACK");
      } finally {
        client.release();
      }
    } finally {
      await admin.end();
    }
  });

  await test("« Il ne me paiera pas » range la facture ; le paiement l'en sort, sans second geste", async () => {
    const autre = await factureEmise(ctx);
    assert.deepEqual(await declarerNonPayee(ctx, autre.id), { ok: true });
    // Deux fois : rien ne double.
    assert.deepEqual(await declarerNonPayee(ctx, autre.id), { ok: true });
    let rangees = await listerFacturesNonPayees(ctx);
    assert.deepEqual(rangees.map((f) => f.factureId), [autre.id]);
    assert.equal(rangees[0]!.reste, "1440.00");

    const paye = await noterPaiement(ctx, autre.id, { date: "2026-11-12", montant: "1440.00", moyen: "cheque", numero: "5800755" });
    assert.ok(paye.ok);
    rangees = await listerFacturesNonPayees(ctx);
    assert.equal(rangees.length, 0, "payée, elle devait sortir des non payées");
  });

  await test("une facture réglée ne peut pas être déclarée non payée", async () => {
    const reglee = await factureEmise(ctx);
    await noterPaiement(ctx, reglee.id, { date: "2026-09-25", montant: "1440.00" });
    const r = await declarerNonPayee(ctx, reglee.id);
    assert.equal(r.ok, false);
  });

  await test("RIEN NE SE VOIT D'UNE ENTREPRISE À L'AUTRE : ni ses avoirs, ni ses non payées", async () => {
    const voisin = await contexte("b");
    assert.equal((await avoirsDeLaFacture(voisin, facture.id)).length, 0);
    assert.equal(await pdfDeLAvoir(voisin, (await avoirsDeLaFacture(ctx, facture.id))[0]!.id), null);
    const r = await faireUnAvoir(voisin, facture.id, { portee: null, montantTtc: "10", motif: "x" }, MAINTENANT);
    assert.equal(r.ok, false);
    assert.equal((await listerFacturesNonPayees(voisin)).length, 0);
    assert.equal((await declarerNonPayee(voisin, facture.id)).ok, false);
  });

  await test("LE CLIENT TROUVE L'AVOIR PAR LE LIEN DE SA FACTURE, et par lui seul (rôle applicatif)", async () => {
    const envoi = await creerEnvoiFacture(ctx, facture.id, "sms", MAINTENANT);
    const page = await factureParJeton(envoi.jeton, MAINTENANT);
    assert.equal(page?.avoirs.length, 2, "les deux avoirs devaient être sous la facture");
    const pdf = await pdfAvoirParJeton(envoi.jeton, page!.avoirs[0]!.id, MAINTENANT);
    assert.ok(pdf && pdf.octets.subarray(0, 4).toString() === "%PDF", "le PDF de l'avoir n'est pas servi");
    assert.match(pdf.nom, /^avoir-A/);

    // Le lien d'une AUTRE facture de la même entreprise n'ouvre pas cet avoir.
    const autre = await factureEmise(ctx);
    const envoiAutre = await creerEnvoiFacture(ctx, autre.id, "sms", MAINTENANT);
    assert.equal((await factureParJeton(envoiAutre.jeton, MAINTENANT))?.avoirs.length, 0);
    assert.equal(await pdfAvoirParJeton(envoiAutre.jeton, page!.avoirs[0]!.id, MAINTENANT), null);

    // Un identifiant qui n'en est pas un, un jeton inconnu, un lien périmé : rien, et sans erreur.
    assert.equal(await pdfAvoirParJeton(envoi.jeton, "pas-un-uuid", MAINTENANT), null);
    assert.equal(await pdfAvoirParJeton("jeton-invente", page!.avoirs[0]!.id, MAINTENANT), null);
    const dansTroisMois = new Date(MAINTENANT.getTime() + 90 * 86400_000);
    assert.equal(await pdfAvoirParJeton(envoi.jeton, page!.avoirs[0]!.id, dansTroisMois), null);
  });

  console.log(`\n${passed} réussi(s), ${failed} échec(s).`);
  await fermerLimiteur();
  await pool.end();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
