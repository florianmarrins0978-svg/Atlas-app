import assert from "node:assert/strict";
import { composerDevisPdf, type DevisPdfData } from "../src/server/pdf/devis-pdf";
import { composerFacturePdf, type FacturePdfData } from "../src/server/pdf/facture-pdf";
import { TEXTE_ORIGINE_CONDITIONS_GENERALES } from "../src/lib/conditions-generales";
import type { TraceDocument } from "../src/server/pdf/document-commun";

/**
 * LA DÉCENNALE ET LE MÉDIATEUR, DESSINÉS POUR DE VRAI — migration 0093.
 *
 * `test-mentions-obligatoires.ts` couvre le calcul pur. Celle-ci vérifie le
 * CHEMIN : que les deux mentions arrivent sur le papier, sur le devis COMME sur
 * la facture, et qu'elles sont lues sur le DOCUMENT et non sur l'entreprise
 * d'aujourd'hui.
 *
 * **C'est le défaut qui a laissé passer onze jours de conditions muettes en
 * août 2026** (`ConditionsClient.tsx`) : les contrôles éprouvaient la règle,
 * jamais le trajet entre le réglage et le papier.
 */

const FIGE = {
  entrepriseAssureurDecennale: "AXA",
  entrepriseContratDecennale: "0000020872696404",
  entrepriseCouvertureDecennale: "France métropolitaine",
  entrepriseMediateurNom: "CM2C",
  entrepriseMediateurCoordonnees: "49 rue de Ponthieu, 75008 Paris",
};

const DEVIS: DevisPdfData = {
  numeroCommercial: "2026-0006",
  numeroVersion: 1,
  statut: "envoye",
  dateEmission: "2026-09-16",
  entrepriseNom: "Atlas",
  entrepriseAdresse: "10 rue des Artisans, 78200 Buchelay",
  entrepriseSiret: "123 456 789 00012",
  clientNom: "M. Bernard",
  devise: "EUR",
  tauxTva: "10.00",
  totalHt: "2450.00",
  totalTva: "245.00",
  totalTtc: "2695.00",
  lignes: [{ libelle: "Taille de haie", quantite: "1", prixUnitaire: "560.00", montant: "560.00" }],
};

const FACTURE: FacturePdfData = {
  numeroCommercial: "F2026-0006",
  statut: "emise",
  dateEmission: "2026-09-16",
  entrepriseNom: "Atlas",
  entrepriseSiret: "123 456 789 00012",
  clientNom: "M. Bernard",
  devise: "EUR",
  tauxTva: "10.00",
  totalHt: "2450.00",
  totalTva: "245.00",
  totalTtc: "2695.00",
  lignes: [{ libelle: "Taille de haie", quantite: "1", prixUnitaire: "560.00", montant: "560.00" }],
};

const contenus = (trace: TraceDocument) => trace.textes.map((t) => t.contenu);
/** Les lignes du pied se replient : on cherche la mention sur le papier entier. */
const papier = (trace: TraceDocument) => contenus(trace).join(" ");

let echecs = 0;
async function cas(nom: string, verifier: () => void | Promise<void>) {
  try {
    await verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

async function main() {
  console.log("=== La décennale et le médiateur, sur le papier ===");

  await cas("rien de saisi : le devis sort comme avant la migration", async () => {
    const { trace } = await composerDevisPdf(DEVIS);
    const texte = papier(trace);
    assert.ok(!texte.includes("Assurance décennale"), "une mention vide s'est imprimée");
    assert.ok(!texte.includes("Médiateur de la consommation"), "une mention vide s'est imprimée");
  });

  await cas("LES DEUX MENTIONS ARRIVENT SUR LE DEVIS", async () => {
    const { trace } = await composerDevisPdf({ ...DEVIS, ...FIGE });
    const texte = papier(trace);
    assert.ok(texte.includes("Assurance décennale"), "l'assurance n'est pas sur le devis");
    assert.ok(texte.includes("AXA"), "le nom de l'assureur manque");
    assert.ok(texte.includes("0000020872696404"), "le numéro de contrat manque");
    assert.ok(texte.includes("Médiateur de la consommation"), "le médiateur n'est pas sur le devis");
    assert.ok(texte.includes("CM2C"), "le nom du médiateur manque");
  });

  await cas("ET SUR LA FACTURE — le même pied, la même fonction", async () => {
    const { trace } = await composerFacturePdf({ ...FACTURE, ...FIGE });
    const texte = papier(trace);
    assert.ok(texte.includes("Assurance décennale"), "l'assurance n'est pas sur la facture");
    assert.ok(texte.includes("Médiateur de la consommation"), "le médiateur n'est pas sur la facture");
  });

  await cas("elles sont ÉCRITES EN BAS, pas au milieu du devis", async () => {
    const { trace } = await composerDevisPdf({ ...DEVIS, ...FIGE });
    const assurance = trace.textes.find((t) => t.contenu.includes("Assurance décennale"));
    assert.ok(assurance, "la mention n'a pas été tracée");
    // Le pied commence à MARGE + 92 ; rien de ce bloc ne monte au-dessus.
    assert.ok(assurance.y < 160, `la mention est écrite trop haut (y = ${assurance.y})`);
  });

  console.log("\n=== Les articles 9 et 11 se remplissent dans l'annexe ===");

  await cas("le crochet de l'article 9 disparaît, remplacé par l'assureur FIGÉ", async () => {
    const { trace } = await composerDevisPdf({
      ...DEVIS,
      ...FIGE,
      conditionsReglees: { conditionsGenerales: TEXTE_ORIGINE_CONDITIONS_GENERALES },
    });
    const texte = papier(trace);
    assert.ok(!texte.includes("[assureur"), "le crochet est parti chez le client");
    assert.ok(!texte.includes("[nom et coordonnées]"), "le crochet du médiateur est parti chez le client");
    assert.ok(texte.includes("AXA"), "l'article 9 n'a pas été rempli");
  });

  await cas("SANS assureur figé, le crochet RESTE : un manque se voit", async () => {
    // Le faire disparaître à vide laisserait « d'une assurance décennale : . »
    // chez un client — une phrase fausse à la place d'un manque visible.
    const { trace } = await composerDevisPdf({
      ...DEVIS,
      conditionsReglees: { conditionsGenerales: TEXTE_ORIGINE_CONDITIONS_GENERALES },
    });
    assert.ok(papier(trace).includes("[assureur"), "le crochet vide a été effacé sans être rempli");
  });

  await cas("UN DEVIS D'AVANT garde son propre assureur, pas celui d'aujourd'hui", async () => {
    // Le document porte ses colonnes figées : changer d'assureur dans Mon
    // entreprise ne doit rien réécrire sur une pièce déjà partie.
    const { trace } = await composerDevisPdf({
      ...DEVIS,
      ...FIGE,
      entrepriseAssureurDecennale: "Groupama",
      conditionsReglees: { conditionsGenerales: TEXTE_ORIGINE_CONDITIONS_GENERALES },
    });
    const texte = papier(trace);
    assert.ok(texte.includes("Groupama"), "le PDF n'a pas lu l'assureur figé sur le devis");
    assert.ok(!texte.includes("AXA"), "le PDF a inventé un assureur qui n'est pas celui du devis");
  });

  console.log(`\n${echecs === 0 ? "✅" : "❌"} La décennale et le médiateur sur le papier — ${echecs} échec(s).`);
  if (echecs > 0) process.exit(1);
}

main();
