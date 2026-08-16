import assert from "node:assert";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as clientsRepo from "../src/server/repositories/clients";
import * as devisRepo from "../src/server/repositories/devis";
import * as prixRepo from "../src/server/repositories/lignes-prix";
import { emettreFacture, releveTvaCollectee, terminerChantier } from "../src/server/repositories/factures";
import {
  compterEnAttente,
  compterPaiements,
  exigibiliteDe,
  facturesAvecPaiements,
  facturesEnAttente,
  noterPaiement,
  reglerExigibilite,
  retirerPaiement,
  soldera,
} from "../src/server/repositories/paiements-facture";
import { trimestre } from "../src/server/trimestre";
import { fermerLimiteur } from "../src/server/rate-limit";
import { nettoyerBase } from "./_test-db";

// **« Est-ce que la facture peut rentrer au relevé de TVA seulement une fois
// que le client m'a payé ? »** — le patron, le 14 août 2026.
//
// Les règles sont éprouvées sans base (`test-exigibilite-tva.ts`). Ce que CETTE
// suite tient, et qu'aucune règle pure ne peut tenir :
//
//   1. **UNE FACTURE IMPAYÉE NE FIGURE PAS AU RELEVÉ**, et y entre à la date du
//      règlement. C'est sa demande entière, et c'est ce qui part aux impôts ;
//   2. **le passé ne bouge pas.** La migration 0042 a supposé chaque facture
//      déjà émise réglée le jour de son émission : un trimestre déjà déclaré
//      doit rendre exactement le même montant qu'avant ;
//   3. **le régime se change sans rien perdre**, et le relevé suit ;
//   4. **rien ne déborde d'une entreprise sur une autre** : ce sont ses
//      encaissements.

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
const MAINTENANT = new Date("2026-08-05T09:00:00Z");

async function contexte(suffixe: string): Promise<Ctx> {
  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise(
    { nom: "Atelier Paiement" },
    { email: `paie-${suffixe}-${Date.now()}@t.test` }
  );
  return { utilisateurId, entrepriseId: entreprise.id };
}

/** Une facture émise pour ce montant HT — le parcours entier, comme lui. */
async function factureEmise(ctx: Ctx, montantHt: string) {
  const client = await clientsRepo.creerClient(ctx, { nom: "M. Bernard", telephone: "0612345678" });
  const chantier = await chantiersRepo.creerChantier(ctx, { nom: "Haie du fond", clientId: client.id });
  await prixRepo.ajouterLignePrix(ctx, chantier.id, "Taille", montantHt);
  const devis = await devisRepo.getOuCreerDevisBrouillon(ctx, chantier.id);
  await devisRepo.envoyerDevis(ctx, devis.id);
  const brouillon = await terminerChantier(ctx, chantier.id, MAINTENANT);
  return emettreFacture(ctx, brouillon.id, MAINTENANT);
}

const T3 = trimestre(2026, 3);
const T4 = trimestre(2026, 4);

async function main() {
  await nettoyerBase();

  await test("le régime par défaut est « encaissements » — le défaut LÉGAL", async () => {
    // Les débits sont une OPTION qui se demande à l'administration : les poser
    // par défaut, c'est inviter à déclarer trop tôt.
    const ctx = await contexte("defaut");
    assert.strictEqual(await exigibiliteDe(ctx), "encaissements");
  });

  // --- LE contrôle du lot --------------------------------------------------

  await test("UNE FACTURE IMPAYÉE N'EST PAS AU RELEVÉ", async () => {
    const ctx = await contexte("impayee");
    const facture = await factureEmise(ctx, "1200.00");

    const releve = await releveTvaCollectee(ctx, T3.debut, T3.fin);
    assert.strictEqual(releve.lignes.length, 0, "la facture impayée est entrée au relevé");
    assert.strictEqual(releve.totalTva, "0.00");

    // Et ce qui n'y est pas est ANNONCÉ : une facture absente en silence se
    // lirait comme un bogue de l'application.
    assert.strictEqual(releve.enAttente.nombre, 1);
    assert.strictEqual(releve.enAttente.tva, "240.00");
    assert.strictEqual(releve.enAttente.ttc, "1440.00");

    const attente = await facturesEnAttente(ctx);
    assert.strictEqual(attente.length, 1);
    assert.strictEqual(attente[0].id, facture.id);
    assert.strictEqual(attente[0].reste, "1440.00");
    assert.strictEqual(attente[0].etat, "en_attente");
  });

  await test("payée, elle entre au relevé — à la date du RÈGLEMENT", async () => {
    const ctx = await contexte("payee");
    const facture = await factureEmise(ctx, "1200.00");

    const r = await noterPaiement(ctx, facture.id, { date: "2026-10-02", montant: "1440.00" });
    assert.ok(r.ok, `refusé : ${r.ok ? "" : r.raison}`);

    // Facturée en août, encaissée en octobre : la TVA appartient au 4e
    // trimestre. C'est exactement l'écart qui lui coûtait de l'argent.
    assert.strictEqual((await releveTvaCollectee(ctx, T3.debut, T3.fin)).totalTva, "0.00");
    const t4 = await releveTvaCollectee(ctx, T4.debut, T4.fin);
    assert.strictEqual(t4.totalTva, "240.00");
    assert.strictEqual(t4.lignes.length, 1);
    assert.strictEqual(t4.lignes[0].motif, "paiement");
    assert.strictEqual(t4.lignes[0].dateEmission, "2026-10-02");

    // Et elle a quitté la file d'attente.
    assert.strictEqual((await facturesEnAttente(ctx)).length, 0);
  });

  await test("« Payée » solde en un geste, à la date du jour", async () => {
    // La porte qu'il a décrite : *« je clique sur valider, et boum »*.
    const ctx = await contexte("solde");
    const facture = await factureEmise(ctx, "800.00");
    const r = await soldera(ctx, facture.id, "2026-09-15");
    assert.ok(r.ok, `refusé : ${r.ok ? "" : r.raison}`);
    assert.strictEqual(r.ok && r.etat, "soldee");
    assert.strictEqual(r.ok && r.reste, "0.00");
    assert.strictEqual((await releveTvaCollectee(ctx, T3.debut, T3.fin)).totalTva, "160.00");
  });

  await test("un acompte n'apporte que sa part, et la facture reste en attente", async () => {
    const ctx = await contexte("acompte");
    const facture = await factureEmise(ctx, "1200.00");
    const r = await noterPaiement(ctx, facture.id, { date: "2026-08-20", montant: "500.00" });
    assert.ok(r.ok);
    assert.strictEqual(r.ok && r.etat, "partielle");

    const t3 = await releveTvaCollectee(ctx, T3.debut, T3.fin);
    assert.strictEqual(t3.totalTva, "83.33", `l'acompte a apporté ${t3.totalTva} € de TVA`);
    assert.strictEqual(t3.enAttente.nombre, 1, "la facture partiellement réglée n'attend plus rien");
    assert.strictEqual(t3.enAttente.ttc, "940.00");
  });

  await test("le solde d'un acompte tombe juste, au centime", async () => {
    const ctx = await contexte("solde-acompte");
    const facture = await factureEmise(ctx, "1200.00");
    await noterPaiement(ctx, facture.id, { date: "2026-08-20", montant: "500.00" });
    await noterPaiement(ctx, facture.id, { date: "2026-10-05", montant: "940.00" });

    const t3 = await releveTvaCollectee(ctx, T3.debut, T3.fin);
    const t4 = await releveTvaCollectee(ctx, T4.debut, T4.fin);
    const total = (Number(t3.totalTva) + Number(t4.totalTva)).toFixed(2);
    assert.strictEqual(total, "240.00", `les deux trimestres totalisent ${total} € au lieu de 240,00`);
    assert.strictEqual((await facturesEnAttente(ctx)).length, 0);
  });

  await test("UN MONTANT PLUS GRAND QUE LE RESTE DÛ EST REFUSÉ, et rien n'est écrit", async () => {
    const ctx = await contexte("trop");
    const facture = await factureEmise(ctx, "1200.00");
    await noterPaiement(ctx, facture.id, { date: "2026-08-20", montant: "1000.00" });

    const r = await noterPaiement(ctx, facture.id, { date: "2026-09-01", montant: "500.00" });
    assert.strictEqual(r.ok, false);
    assert.match(r.ok ? "" : r.raison, /440,00 €|440.00 €/);
    assert.strictEqual(await compterPaiements(ctx, facture.id), 1, "un règlement refusé a quand même été écrit");
  });

  await test("un règlement se défait, et sa TVA repart du relevé", async () => {
    // Sans cela, un doigt qui glisse déclarerait une TVA jamais encaissée.
    const ctx = await contexte("defaire");
    const facture = await factureEmise(ctx, "1000.00");
    await soldera(ctx, facture.id, "2026-09-15");
    assert.strictEqual((await releveTvaCollectee(ctx, T3.debut, T3.fin)).totalTva, "200.00");

    const [avec] = await facturesAvecPaiements(ctx);
    await retirerPaiement(ctx, avec.paiements[0].id);

    assert.strictEqual((await releveTvaCollectee(ctx, T3.debut, T3.fin)).totalTva, "0.00");
    assert.strictEqual((await facturesEnAttente(ctx)).length, 1, "la facture n'est pas revenue en attente");
  });

  await test("une facture d'une AUTRE entreprise ne se paie pas", async () => {
    const a = await contexte("iso-a");
    const b = await contexte("iso-b");
    const facture = await factureEmise(a, "1000.00");

    const r = await noterPaiement(b, facture.id, { date: "2026-09-01", montant: "100.00" });
    assert.strictEqual(r.ok, false, "B a pu poser un règlement sur une facture de A");
    assert.strictEqual(await compterPaiements(a, facture.id), 0);
    assert.strictEqual((await facturesEnAttente(b)).length, 0, "B voit les factures de A");
  });

  // --- Le régime ------------------------------------------------------------

  await test("AUX DÉBITS, la facture entre au relevé sans qu'on la paie", async () => {
    const ctx = await contexte("debits");
    await factureEmise(ctx, "1200.00");
    await reglerExigibilite(ctx, "debits");

    const t3 = await releveTvaCollectee(ctx, T3.debut, T3.fin);
    assert.strictEqual(t3.regime, "debits");
    assert.strictEqual(t3.totalTva, "240.00");
    assert.strictEqual(t3.lignes[0].motif, "emission");
    // Et l'attente n'a plus lieu d'être : tout est déjà déclaré.
    assert.strictEqual(t3.enAttente.nombre, 0);
  });

  await test("changer de régime ne perd aucun règlement", async () => {
    const ctx = await contexte("bascule");
    const facture = await factureEmise(ctx, "1000.00");
    await noterPaiement(ctx, facture.id, { date: "2026-09-15", montant: "1200.00" });

    await reglerExigibilite(ctx, "debits");
    assert.strictEqual((await releveTvaCollectee(ctx, T3.debut, T3.fin)).totalTva, "200.00");

    // Et le retour rend exactement ce qu'on avait : le règlement est resté.
    await reglerExigibilite(ctx, "encaissements");
    const revenu = await releveTvaCollectee(ctx, T3.debut, T3.fin);
    assert.strictEqual(revenu.totalTva, "200.00");
    assert.strictEqual(revenu.lignes[0].motif, "paiement");
  });

  // --- Ce qui ne doit PAS bouger : le passé --------------------------------

  await test("LE PASSÉ NE BOUGE PAS : la reprise de la migration 0042", async () => {
    // Une facture émise AVANT ce lot n'a pas de règlement. La migration lui en
    // a posé un, daté de son émission, pour que le relevé déjà déclaré rende
    // exactement le même montant. On rejoue cette situation à la main : une
    // facture sans règlement, mais dont la reprise a fait son travail.
    const ctx = await contexte("passe");
    const facture = await factureEmise(ctx, "1000.00");
    const r = await noterPaiement(ctx, facture.id, { date: facture.dateEmission, montant: "1200.00" });
    assert.ok(r.ok);

    const t3 = await releveTvaCollectee(ctx, T3.debut, T3.fin);
    assert.strictEqual(t3.totalTva, "200.00", "le relevé du trimestre a changé de montant");
    assert.strictEqual(t3.lignes[0].dateEmission, facture.dateEmission);
    assert.strictEqual((await compterEnAttente(ctx)).nombre, 0);
  });

  await test("le compteur d'attente dit la plus ancienne", async () => {
    const ctx = await contexte("compteur");
    await factureEmise(ctx, "500.00");
    const compte = await compterEnAttente(ctx);
    assert.strictEqual(compte.nombre, 1);
    assert.strictEqual(compte.plusAncienne, "2026-08-05");
  });

  console.log(`\n${passed} test(s) réussi(s), ${failed} échoué(s).`);
  await fermerLimiteur();
  await pool.end();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
