import assert from "node:assert/strict";
import { pool } from "../src/server/db/client";
import { creerEntreprise } from "../src/server/repositories/entreprises";
import { creerChantier, listerChantiersPourPlanning } from "../src/server/repositories/chantiers";
import { creerClient, getClient, mettreAJourClient } from "../src/server/repositories/clients";
import { ajouterLignePrix } from "../src/server/repositories/lignes-prix";
import { getOuCreerDevisBrouillon, envoyerDevis } from "../src/server/repositories/devis";
import { terminerChantier, emettreFacture, getFacturePourChantier } from "../src/server/repositories/factures";
import { enregistrerContrat, envoyerContrat, repondreAuContrat } from "../src/server/repositories/contrats-entretien";
import {
  annulerHivernageFait,
  etatHivernageDuClient,
  noterHivernageFait,
  repondreSurLArrosage,
} from "../src/server/repositories/hivernage";
import { listerFichesClients } from "../src/server/repositories/fiche-client";
import { poserLeClientSurLeJour } from "../src/server/repositories/pose-d-un-client";
import { ceQueLaFicheDit, TRAVAUX_DE_L_HIVERNAGE } from "../src/lib/hivernage";
import type { ContratSaisi } from "../src/lib/contrats-entretien";

// HIVERNER L'ARROSAGE, EN BASE et sous `atlas_app` — sa planche du
// 5 novembre 2026, « la B » (`appli/soignee/hiverner-l-arrosage.html`).
//
// **Pourquoi une suite base, en plus de la règle pure** (`test-hivernage.ts`).
// La règle dit ce que la fiche montre ; ici se prouve ce que la base LUI
// donne : la facture qui parle d'arrosage, le contrat accepté, l'hivernage posé
// au planning, et rien de tout cela chez une autre entreprise. Les suites
// navigateur traversent la RLS (`CLAUDE.md` §5) : elles ne le verraient pas.
//
// Écrite le 6 novembre 2026, PAS ENCORE JOUÉE : sa règle, aucune batterie sans
// son « oui ». À jouer avec `npm test` quand il l'autorise.

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

async function contexte(suffixe: string) {
  const { entreprise, utilisateurId } = await creerEntreprise(
    { nom: `Jardins ${suffixe}` },
    { email: `hivernage-${suffixe}-${Date.now()}@atlas.test` }
  );
  return { utilisateurId, entrepriseId: entreprise.id };
}

type Ctx = Awaited<ReturnType<typeof contexte>>;

/** Une facture émise, par le vrai parcours : devis envoyé, chantier terminé, facture émise. */
async function factureEmise(ctx: Ctx, clientId: string, libelle: string) {
  const c = await creerChantier(ctx, { nom: libelle, clientId });
  await ajouterLignePrix(ctx, c.id, libelle, "480.00");
  const d = await getOuCreerDevisBrouillon(ctx, c.id);
  await envoyerDevis(ctx, d.id);
  await terminerChantier(ctx, c.id);
  const f = await getFacturePourChantier(ctx, c.id);
  assert.ok(f, "la facture n'a pas été préparée");
  await emettreFacture(ctx, f.facture.id);
  return f.facture;
}

const CONTRAT: ContratSaisi = {
  prestations: [{ libelle: "Tonte et ébarbage", famille: "Pelouse", mois: [4, 5, 6, 7, 8, 9, 10], foisParMois: 2, prixPassageHt: "45" }],
  debut: "2027-03-01",
  dureeMois: 12,
  reconduit: true,
  facturation: "passage",
  avecCompteRendu: false,
};

async function main() {
  console.log("=== Hiverner l'arrosage, en base ===");
  const a = await contexte("a");
  const b = await contexte("b");

  await cas("un client neuf : trois faits « jamais demandé », aucune question", async () => {
    const client = await creerClient(a, { nom: "M. Faucher" });
    const etat = await etatHivernageDuClient(a, client.id);
    assert.ok(etat);
    assert.deepEqual(etat.faits, { arrosageAutomatique: null, hivernageParNous: null, hiverneLe: null });
    assert.equal(etat.factureQuiParle, null);
    assert.equal(etat.aUnContrat, false);
    assert.equal(ceQueLaFicheDit(etat, "2026-11-05"), null);
  });

  await cas("une facture émise qui parle d'arrosage fait poser la question, une autre non", async () => {
    const client = await creerClient(a, { nom: "Mme Garnier" });
    await factureEmise(a, client.id, "Taille de haie");
    let etat = await etatHivernageDuClient(a, client.id);
    assert.equal(etat?.factureQuiParle, null, "une taille de haie ne parle pas d'arrosage");
    await factureEmise(a, client.id, "Réparation de l'ARROSAGE automatique");
    etat = await etatHivernageDuClient(a, client.id);
    assert.ok(etat?.factureQuiParle, "la facture qui parle d'arrosage n'a pas été lue");
    assert.equal(ceQueLaFicheDit(etat!, etat!.factureQuiParle!)?.genre, "question-arrosage");
  });

  await cas("un contrat d'entretien ACCEPTÉ fait poser la question ; envoyé seulement, non", async () => {
    const client = await creerClient(a, { nom: "Mme Costa", civilite: "mme" });
    const r = await enregistrerContrat(a, { id: null, clientId: client.id, saisi: CONTRAT });
    assert.ok(r.ok, "le contrat n'a pas pu s'enregistrer");
    const e = await envoyerContrat(a, r.contrat.id);
    assert.ok(e.ok, "le contrat n'est pas parti");
    assert.equal((await etatHivernageDuClient(a, client.id))?.aUnContrat, false, "un contrat sans réponse ne compte pas");
    await repondreAuContrat(e.jeton, { decision: "accepte" });
    const etat = await etatHivernageDuClient(a, client.id);
    assert.equal(etat?.aUnContrat, true);
    assert.deepEqual(ceQueLaFicheDit(etat!, "2026-11-05"), { genre: "question-arrosage", pourquoi: "Il a un contrat d’entretien." });
  });

  await cas("les deux réponses s'écrivent, et la goutte suit les deux « oui »", async () => {
    const client = await creerClient(a, { nom: "M. et Mme Roux" });
    assert.equal(await repondreSurLArrosage(a, client.id, "arrosage", true), true);
    let etat = await etatHivernageDuClient(a, client.id);
    assert.deepEqual(ceQueLaFicheDit(etat!, "2026-11-05"), { genre: "question-hivernage" });
    assert.equal(await repondreSurLArrosage(a, client.id, "hivernage", true), true);
    etat = await etatHivernageDuClient(a, client.id);
    assert.equal(ceQueLaFicheDit(etat!, "2026-11-05")?.genre, "a-hiverner");
    // La liste porte la même règle que la fiche (`aHiverner`), au jour du serveur.
    const liste = await listerFichesClients(a);
    const ligne = liste.find((c) => c.id === client.id);
    assert.ok(ligne, "le client manque à la liste");
    assert.equal(typeof ligne.aHiverner, "boolean");
  });

  await cas("« C'est fait » note le jour, « Annuler » rend le jour d'avant", async () => {
    const client = await creerClient(a, { nom: "M. Lefèvre" });
    await mettreAJourClient(a, client.id, { arrosageAutomatique: true, hivernageParNous: true });
    const note = await noterHivernageFait(a, client.id, "2026-11-12");
    assert.deepEqual(note, { precedent: null });
    assert.equal((await getClient(a, client.id))?.hiverneLe, "2026-11-12");
    assert.equal(await annulerHivernageFait(a, client.id, note!.precedent), true);
    assert.equal((await getClient(a, client.id))?.hiverneLe, null);
  });

  await cas("« Le prévoir » pose un chantier marqué hivernage, avec son travail, au planning", async () => {
    const client = await creerClient(a, { nom: "Mme Aubry", adresse: "3 impasse des Saules, 49070 Beaucouzé" });
    await mettreAJourClient(a, client.id, { arrosageAutomatique: true, hivernageParNous: true });
    const chantier = await poserLeClientSurLeJour(a, { id: client.id, nom: client.nom, adresse: client.adresse }, "2026-11-12", "matin", {
      nature: "hivernage",
      travaux: [TRAVAUX_DE_L_HIVERNAGE],
    });
    const ligne = (await listerChantiersPourPlanning(a)).find((c) => c.id === chantier.id);
    assert.ok(ligne, "l'hivernage n'est pas au planning");
    assert.equal(ligne.nature, "hivernage");
    assert.equal(ligne.datePlanifiee, "2026-11-12");
    const etat = await etatHivernageDuClient(a, client.id);
    assert.deepEqual(etat?.poses, [{ chantierId: chantier.id, jour: "2026-11-12", moment: "matin" }]);
    const dit = ceQueLaFicheDit(etat!, "2026-11-05");
    assert.equal(dit?.genre === "a-hiverner" && dit.prevu?.chantierId, chantier.id);
    const { rows } = await pool.query("select travaux_a_la_main from chantiers where id = $1", [chantier.id]);
    assert.deepEqual(rows[0]?.travaux_a_la_main, [TRAVAUX_DE_L_HIVERNAGE]);
  });

  await cas("une autre entreprise ne lit ni n'écrit rien de son arrosage", async () => {
    const client = await creerClient(a, { nom: "M. Bernard" });
    await mettreAJourClient(a, client.id, { arrosageAutomatique: true, hivernageParNous: true });
    assert.equal(await etatHivernageDuClient(b, client.id), null);
    assert.equal(await repondreSurLArrosage(b, client.id, "arrosage", false), false);
    assert.equal(await noterHivernageFait(b, client.id, "2026-11-12"), null);
    assert.equal(await annulerHivernageFait(b, client.id, null), false);
    const relu = await getClient(a, client.id);
    assert.equal(relu?.arrosageAutomatique, true, "la réponse de B a touché le client de A");
    assert.equal(relu?.hiverneLe, null, "B a noté un hivernage chez A");
  });

  await pool.end();
  if (echecs > 0) {
    console.error(`\n❌ ${echecs} échec(s).`);
    process.exit(1);
  }
  console.log("\n✅ L'hivernage tient en base, et chez soi seulement.");
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
