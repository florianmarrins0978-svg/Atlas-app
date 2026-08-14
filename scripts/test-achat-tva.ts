import assert from "node:assert/strict";
import { achatComplet, montantSaisi, tvaDepuisTtc, tvaDue } from "../src/lib/achat-tva";

// La TVA d'un achat, et ce qu'il reste à payer.
//
// **Le défaut que cette suite empêche ne se voit sur aucune capture.** Un
// relevé faux d'un cinquième affiche un total parfaitement plausible : rien,
// à l'écran, ne distingue 20,00 € de 24,00 €. On s'en aperçoit devant le
// comptable, un an plus tard.

let echecs = 0;
function cas(nom: string, f: () => void) {
  try { f(); console.log(`  ✓ ${nom}`); }
  catch (e) { echecs++; console.error(`  ✗ ${nom}\n    ${(e as Error).message}`); }
}

console.log("=== La TVA d'un achat, et le reste à payer ===\n");

// **LE PIÈGE PRINCIPAL.** Un total de ticket est TTC : la taxe est DEDANS.
// 120 × 0,20 = 24 € est le calcul qu'on fait de tête, et il est faux — c'est
// 20 €. Un cinquième d'écart sur chaque ticket, toute l'année.
cas("la TVA se retire d'un total qui la contient, jamais ne s'y ajoute", () => {
  assert.equal(tvaDepuisTtc(120, 20), 20);
  assert.notEqual(tvaDepuisTtc(120, 20), 24);
});

cas("les taux réduits tombent juste", () => {
  assert.equal(tvaDepuisTtc(110, 10), 10);
  assert.equal(tvaDepuisTtc(105.5, 5.5), 5.5);
});

cas("le résultat est arrondi au centime, pas à quatorze décimales", () => {
  const t = tvaDepuisTtc(96, 20);
  assert.equal(t, 16);
  assert.equal(String(t).split(".")[1]?.length ?? 0 <= 2, true);
  assert.equal(tvaDepuisTtc(42.5, 20), 7.08);
});

cas("rien de calculable ne rend rien — jamais zéro", () => {
  assert.equal(tvaDepuisTtc(null, 20), null);
  assert.equal(tvaDepuisTtc(120, null), null);
  assert.equal(tvaDepuisTtc(120, 0), null);
  assert.equal(tvaDepuisTtc(120, -20), null);
  assert.equal(tvaDepuisTtc(-10, 20), null);
  assert.equal(tvaDepuisTtc(NaN, 20), null);
});

// **Zéro serait un mensonge** : il se lit « cet achat n'a pas de TVA », alors
// que la vérité est « on ne sait pas ».
cas("un total nul reste un total, et rend zéro", () => {
  assert.equal(tvaDepuisTtc(0, 20), 0);
});

cas("le reste à payer est une soustraction, arrondie au centime", () => {
  assert.equal(tvaDue(164, 29), 135);
  assert.equal(tvaDue(164.55, 29.33), 135.22);
});

// **Un crédit de TVA est un état NORMAL** — le mois où l'on achète une machine
// sans facturer grand-chose. Le borner à zéro cacherait précisément le mois où
// le patron a le plus besoin de savoir.
cas("un mois plus acheteur que vendeur donne un montant négatif", () => {
  assert.equal(tvaDue(100, 260), -160);
});

cas("un montant se tape comme le patron l'écrit", () => {
  assert.equal(montantSaisi("16,00 €"), 16);
  assert.equal(montantSaisi("16.00"), 16);
  assert.equal(montantSaisi("1 234,50 €"), 1234.5);
  assert.equal(montantSaisi("1 234,50"), 1234.5);
  assert.equal(montantSaisi("  7,08  "), 7.08);
});

cas("ce qui n'est pas un nombre ne devient pas zéro", () => {
  assert.equal(montantSaisi(""), null);
  assert.equal(montantSaisi("   "), null);
  assert.equal(montantSaisi("€"), null);
  assert.equal(montantSaisi("abc"), null);
  assert.equal(montantSaisi(null), null);
  assert.equal(montantSaisi(undefined), null);
});

// **Le fournisseur et la TVA suffisent.** Un ticket qui n'affiche que
// « TVA 3,20 € » doit pouvoir être enregistré : exiger le total reviendrait à
// refuser l'achat, et un achat refusé est un achat perdu.
cas("un achat tient avec un fournisseur et une TVA, sans le total", () => {
  assert.equal(achatComplet("Station Total", 3.2), true);
  assert.equal(achatComplet("Station Total", 0), true);
});

cas("sans fournisseur ou sans TVA, l'achat n'est pas enregistrable", () => {
  assert.equal(achatComplet("", 16), false);
  assert.equal(achatComplet("   ", 16), false);
  assert.equal(achatComplet("Station Total", null), false);
  assert.equal(achatComplet("Station Total", -1), false);
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} TVA d'un achat — ${echecs} échec(s).`);
if (echecs > 0) process.exit(1);
