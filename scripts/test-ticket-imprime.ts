import assert from "node:assert/strict";
import { LIGNES_MAX, ligneDuTotal, lignesImprimees, montantEcrit } from "../src/lib/ticket-imprime";

// POUR MON COMPTABLE, LOT 5 — le ticket recopié ligne par ligne. Les lignes
// viennent de son vrai ticket Intermarché du 22 octobre 2026.

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

const INTERMARCHE = [
  { g: "SAS MAFICAL", d: null },
  { g: "REAL THAI LAIT COCO", d: "1,66 EUR A" },
  { g: "REAL THAI LAIT COCO", d: "1,66 EUR A" },
  { g: "REAL THAI LAIT COCO", d: "1,66 EUR A" },
  { g: "MONTANT DU", d: "30,12 EUR" },
  { g: "ESPECES", d: "50,00 EUR" },
  { g: "TOTAL ELIGIBLE TRD", d: "30,12 EUR" },
  { g: "A RENDRE", d: "19,88 EUR" },
];

test("chaque ligne reste, même les doublons : rien ne se regroupe", () => {
  const l = lignesImprimees(INTERMARCHE);
  assert.ok(l);
  assert.equal(l.length, 8);
  assert.equal(l.filter((x) => x.gauche === "REAL THAI LAIT COCO").length, 3);
});

test("une ligne d'un seul tenant, ou rendue par le formulaire, se lit aussi", () => {
  assert.deepEqual(lignesImprimees(["Merci de votre visite", { gauche: "TOTAL", droite: "12,00" }]), [
    { gauche: "Merci de votre visite", droite: null },
    { gauche: "TOTAL", droite: "12,00" },
  ]);
});

test("ce qui n'est pas une liste de lignes ne rend rien", () => {
  assert.equal(lignesImprimees(null), null);
  assert.equal(lignesImprimees("TOTAL 12,00"), null);
  assert.equal(lignesImprimees([]), null);
  assert.equal(lignesImprimees([{ g: " ", d: "null" }, 42]), null);
});

test("une lecture qui boucle est bornée, et une ligne trop longue coupée", () => {
  const l = lignesImprimees(Array.from({ length: 500 }, (_, i) => `ligne ${i}`));
  assert.equal(l?.length, LIGNES_MAX);
  assert.equal(lignesImprimees(["x".repeat(300)])?.[0].gauche.length, 80);
  assert.deepEqual(lignesImprimees(["A\nB\u0007C"]), [{ gauche: "A B C", droite: null }]);
});

test("les montants écrits se lisent au centime", () => {
  assert.equal(montantEcrit("30,12 EUR"), 3012);
  assert.equal(montantEcrit("18,90 €"), 1890);
  assert.equal(montantEcrit("1 194,00"), 119400);
  assert.equal(montantEcrit("-19,88 EUR"), -1988);
  assert.equal(montantEcrit("0,675 kg"), null);
  assert.equal(montantEcrit("TOTAL"), null);
});

test("la ligne du total est celle qui le DIT, pas la première qui tombe juste", () => {
  const l = lignesImprimees([{ g: "SOUS-TOTAL", d: "18,90" }, { g: "Montant payé", d: "18,90 €" }])!;
  assert.equal(ligneDuTotal(l, 18.9), 1);
  assert.equal(ligneDuTotal(lignesImprimees(INTERMARCHE)!, 30.12), 4);
});

test("sans total, ou sans ligne qui tombe juste, rien ne se surligne", () => {
  const l = lignesImprimees(INTERMARCHE)!;
  assert.equal(ligneDuTotal(l, null), -1);
  assert.equal(ligneDuTotal(l, 99.99), -1);
});

console.log(`\n${passed} réussi(s), ${failed} échoué(s)`);
if (failed > 0) process.exit(1);
