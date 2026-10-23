import assert from "node:assert/strict";
import {
  enCentimes,
  facturesProposees,
  montantANoter,
  nomConcorde,
  numeroLu,
  proposerFacture,
  type FactureARapprocher,
} from "../src/lib/rapprochement-bancaire";

// Quelle facture un virement reçu paie-t-il — sa demande du 21 octobre 2026,
// et le numéro lu dans le libellé, sa demande du 23 octobre.
//
// **Chaque cas des planches `appli/banque-a-essayer.html` et
// `appli/banque-numero-et-termines.html` est ici**, avec leurs chiffres. Et
// les cas qui comptent le plus sont ceux où la règle doit SE TAIRE : une
// proposition fausse met la TVA dans le mauvais mois.

let passed = 0;
let failed = 0;
function test(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ ${nom}`);
    passed++;
  } catch (err) {
    console.error(`❌ ${nom}`);
    console.error(`   ${err instanceof Error ? err.message : err}`);
    failed++;
  }
}

const LALA: FactureARapprocher = { id: "f28", numero: "F2026-000028", clientNom: "Lala", reste: "120.00", dateEmission: "2026-10-20" };
const MARTINS: FactureARapprocher = { id: "f25", numero: "F2026-000025", clientNom: "Martins", reste: "120.00", dateEmission: "2026-10-08" };
const FREDERIC: FactureARapprocher = { id: "f20", numero: "F2026-000020", clientNom: "Frédéric Durand", reste: "780.00", dateEmission: "2026-09-27" };
const v = (libelle: string, montant: string, payeur: string | null = null, date = "2026-10-21") => ({ date, montant, payeur, libelle });

test("les montants se comptent en centimes, virgule ou point", () => {
  assert.equal(enCentimes("120.00"), 12000);
  assert.equal(enCentimes("120,5"), 12050);
  assert.equal(enCentimes("120"), 12000);
  assert.equal(enCentimes("0.10"), 10);
  assert.equal(enCentimes("douze"), null);
  assert.equal(enCentimes("-5.00"), null);
});

// ── Le numéro ───────────────────────────────────────────────────────────────

test("le numéro se lit écrit de toutes les façons qu'un client le tape", () => {
  for (const libelle of ["VIR F2026-000028", "VIR F2026000028", "facture f 2026 000028", "REF 2026-000028 MERCI", "2026.000028"]) {
    assert.equal(numeroLu("F2026-000028", v(libelle, "1")), true, libelle);
  }
});

test("un numéro collé à d'autres chiffres, ou un nombre court, ne se lit pas", () => {
  assert.equal(numeroLu("F2026-000028", v("VIR 120260000289", "1")), false);
  assert.equal(numeroLu("F2026-000028", v("VIR FACTURE 28", "1")), false);
  assert.equal(numeroLu("F2026-000028", v("VIR F2026-000029", "1")), false);
  // Un numéro trop court pour être reconnu sans risque : on ne lit rien.
  assert.equal(numeroLu("F-28", v("VIR F-28", "1")), false);
});

test("le numéro et le bon montant : la facture, par le numéro, même sans le nom", () => {
  const p = proposerFacture(v("VIREMENT SEPA F2026-000028", "120.00"), [LALA, MARTINS]);
  assert.equal(p.genre, "juste");
  assert.equal(p.genre === "juste" && p.facture.id, "f28");
  assert.equal(p.genre === "juste" && p.indice, "numero");
});

test("le numéro passe AVANT le montant : deux factures à 120 €, le numéro tranche", () => {
  const p = proposerFacture(v("VIR 2026-000025", "120.00"), [LALA, MARTINS]);
  assert.equal(p.genre === "juste" && p.facture.id, "f25");
});

test("le numéro et un montant plus petit : une partie, sans avoir besoin du nom", () => {
  const p = proposerFacture(v("VIREMENT SEPA F2026000020 ACOMPTE", "400.00"), [LALA, FREDERIC]);
  assert.equal(p.genre, "partie");
  assert.equal(p.genre === "partie" && p.facture.id, "f20");
});

test("le numéro et un montant plus grand : trop payé, et l'on ne note que le reste", () => {
  const p = proposerFacture(v("VIR 2026-000028", "150.00"), [LALA]);
  assert.equal(p.genre, "trop");
  assert.equal(montantANoter(v("x", "150.00"), LALA), 12000);
});

test("les numéros de DEUX factures dans un virement : rien n'est proposé", () => {
  // Un virement qui paie deux factures se note à la main : en proposer une
  // seule mettrait l'autre en impayée alors qu'elle est réglée.
  const p = proposerFacture(v("F2026-000028 F2026-000025", "240.00"), [LALA, MARTINS]);
  assert.equal(p.genre, "aucune");
});

// ── Sans numéro : comme le 21 octobre ──────────────────────────────────────

test("le bon montant et le nom : la facture, par le nom", () => {
  const p = proposerFacture(v("VIR M LALA", "120.00"), [LALA, FREDERIC]);
  assert.equal(p.genre === "juste" && p.facture.id, "f28");
  assert.equal(p.genre === "juste" && p.indice, "nom");
});

test("deux factures du même montant, sans nom : il choisit, Atlas ne tranche pas", () => {
  const p = proposerFacture(v("VIREMENT SEPA RECU", "120.00"), [LALA, MARTINS]);
  assert.equal(p.genre, "plusieurs");
  assert.deepEqual(facturesProposees(p).map((f) => f.id).sort(), ["f25", "f28"]);
});

test("deux factures du même montant, le nom en désigne une : elle est proposée", () => {
  const p = proposerFacture(v("VIR", "120.00", "M MARTINS PAUL"), [LALA, MARTINS]);
  assert.equal(p.genre === "juste" && p.facture.id, "f25");
});

test("un acompte : aucun montant exact, le nom désigne une facture plus grande", () => {
  const p = proposerFacture(v("VIR FREDERIC DURAND", "400.00"), [LALA, FREDERIC]);
  assert.equal(p.genre, "partie");
  assert.equal(p.genre === "partie" && p.facture.id, "f20");
  assert.equal(montantANoter(v("x", "400.00"), FREDERIC), 40000);
});

test("un montant plus petit SANS nom ni numéro : rien n'est proposé", () => {
  const p = proposerFacture(v("VIREMENT SEPA RECU", "400.00"), [LALA, FREDERIC]);
  assert.equal(p.genre, "aucune");
});

test("une facture émise APRÈS le virement n'est jamais proposée, même par son numéro", () => {
  assert.equal(proposerFacture(v("VIR M LALA", "120.00", null, "2026-10-19"), [LALA]).genre, "aucune");
  assert.equal(proposerFacture(v("VIR F2026-000028", "120.00", null, "2026-10-19"), [LALA]).genre, "aucune");
});

test("les mots courts ne font pas concorder : « M », « LA », « DE »", () => {
  assert.equal(nomConcorde("La De", v("VIR M LA DE PARIS", "1")), false);
  assert.equal(nomConcorde("Lala", v("VIR MLALA", "1")), false);
  assert.equal(nomConcorde("Frédéric", v("VIR FREDERIC", "1")), true);
});

test("le salaire et la MSA de son essai du 23 octobre : rien n'est proposé", () => {
  // Ses deux vrais virements de l'essai, sur son compte : aucune facture ne
  // doit s'y accrocher.
  assert.equal(proposerFacture(v("VIR INST A 2 PAS DE L ARB SALAIRE SEPTEMBRE", "1650.00"), [LALA, FREDERIC]).genre, "aucune");
  assert.equal(proposerFacture(v("VIR MUTUALITE SOCIALE AGRICO VIR NORMES DU 06/10/2026", "230.00"), [LALA, FREDERIC]).genre, "aucune");
});

test("aucune facture en attente : rien", () => {
  assert.equal(proposerFacture(v("VIR", "120.00"), []).genre, "aucune");
});

console.log(`\n${passed} réussi(s), ${failed} échoué(s)`);
if (failed > 0) process.exit(1);
