import assert from "node:assert/strict";
import { enCentimes, nomConcorde, proposerFacture, type FactureARapprocher } from "../src/lib/rapprochement-bancaire";

// Quelle facture un virement reçu paie-t-il — sa demande du 21 octobre 2026.
//
// **Chaque cas de la planche `appli/banque-qui-previent.html` est ici**, avec
// ses chiffres : le bon montant, l'acompte, deux factures du même montant. Et
// le cas qui compte le plus est celui où la règle doit SE TAIRE : une
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

test("les montants se comptent en centimes, virgule ou point", () => {
  assert.equal(enCentimes("120.00"), 12000);
  assert.equal(enCentimes("120,5"), 12050);
  assert.equal(enCentimes("120"), 12000);
  assert.equal(enCentimes("0.10"), 10);
  assert.equal(enCentimes("douze"), null);
  assert.equal(enCentimes("-5.00"), null);
});

test("le bon montant : une seule facture, et elle est proposée", () => {
  const p = proposerFacture({ date: "2026-10-21", montant: "120.00", payeur: null, libelle: "VIR M LALA" }, [LALA, FREDERIC]);
  assert.equal(p.genre, "juste");
  assert.equal(p.genre === "juste" && p.facture.id, "f28");
  assert.equal(p.genre === "juste" && p.nomConcorde, true);
});

test("deux factures du même montant, sans nom : il choisit, Atlas ne tranche pas", () => {
  const p = proposerFacture({ date: "2026-10-21", montant: "120.00", payeur: null, libelle: "VIREMENT SEPA RECU" }, [LALA, MARTINS]);
  assert.equal(p.genre, "plusieurs");
  assert.deepEqual(p.genre === "plusieurs" && p.factures.map((f) => f.id).sort(), ["f25", "f28"]);
});

test("deux factures du même montant, le nom en désigne une : elle est proposée", () => {
  const p = proposerFacture({ date: "2026-10-21", montant: "120.00", payeur: "M MARTINS PAUL", libelle: "VIR" }, [LALA, MARTINS]);
  assert.equal(p.genre === "juste" && p.facture.id, "f25");
});

test("un acompte : aucun montant exact, le nom désigne une facture plus grande", () => {
  const p = proposerFacture({ date: "2026-10-21", montant: "400.00", payeur: null, libelle: "VIR FREDERIC DURAND" }, [LALA, FREDERIC]);
  assert.equal(p.genre, "partie");
  assert.equal(p.genre === "partie" && p.facture.id, "f20");
});

test("un montant plus petit SANS nom : rien n'est proposé", () => {
  // Le cas qui doit se taire. Sans le nom, 400 € « iraient » à toute facture
  // plus grande : proposer serait deviner.
  const p = proposerFacture({ date: "2026-10-21", montant: "400.00", payeur: null, libelle: "VIREMENT SEPA RECU" }, [LALA, FREDERIC]);
  assert.equal(p.genre, "aucune");
});

test("une facture émise APRÈS le virement n'est jamais proposée", () => {
  const p = proposerFacture({ date: "2026-10-19", montant: "120.00", payeur: null, libelle: "VIR M LALA" }, [LALA]);
  assert.equal(p.genre, "aucune");
});

test("les mots courts ne font pas concorder : « M », « LA », « DE »", () => {
  assert.equal(nomConcorde("La De", { date: "", montant: "1", payeur: null, libelle: "VIR M LA DE PARIS" }), false);
  assert.equal(nomConcorde("Lala", { date: "", montant: "1", payeur: null, libelle: "VIR MLALA" }), false);
  assert.equal(nomConcorde("Frédéric", { date: "", montant: "1", payeur: null, libelle: "VIR FREDERIC" }), true);
});

test("aucune facture en attente : rien", () => {
  assert.equal(proposerFacture({ date: "2026-10-21", montant: "120.00", payeur: null, libelle: "VIR" }, []).genre, "aucune");
});

console.log(`\n${passed} réussi(s), ${failed} échoué(s)`);
if (failed > 0) process.exit(1);
