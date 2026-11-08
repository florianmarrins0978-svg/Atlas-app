import assert from "node:assert/strict";
import { composerDevisPdf, type DevisPdfData } from "../src/server/pdf/devis-pdf";
import { composerFacturePdf, type FacturePdfData } from "../src/server/pdf/facture-pdf";
import type { TraceDocument } from "../src/server/pdf/document-commun";
import { MENTION_CREDIT_D_IMPOT, mentionServicesALaPersonne } from "../src/lib/services-a-la-personne";

/**
 * LES SERVICES À LA PERSONNE, DESSINÉS POUR DE VRAI (migration 0178).
 *
 * `test-services-a-la-personne.ts` tient la règle ; celle-ci tient le CHEMIN
 * jusqu'au papier : le logo en tête, à droite du sien et avant les
 * références, la mention au pied, sur le devis COMME sur la facture, et rien
 * du tout quand la case n'est pas retenue. C'est la leçon de la décennale
 * (`test-devis-pdf-decennale-mediateur.ts`) : une règle verte ne dit rien du
 * papier.
 *
 * Sans base ni réseau : la composition seule, comme `test-allure-pdf.ts`.
 */

/** Un PNG d'un point : `pdf-lib` l'embarque, et la taille rendue se mesure. */
const PNG = new Uint8Array(
  Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64")
);
const LOGO = { octets: PNG, mime: "image/png" };
const MENTION = mentionServicesALaPersonne("SAP123456789", "2024-03-12");
const SAP = { logo: LOGO, mention: MENTION };

/** La colonne des références commence à `DROITE - 175` (595,28 − 31,2 − 175). */
const DEBUT_DES_REFERENCES = 595.28 - 31.2 - 175;

const DEVIS: DevisPdfData = {
  numeroCommercial: "2026-0041",
  numeroVersion: 1,
  statut: "envoye",
  dateEmission: "2026-11-05",
  entrepriseNom: "Jardins Démo",
  entrepriseAdresse: "4 rue des Tilleuls, Angers",
  entrepriseSiret: "123 456 789 00012",
  clientNom: "Lambert",
  clientCivilite: "mr",
  devise: "EUR",
  tauxTva: "20.00",
  totalHt: "420.00",
  totalTva: "84.00",
  totalTtc: "504.00",
  lignes: [
    { libelle: "Tonte et ramassage", quantite: "1", prixUnitaire: "180.00", montant: "180.00" },
    { libelle: "Taille des haies", quantite: "40", prixUnitaire: "6.00", montant: "240.00" },
  ],
};

const FACTURE: FacturePdfData = {
  numeroCommercial: "F2026-000041",
  statut: "emise",
  dateEmission: "2026-11-05",
  entrepriseNom: "Jardins Démo",
  entrepriseSiret: "123 456 789 00012",
  clientNom: "Lambert",
  clientCivilite: "mr",
  devise: "EUR",
  tauxTva: "20.00",
  totalHt: "420.00",
  totalTva: "84.00",
  totalTtc: "504.00",
  lignes: [{ libelle: "Taille des haies", quantite: "40", prixUnitaire: "6.00", montant: "240.00" }],
};

/** Les lignes du pied se replient : on cherche sur le papier entier, sans les sauts. */
const papier = (trace: TraceDocument) => trace.textes.map((t) => t.contenu).join(" ").replace(/\s+/g, " ");

let echecs = 0;
async function cas(nom: string, verifier: () => Promise<void>) {
  try {
    await verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

async function main() {
  console.log("=== Les services à la personne, sur le papier ===");

  await cas("case non retenue : le devis sort comme avant, sans logo ni mention", async () => {
    const { trace } = await composerDevisPdf(DEVIS, { servicesALaPersonne: null });
    assert.equal(trace.logos.length, 0);
    assert.ok(!papier(trace).includes("199 sexdecies"), "la mention s'imprime sans la case");
  });

  await cas("case retenue : la mention s'imprime au pied du devis, mot pour mot", async () => {
    const { trace } = await composerDevisPdf(DEVIS, { servicesALaPersonne: SAP });
    const texte = papier(trace);
    assert.ok(texte.includes(MENTION_CREDIT_D_IMPOT), "la phrase du crédit d'impôt manque");
    assert.ok(texte.includes("Déclaration SAP123456789 du 12 mars 2024."), "le numéro et la date manquent");
  });

  await cas("le logo seul se pose en haut à gauche, comme le sien", async () => {
    const { trace } = await composerDevisPdf(DEVIS, { servicesALaPersonne: SAP });
    assert.equal(trace.logos.length, 1);
    assert.equal(Math.round(trace.logos[0].x * 10) / 10, 31.2);
  });

  await cas("avec son logo : celui des services à la personne à DROITE, sans toucher les références", async () => {
    const { trace } = await composerDevisPdf(DEVIS, { logo: LOGO, servicesALaPersonne: SAP });
    assert.equal(trace.logos.length, 2, "deux logos attendus");
    const [sien, sap] = trace.logos;
    assert.ok(sap.x >= sien.x + sien.largeur, `le logo des services à la personne chevauche le sien (x=${sap.x})`);
    assert.ok(sap.x + sap.largeur <= DEBUT_DES_REFERENCES, "il mange la colonne des références");
    assert.equal(sap.y + sap.hauteur, sien.y + sien.hauteur, "les deux logos ne partent pas du même haut");
    const nom = trace.textes.find((t) => t.contenu === "Jardins Démo");
    assert.ok(nom && nom.y + 22 <= Math.min(sien.y, sap.y) + 0.01, "le nom chevauche les logos");
  });

  await cas("la mention se dépose sans logo : un logo absent ne retient rien", async () => {
    const { trace } = await composerDevisPdf(DEVIS, { servicesALaPersonne: { logo: null, mention: MENTION } });
    assert.equal(trace.logos.length, 0);
    assert.ok(papier(trace).includes("SAP123456789"));
  });

  await cas("la feuille de chantier ne porte ni l'un ni l'autre", async () => {
    const { trace } = await composerDevisPdf(DEVIS, { sansChiffrage: true, servicesALaPersonne: SAP });
    assert.equal(trace.logos.length, 0);
    assert.ok(!papier(trace).includes("199 sexdecies"));
  });

  await cas("la facture porte le même logo et la même mention", async () => {
    const { trace } = await composerFacturePdf(FACTURE, { servicesALaPersonne: SAP });
    assert.equal(trace.logos.length, 1);
    assert.ok(papier(trace).includes("Déclaration SAP123456789 du 12 mars 2024."));
  });

  await cas("une facture sans la case sort comme avant", async () => {
    const { trace } = await composerFacturePdf(FACTURE);
    assert.equal(trace.logos.length, 0);
    assert.ok(!papier(trace).includes("199 sexdecies"));
  });

  if (echecs > 0) {
    console.error(`\n${echecs} échec(s).`);
    process.exit(1);
  }
  console.log("\nLe logo et la mention arrivent sur le papier, et seulement avec la case.");
}

void main();
