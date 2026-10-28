import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { fenetresDeLecture, lireToutesLesPages, lireTransactions, virementsDesMouvements, type PageReleve, type Transaction } from "../src/lib/releve-bancaire";

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
// Un test peut être asynchrone : sans l'attendre, un rejet non géré passerait
// pour un vert, et la suite mentirait.
const enCours: Promise<void>[] = [];
function test(nom: string, fn: () => void | Promise<void>) {
  const verdict = async () => {
    try {
      await fn();
      console.log(`✅ ${nom}`);
      passed++;
    } catch (err) {
      console.error(`❌ ${nom}`);
      console.error(`   ${err instanceof Error ? err.message : err}`);
      failed++;
    }
  };
  enCours.push(verdict());
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

test("la fenêtre de relevé part du début du dossier en cours, et jamais d'une date de lecture", () => {
  // Le dossier du 1er janvier doit être lu depuis le 1er janvier : une fenêtre
  // de 90 jours y laissait janvier à juillet sans jamais les relire.
  const f = fenetresDeLecture(new Date("2026-10-24T12:00:00Z"), "2026-01-01");
  assert.equal(f.releve, "2026-01-01");
});

test("la fenêtre ne dépend d'aucune date de dernière lecture : une lecture en échec ne peut plus creuser un trou", () => {
  // Avant : chaque tentative, même refusée, avançait la date de lecture, et la
  // suivante ne remontait que trois jours avant elle. Les jours entre la
  // dernière lecture réussie et la reprise étaient perdus.
  // Dossier commencé le 1er octobre, aujourd'hui le 24 : la marge de trente
  // jours remonte plus tôt que le dossier, et c'est elle qui fixe le début.
  const f = fenetresDeLecture(new Date("2026-10-24T12:00:00Z"), "2026-10-01");
  assert.equal(f.releve, "2026-09-24");
});

test("le relevé remonte d'au moins trente jours, pour rattraper une opération inscrite avec retard", () => {
  // Une fin de dossier récente : la marge de trente jours ramène quand même la
  // lecture avant la date de début, et le recouvrement est sans effet (clé).
  const f = fenetresDeLecture(new Date("2026-10-24T12:00:00Z"), "2026-10-20");
  assert.equal(f.releve, "2026-09-24");
});

test("les virements à répondre : trente jours, toujours depuis aujourd'hui", () => {
  const f = fenetresDeLecture(new Date("2026-10-24T12:00:00Z"), "2026-01-01");
  assert.equal(f.virements, "2026-09-24");
});

test("deux opérations identiques le même jour, sans référence, restent DEUX lignes", () => {
  // Deux pleins d'essence au même montant, même libellé, même jour : la clé
  // d'empreinte était la même, et la base n'en gardait qu'une.
  const plein = debit({ transaction_amount: { amount: "12.50", currency: "EUR" }, remittance_information: ["CB STATION"] });
  const lues = lireTransactions("compte-1", [plein, { ...plein }]);
  assert.equal(lues.length, 2);
  assert.equal(new Set(lues.map((m) => m.cle)).size, 2);
});

test("la première occurrence garde la clé d'avant, seule la répétition reçoit un rang", () => {
  const plein = debit({ transaction_amount: { amount: "12.50", currency: "EUR" }, remittance_information: ["CB STATION"] });
  const [unique] = lireTransactions("compte-1", [plein]);
  const [premier] = lireTransactions("compte-1", [plein, { ...plein }]);
  assert.equal(premier.cle, unique.cle);
});

test("les lignes identiques restent distinctes d'une lecture à l'autre, dans le même ordre", () => {
  const plein = debit({ transaction_amount: { amount: "12.50", currency: "EUR" }, remittance_information: ["CB STATION"] });
  const premiere = lireTransactions("compte-1", [plein, { ...plein }]).map((m) => m.cle);
  assert.equal(new Set(premiere).size, 2);
  const seconde = lireTransactions("compte-1", [plein, { ...plein }, debit({ booking_date: "2026-10-22" })]).map((m) => m.cle);
  assert.deepEqual(seconde.slice(0, 2), premiere);
});

test("toutes les pages sont lues, dans l'ordre, sans en perdre une", async () => {
  const pages: Record<string, PageReleve> = {
    "": { transactions: [debit({ entry_reference: "A" })], continuation_key: "p2" },
    p2: { transactions: [debit({ entry_reference: "B" })], continuation_key: "p3" },
    p3: { transactions: [debit({ entry_reference: "C" })], continuation_key: null },
  };
  const r = await lireToutesLesPages(async (suite) => ({ ok: true, ...pages[suite ?? ""] }));
  assert.equal(r.ok, true);
  if (r.ok) assert.deepEqual(r.transactions.map((t) => t.entry_reference), ["A", "B", "C"]);
});

test("une banque qui ne finit jamais de paginer fait échouer la lecture, au lieu de rendre une partie", async () => {
  // Avant : dix pages puis arrêt silencieux, et la lecture était marquée faite.
  const r = await lireToutesLesPages(async () => ({ ok: true, transactions: [debit()], continuation_key: "encore" }));
  assert.equal(r.ok, false);
});

test("une erreur en cours de pagination ne rend aucune partie du relevé", async () => {
  let appel = 0;
  const r = await lireToutesLesPages(async () => {
    appel++;
    if (appel === 1) return { ok: true, transactions: [debit()], continuation_key: "p2" };
    return { ok: false, raison: "Enable Banking a refusé (500)." };
  });
  assert.equal(r.ok, false);
  assert.equal("transactions" in r, false);
});

Promise.all(enCours).then(() => {
  console.log(`\n${passed} réussi(s), ${failed} échoué(s)`);
  if (failed > 0) process.exit(1);
});
