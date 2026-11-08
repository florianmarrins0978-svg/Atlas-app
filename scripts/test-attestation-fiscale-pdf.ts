import assert from "node:assert/strict";
import { composerAttestationFiscale, type TraceAttestation } from "../src/server/pdf/attestation-fiscale-pdf";
import {
  calculerLAttestation,
  contenuDeLAttestationFiscale,
  type ClientAttestation,
  type FactureAttestable,
  type HeureEnregistree,
  type Organisme,
} from "../src/lib/attestation-fiscale";
import { ouvrirPdfProtege } from "./_lecteur-pdf-protege";

/**
 * L'ATTESTATION FISCALE, DESSINÉE POUR DE VRAI (le crédit d'impôt, lot 2).
 *
 * `test-attestation-fiscale.ts` tient la règle ; celle-ci tient le CHEMIN
 * jusqu'au papier : l'en-tête et sa déclaration, le logo à droite s'il est
 * déposé, chaque intervention sur sa ligne avec le nom PUIS le numéro, le
 * montant, le lieu et la date ; une liste longue sur plusieurs pages, l'en-tête
 * du tableau redit ; et un fichier protégé qui s'ouvre sans mot de passe. La
 * leçon de la décennale : une règle verte ne dit rien du papier.
 *
 * Sans base ni réseau : la composition seule. Les polices embarquées écrivent
 * des numéros de glyphes, pas des lettres : le composeur rend donc ce qu'il a
 * écrit (`TraceAttestation`), comme le moteur commun (`TraceDocument`).
 */

/** Un PNG d'un point : `pdf-lib` l'embarque, et la taille rendue se mesure. */
const PNG = new Uint8Array(
  Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64")
);
const LOGO = { octets: PNG, mime: "image/png" };

const ORGANISME: Organisme = {
  nom: "Jardins Démo",
  adresse: "4 rue des Tilleuls, 49000 Angers",
  numero: "SAP123456789",
  declareeLe: "2024-03-12",
  signataire: { nom: "Thomas Leroy", civilite: "mr" },
};
const CLIENT: ClientAttestation = { nom: "Vasseur", civilite: "mme", adresse: "8 allée des Chênes, 49100 Angers" };
const FACTURE: FactureAttestable = {
  id: "1",
  numero: "F2026-000041",
  chantierId: "ch-1",
  dateEmission: "2026-03-12",
  totalHt: "840.00",
  totalTva: "168.00",
  totalTtc: "1008.00",
  avoirs: [],
  reglements: [{ date: "2026-03-20", montant: "1008.00", moyen: "virement" }],
};
const HEURES: HeureEnregistree[] = [
  { chantierId: "ch-1", jour: "2026-03-12", minutes: 150, numero: 1, nom: "Martin Julien" },
  { chantierId: "ch-1", jour: "2026-05-14", minutes: 180, numero: 2, nom: "Roux Léa" },
];

function contenu(heures: readonly HeureEnregistree[] = HEURES) {
  const calcul = calculerLAttestation({ annee: 2026, factures: [FACTURE], heures, nomsActuels: new Map() });
  return contenuDeLAttestationFiscale(ORGANISME, CLIENT, calcul, "2027-01-12");
}

/** Le papier entier, sans les sauts de ligne de la mise en page. */
const papier = (trace: TraceAttestation) => trace.textes.join(" ").replace(/\s+/g, " ").replace(/[  ]/g, " ");

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
  console.log("=== L'attestation fiscale, sur le papier ===");

  await cas("l'en-tête : l'organisme, son adresse, sa déclaration, puis le titre de l'année", async () => {
    const { trace } = await composerAttestationFiscale(contenu(), null);
    const t = papier(trace);
    for (const attendu of ["Jardins Démo", "4 rue des Tilleuls, 49000 Angers", "Déclaration SAP123456789 du 12 mars 2024", "Attestation fiscale 2026"]) {
      assert.ok(t.includes(attendu), `« ${attendu} » manque`);
    }
  });

  await cas("la phrase entière, coupée en lignes mais complète", async () => {
    const { trace } = await composerAttestationFiscale(contenu(), null);
    assert.ok(
      papier(trace).includes(
        "Je soussigné Thomas Leroy, pour Jardins Démo, certifie que Mme Vasseur, 8 allée des Chênes, 49100 Angers, a bénéficié à son domicile de petits travaux de jardinage."
      ),
      papier(trace)
    );
  });

  await cas("CHAQUE INTERVENTION : la date, la durée, le nom PUIS le numéro", async () => {
    const { trace } = await composerAttestationFiscale(contenu(), null);
    const t = trace.textes;
    for (const [date, duree, nom, numero] of [
      ["12 mars", "2 h 30", "Martin Julien", "n° 1"],
      ["14 mai", "3 h", "Roux Léa", "n° 2"],
    ]) {
      const i = t.indexOf(date);
      assert.ok(i >= 0, `${date} manque`);
      assert.deepEqual(t.slice(i, i + 4), [date, duree, nom, numero], `la ligne du ${date} n'est pas dans l'ordre`);
    }
  });

  await cas("le montant acquitté, puis le lieu et la date", async () => {
    const { trace } = await composerAttestationFiscale(contenu(), null);
    const t = papier(trace);
    assert.ok(t.includes("Payé en 2026, par virement"));
    assert.ok(t.includes("1 008,00 €"));
    assert.ok(t.includes("Angers, le 12 janvier 2027"));
  });

  await cas("le logo des services à la personne, s'il est déposé ; rien sinon", async () => {
    assert.equal((await composerAttestationFiscale(contenu(), LOGO)).trace.logos, 1);
    assert.equal((await composerAttestationFiscale(contenu(), null)).trace.logos, 0);
  });

  await cas("un logo illisible ne retient pas le papier", async () => {
    const { trace } = await composerAttestationFiscale(contenu(), { octets: new Uint8Array([1, 2, 3]), mime: "image/png" });
    assert.equal(trace.logos, 0);
    assert.ok(papier(trace).includes("Attestation fiscale 2026"));
  });

  await cas("une année d'entretien hebdomadaire passe sur plusieurs pages, l'en-tête du tableau redit", async () => {
    const annee: HeureEnregistree[] = Array.from({ length: 80 }, (_, i) => {
      const j = new Date(Date.UTC(2026, 0, 5 + i * 4)).toISOString().slice(0, 10);
      return { chantierId: "ch-1", jour: j, minutes: 120, numero: 1, nom: "Martin Julien" };
    });
    const { trace } = await composerAttestationFiscale(contenu(annee), null);
    assert.ok(trace.pages >= 2, `${trace.pages} page(s) pour 80 interventions`);
    assert.equal(trace.textes.filter((t) => t === "DATE").length, trace.pages, "l'en-tête du tableau n'est pas redit à chaque page");
    assert.equal(trace.textes.filter((t) => t === "2 h").length, 80, "une intervention s'est perdue au saut de page");
  });

  await cas("le fichier est protégé contre la modification, et s'ouvre sans mot de passe", async () => {
    const { octets } = await composerAttestationFiscale(contenu(), LOGO);
    const lu = ouvrirPdfProtege(octets);
    assert.equal(lu.ouvrableSansMotDePasse, true);
  });

  if (echecs > 0) {
    console.error(`\n${echecs} échec(s).`);
    process.exit(1);
  }
  console.log("\nL'attestation arrive sur le papier telle qu'elle se relit.");
}

void main();
