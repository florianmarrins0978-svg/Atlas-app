// Les jours fériés : sans base de données.
//
// Pâques se vérifie sur des dates connues, dont les deux bornes extrêmes du
// calendrier (le 22 mars et le 25 avril) : une formule qui tient en 2026 mais
// glisse en 2038 marquerait faux l'Ascension et la Pentecôte cette année-là,
// et personne ne le verrait avant.

import assert from "node:assert/strict";
import { dimancheDePaques, estEnAlsaceMoselle, feriesDeLAnnee, nomDuFerie } from "../src/lib/jours-feries";

let echecs = 0;
function essai(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}`);
    console.log(`    ${(e as Error).message}`);
  }
}

console.log("=== Les jours fériés ===");

essai("Pâques tombe juste, bornes du calendrier comprises", () => {
  assert.equal(dimancheDePaques(2026), "2026-04-05");
  assert.equal(dimancheDePaques(2027), "2027-03-28");
  assert.equal(dimancheDePaques(2024), "2024-03-31");
  assert.equal(dimancheDePaques(2025), "2025-04-20");
  assert.equal(dimancheDePaques(2038), "2038-04-25");
  assert.equal(dimancheDePaques(2285), "2285-03-22");
});

essai("onze fériés partout, treize en Alsace et en Moselle", () => {
  assert.equal(feriesDeLAnnee(2026).size, 11);
  assert.equal(feriesDeLAnnee(2026, true).size, 13);
});

essai("les fériés de 2026 et de 2027 qui suivent Pâques", () => {
  assert.equal(nomDuFerie("2026-04-06"), "Lundi de Pâques");
  assert.equal(nomDuFerie("2026-05-14"), "Ascension");
  assert.equal(nomDuFerie("2026-05-25"), "Lundi de Pentecôte");
  assert.equal(nomDuFerie("2027-05-06"), "Ascension");
  assert.equal(nomDuFerie("2027-05-17"), "Lundi de Pentecôte");
});

essai("le 11 novembre est l'Armistice, le 12 n'est rien", () => {
  assert.equal(nomDuFerie("2026-11-11"), "Armistice 1918");
  assert.equal(nomDuFerie("2026-11-12"), null);
});

essai("le Vendredi saint et le 26 décembre ne valent qu'en Alsace et en Moselle", () => {
  assert.equal(nomDuFerie("2026-04-03"), null);
  assert.equal(nomDuFerie("2026-04-03", true), "Vendredi saint");
  assert.equal(nomDuFerie("2026-12-26"), null);
  assert.equal(nomDuFerie("2026-12-26", true), "Saint-Étienne");
});

essai("l'Alsace et la Moselle se lisent au code postal, et seulement là", () => {
  assert.equal(estEnAlsaceMoselle("3 rue Serpenoise, 57000 Metz"), true);
  assert.equal(estEnAlsaceMoselle("10 place Kléber, 67000 Strasbourg"), true);
  assert.equal(estEnAlsaceMoselle("1 rue des Clefs, 68000 Colmar"), true);
  assert.equal(estEnAlsaceMoselle("10 rue des Artisans, 44000 Nantes"), false);
  // Sans code postal, la liste nationale : le côté sûr.
  assert.equal(estEnAlsaceMoselle("Derrière l'église"), false);
  assert.equal(estEnAlsaceMoselle(null), false);
});

if (echecs) {
  console.log(`\n❌ ${echecs} échec(s).`);
  process.exit(1);
}
console.log("\n✅ Les jours fériés tombent juste.");
