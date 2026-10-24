import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { fenetresDeLecture, lireTransactions, virementsDesMouvements, type Transaction } from "../src/lib/releve-bancaire";

// POUR MON COMPTABLE, LOT 1 — sa remarque du 24 octobre 2026 : *« e-banking
// permet de lire les virements entrants, mais pas les sortants »*.
//
// **Ce que la suite défend** :
//   · les deux sens sont lus, une sortie avec CELUI QUI A ÉTÉ PAYÉ ;
//   · une opération en attente, ou dans une autre monnaie, n'entre pas ;
//   · **la clé d'un virement reçu n'a pas bougé** : celles déjà rangées dans
//     `virements_recus` doivent être reconnues, sans quoi la lecture suivante
//     reposerait au patron des questions déjà répondues ;
//   · les deux fenêtres de première lecture : 30 jours de virements, 90 de
//     relevé.

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

const credit = (o: Partial<Transaction> = {}): Transaction => ({
  transaction_amount: { amount: "120.00", currency: "EUR" },
  credit_debit_indicator: "CRDT",
  status: "BOOK",
  booking_date: "2026-10-21",
  debtor: { name: "LALA" },
  remittance_information: ["VIR LALA", "FACTURE F2026-28"],
  ...o,
});
const debit = (o: Partial<Transaction> = {}): Transaction => ({
  transaction_amount: { amount: "62.40", currency: "EUR" },
  credit_debit_indicator: "DBIT",
  status: "BOOK",
  booking_date: "2026-10-14",
  creditor: { name: "TOTALENERGIES" },
  remittance_information: ["CB TOTALENERGIES ST JEAN"],
  ...o,
});

test("une sortie est lue, avec celui qui a été payé", () => {
  const [m] = lireTransactions("compte-1", [debit()]);
  assert.equal(m.sens, "sortie");
  assert.equal(m.montant, "62.40");
  assert.equal(m.contrepartie, "TOTALENERGIES");
  assert.equal(m.libelle, "CB TOTALENERGIES ST JEAN");
  assert.equal(m.date, "2026-10-14");
});

test("une entrée est lue, avec celui qui a payé", () => {
  const [m] = lireTransactions("compte-1", [credit()]);
  assert.equal(m.sens, "entree");
  assert.equal(m.contrepartie, "LALA");
  assert.equal(m.libelle, "VIR LALA FACTURE F2026-28");
});

test("un débit écrit en négatif par la banque reste un montant positif", () => {
  const [m] = lireTransactions("compte-1", [debit({ transaction_amount: { amount: "-62.40", currency: "EUR" } })]);
  assert.equal(m.montant, "62.40");
  assert.equal(m.sens, "sortie");
});

test("une opération en attente n'entre pas, dans aucun sens", () => {
  assert.equal(lireTransactions("c", [debit({ status: "PDNG" }), credit({ status: "PDNG" })]).length, 0);
});

test("une autre monnaie n'entre pas", () => {
  assert.equal(lireTransactions("c", [debit({ transaction_amount: { amount: "10.00", currency: "USD" } })]).length, 0);
});

test("un sens inconnu, un montant nul ou une date absente n'entrent pas", () => {
  assert.equal(lireTransactions("c", [debit({ credit_debit_indicator: "XXXX" })]).length, 0);
  assert.equal(lireTransactions("c", [debit({ transaction_amount: { amount: "0.00", currency: "EUR" } })]).length, 0);
  assert.equal(lireTransactions("c", [debit({ booking_date: undefined, value_date: undefined })]).length, 0);
});

test("sans date d'inscription, la date de valeur sert", () => {
  const [m] = lireTransactions("c", [debit({ booking_date: undefined, value_date: "2026-10-15" })]);
  assert.equal(m.date, "2026-10-15");
});

test("la clé vient de la référence de la banque quand elle existe", () => {
  const [m] = lireTransactions("compte-1", [debit({ entry_reference: " REF-42 " })]);
  assert.equal(m.cle, "compte-1:REF-42");
});

test("la clé d'un virement reçu sans référence est EXACTEMENT celle d'avant le 24 octobre", () => {
  // La formule de `cleDuVirement`, recopiée telle qu'elle était : si elle
  // change, les virements déjà rangés reviennent en questions.
  const attendue = createHash("sha256")
    .update(["compte-1", "2026-10-21", "120.00", "LALA", "VIR LALA FACTURE F2026-28"].join("|"))
    .digest("hex");
  const [m] = lireTransactions("compte-1", [credit()]);
  assert.equal(m.cle, attendue);
});

test("deux comptes, même ligne : deux clés", () => {
  const [a] = lireTransactions("compte-1", [debit()]);
  const [b] = lireTransactions("compte-2", [debit()]);
  assert.notEqual(a.cle, b.cle);
});

test("les virements reçus se déduisent du relevé, les sorties en sont écartées", () => {
  const releve = lireTransactions("c", [credit(), debit()]);
  const v = virementsDesMouvements(releve);
  assert.equal(v.length, 1);
  assert.deepEqual(Object.keys(v[0]).sort(), ["cle", "date", "libelle", "montant", "payeur"]);
  assert.equal(v[0].payeur, "LALA");
  assert.equal(v[0].cle, releve[0].cle);
});

test("première lecture : 90 jours de relevé, 30 de virements", () => {
  const f = fenetresDeLecture(new Date("2026-10-24T12:00:00Z"), null);
  assert.equal(f.releve, "2026-07-26");
  assert.equal(f.virements, "2026-09-24");
});

test("lecture suivante : depuis la dernière, moins trois jours, pour les deux", () => {
  const f = fenetresDeLecture(new Date("2026-10-24T12:00:00Z"), new Date("2026-10-20T12:00:00Z"));
  assert.equal(f.releve, "2026-10-17");
  assert.equal(f.virements, "2026-10-17");
});

test("une dernière lecture très ancienne ne fait pas remonter plus loin que la première fenêtre", () => {
  const f = fenetresDeLecture(new Date("2026-10-24T12:00:00Z"), new Date("2026-01-01T12:00:00Z"));
  assert.equal(f.releve, "2026-07-26");
  assert.equal(f.virements, "2026-09-24");
});

console.log(`\n${passed} réussi(s), ${failed} échoué(s)`);
if (failed > 0) process.exit(1);
