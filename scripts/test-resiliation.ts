// Partir : les raisons, la formule moins chère, le texte, et le remboursement
// d'un refus de nouvelles conditions (`src/lib/resiliation.ts`).
import assert from "node:assert/strict";
import {
  RAISONS_DEPART,
  TEXTE_DEPART_MAX,
  estRaisonDepart,
  formuleMoinsChere,
  remboursementAuProrata,
  texteDeDepart,
} from "../src/lib/resiliation";

let echecs = 0;
function cas(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`❌ ${nom}\n   ${e instanceof Error ? e.message : e}`);
  }
}

cas("trois raisons, les mots de la planche", () => {
  assert.deepEqual(
    RAISONS_DEPART.map((r) => r.libelle),
    ["C’est trop cher", "Je ne m’en sers pas assez", "Il me manque quelque chose"]
  );
  assert.ok(estRaisonDepart("trop_cher"));
  assert.ok(!estRaisonDepart("autre"));
  assert.ok(!estRaisonDepart(null));
});

cas("la formule juste en dessous, et rien sous Artisan", () => {
  assert.equal(formuleMoinsChere("entreprise")?.code, "artisan");
  assert.equal(formuleMoinsChere("illimite")?.code, "entreprise");
  assert.equal(formuleMoinsChere("artisan"), null);
});

cas("le texte libre : vide vaut rien, et il est borné", () => {
  assert.equal(texteDeDepart("   "), null);
  assert.equal(texteDeDepart(undefined), null);
  assert.equal(texteDeDepart("  la facturation en anglais "), "la facturation en anglais");
  assert.equal(texteDeDepart("x".repeat(2000))?.length, TEXTE_DEPART_MAX);
});

const PAYE_ANNUEL_ENTREPRISE = 70800; // 590 € HT, 708 € TTC

cas("l'exemple de la planche : refusé le 18 octobre, payé jusqu'au 18 avril, 6 mois, 354 € TTC", () => {
  const r = remboursementAuProrata({
    payeCentimes: PAYE_ANNUEL_ENTREPRISE,
    periodicite: "annuelle",
    finDePeriode: new Date("2027-04-18T10:00:00Z"),
    maintenant: new Date("2026-10-18T10:00:00Z"),
  });
  assert.deepEqual(r, { moisNonUtilises: 6, centimes: 35400 });
});

cas("le mois commencé n'est pas rendu : la veille de l'échéance mensuelle, cinq", () => {
  const r = remboursementAuProrata({
    payeCentimes: PAYE_ANNUEL_ENTREPRISE,
    periodicite: "annuelle",
    finDePeriode: new Date("2027-04-17T10:00:00Z"),
    maintenant: new Date("2026-10-18T10:00:00Z"),
  });
  assert.equal(r?.moisNonUtilises, 5);
});

cas("au mois, le mois en cours a servi : rien à rendre", () => {
  const r = remboursementAuProrata({
    payeCentimes: 7080,
    periodicite: "mensuelle",
    finDePeriode: new Date("2026-11-10T10:00:00Z"),
    maintenant: new Date("2026-10-18T10:00:00Z"),
  });
  assert.deepEqual(r, { moisNonUtilises: 0, centimes: 0 });
});

cas("jamais plus que ce qui a été payé, même avec une date de fin aberrante", () => {
  const r = remboursementAuProrata({
    payeCentimes: PAYE_ANNUEL_ENTREPRISE,
    periodicite: "annuelle",
    finDePeriode: new Date("2030-01-01T00:00:00Z"),
    maintenant: new Date("2026-10-18T10:00:00Z"),
  });
  assert.equal(r?.centimes, PAYE_ANNUEL_ENTREPRISE);
});

cas("période déjà finie : zéro", () => {
  const r = remboursementAuProrata({
    payeCentimes: PAYE_ANNUEL_ENTREPRISE,
    periodicite: "annuelle",
    finDePeriode: new Date("2026-10-01T00:00:00Z"),
    maintenant: new Date("2026-10-18T10:00:00Z"),
  });
  assert.deepEqual(r, { moisNonUtilises: 0, centimes: 0 });
});

cas("sans date de fin, on ne calcule pas : un montant deviné ne part pas sur une carte", () => {
  assert.equal(
    remboursementAuProrata({ payeCentimes: 1000, periodicite: "annuelle", finDePeriode: null, maintenant: new Date() }),
    null
  );
});

cas("une fin de mois : du 31 janvier au 30 avril, deux mois entiers, pas trois", () => {
  const r = remboursementAuProrata({
    payeCentimes: 12000,
    periodicite: "annuelle",
    finDePeriode: new Date("2027-04-30T00:00:00Z"),
    maintenant: new Date("2027-01-31T00:00:00Z"),
  });
  assert.equal(r?.moisNonUtilises, 2);
});

if (echecs > 0) process.exit(1);
