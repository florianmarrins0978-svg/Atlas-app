import assert from "node:assert/strict";
import { phraseDesDates, phraseDuManque, prixDesFournisseurs, totalDuPlan, type PieceDuPlan } from "../src/lib/arrosage/prix-du-plan";

// Les prix d'achat de ses fournisseurs sur le plan (`src/lib/arrosage/prix-du-plan.ts`) :
// par référence, jamais par un nom voisin ; le moins cher pièce par pièce ;
// un total indicatif qui ne compte jamais une pièce sans prix.

let passed = 0;
let failed = 0;
function test(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ ${nom}`);
    passed++;
  } catch (err) {
    console.error(`❌ ${nom}\n   ${err instanceof Error ? err.message : err}`);
    failed++;
  }
}

const pieces: PieceDuPlan[] = [
  { ref: "RA3504", nom: "Turbine 3504", q: 13, u: "u", reference: "RA3504" },
  { ref: "te-taraude-25-34-25", nom: "Plasson Té 90° taraudé 25×3/4\"×25", q: 14, u: "u", reference: "OPL71402520" },
  { ref: "pe25", nom: "PEHD Ø25", q: 83, u: "ml", reference: null },
];
const fournisseurs = [
  { id: "a", nom: "Aqua Plus" },
  { id: "f", nom: "France Bonhomme" },
];
const achats = [
  { societeId: "a", societeNom: "Aqua Plus", reference: "RA 3504", nom: "Turbine Rain Bird", prixHt: "12.40", releveLe: "2026-10-19" },
  { societeId: "f", societeNom: "France Bonhomme", reference: "RA3504", nom: "3504", prixHt: "11.90", releveLe: "2026-10-12" },
  { societeId: "a", societeNom: "Aqua Plus", reference: null, nom: "pehd ø25", prixHt: "0.80", releveLe: "2026-10-19" },
  // Un nom voisin, sans référence : il ne doit PAS prendre le prix du té taraudé.
  { societeId: "a", societeNom: "Aqua Plus", reference: null, nom: "Plasson Té 90° 25×25×25", prixHt: "2.10", releveLe: "2026-10-19" },
];

test("par référence (espaces et casse mis à part), sinon par nom identique, jamais par un nom voisin", () => {
  const [a] = prixDesFournisseurs(pieces, achats, fournisseurs);
  assert.deepEqual(Object.keys(a.prix).sort(), ["RA3504", "pe25"]);
});

test("le moins cher pièce par pièce, et le total indicatif ne compte que les pièces chiffrées", () => {
  const t = totalDuPlan(pieces, prixDesFournisseurs(pieces, achats, fournisseurs), "moins");
  assert.equal(t.lignes[0].prix?.de, "France Bonhomme");
  assert.equal(t.lignes[0].prix?.montant, "154.70");
  assert.equal(t.lignes[2].prix?.montant, "66.40");
  assert.equal(t.total, "221.10");
  assert.equal(t.sansPrix, 1);
  assert.equal(phraseDuManque(t), "1 pièce sans prix sur 3, le total ne les compte pas.");
  assert.equal(phraseDesDates(t), "Prix France Bonhomme du 12/10/2026. Prix Aqua Plus du 19/10/2026. Ils ont pu changer.");
});

test("chez un seul fournisseur, ses prix à lui", () => {
  const t = totalDuPlan(pieces, prixDesFournisseurs(pieces, achats, fournisseurs), "a");
  assert.equal(t.lignes[0].prix?.montant, "161.20");
  assert.equal(t.total, "227.60");
});

test("aucun prix : aucun total, jamais 0 €", () => {
  const t = totalDuPlan(pieces, prixDesFournisseurs(pieces, [], fournisseurs), "moins");
  assert.equal(t.total, null);
  assert.equal(phraseDesDates(t), "Aucun prix encore.");
  assert.equal(phraseDuManque(t), "3 pièces sans prix sur 3, le total ne les compte pas.");
});

test("une longueur à mesurer ne se chiffre pas", () => {
  const t = totalDuPlan([{ ...pieces[2], q: 0 }], prixDesFournisseurs(pieces, achats, fournisseurs), "moins");
  assert.equal(t.total, null);
});

console.log(`\n${passed} test(s) réussi(s), ${failed} échoué(s).`);
if (failed > 0) process.exit(1);
