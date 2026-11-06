// La nature d'une absence : sans base de données.

import assert from "node:assert/strict";
import { compteTravaille, LIBELLE_NATURE, natureLue, NATURES_ABSENCE, phraseDuCompte } from "../src/lib/nature-absence";

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

console.log("=== La nature d'une absence ===");

essai("six natures, chacune avec son mot", () => {
  assert.equal(NATURES_ABSENCE.length, 6);
  for (const n of NATURES_ABSENCE) assert.ok(LIBELLE_NATURE[n]);
});

essai("un déplacement et une formation comptent travaillés, rien d'autre", () => {
  assert.equal(compteTravaille("deplacement"), true);
  assert.equal(compteTravaille("formation"), true);
  for (const n of ["conge", "maladie", "sans_solde", "autre"] as const) assert.equal(compteTravaille(n), false);
  // Sans nature : absent. Un jour payé à tort ne se verrait jamais.
  assert.equal(compteTravaille(null), false);
});

essai("une valeur inconnue ne devient pas une nature", () => {
  assert.equal(natureLue("conge"), "conge");
  assert.equal(natureLue("vacances"), null);
  assert.equal(natureLue(""), null);
  assert.equal(natureLue(undefined), null);
  assert.equal(natureLue(3), null);
});

essai("la phrase sous les motifs, et rien sans motif", () => {
  assert.equal(phraseDuCompte("formation"), "Compté travaillé.");
  assert.equal(phraseDuCompte("maladie"), "Compté absent.");
  assert.equal(phraseDuCompte(null), null);
});

if (echecs) {
  console.log(`\n❌ ${echecs} échec(s).`);
  process.exit(1);
}
console.log("\n✅ La nature d'une absence se lit juste.");
