/* La somme de ce qui reste à recevoir, sur « Non payées » (planche du
   31 octobre 2026, `appli/soignee/termines-non-payees.html`) : au centime,
   jamais l'addition de flottants. */
import assert from "node:assert/strict";
import { sommeDesMontants } from "../src/lib/euros";

let echecs = 0;
function cas(nom: string, f: () => void) {
  try {
    f();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

console.log("=== La somme des montants ===\n");
cas("trois factures de la démonstration font 4 270,80 €", () => {
  assert.equal(sommeDesMontants(["1140.00", "1140.00", "1990.80"]), "4270.80");
});
cas("au centime : 0,1 + 0,2 font 0,30, pas 0,30000000000000004", () => {
  assert.equal(sommeDesMontants(["0.10", "0.20"]), "0.30");
  // Le témoin : l'addition de flottants, elle, se trompe.
  assert.notEqual(String(0.1 + 0.2), "0.3");
});
cas("rien à recevoir : zéro, jamais une case vide", () => {
  assert.equal(sommeDesMontants([]), "0.00");
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} La somme des montants : ${echecs} échec(s).`);
process.exitCode = echecs === 0 ? 0 : 1;
