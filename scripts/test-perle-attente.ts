import assert from "node:assert/strict";
import { chantierQuiPorteLaPerle } from "../src/lib/perle-attente";

// La perle du fil des chantiers : le seul point de couleur de l'écran retenu
// le 10 août 2026, et il ne se pose que sur ce qui réclame un geste du patron.
//
// **Ces cas ne s'atteignent pas en cliquant.** Le jeu de démonstration du banc
// ne contient aucun chantier en attente : la perle n'y apparaît jamais, et son
// absence ne prouve donc rien. C'est ici qu'on éprouve la règle.

let echecs = 0;
function cas(nom: string, verifier: () => void) {
  try {
    verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

const brin = (id: string, attend = false) => ({ id, attend });

console.log("=== Où se pose la perle ===");

cas("aucun chantier : aucune perle", () => {
  assert.equal(chantierQuiPorteLaPerle([]), null);
});

cas("aucun chantier en attente : aucune perle", () => {
  // Le cas du banc, précisément. Une perle posée par défaut sur le premier
  // chantier ferait croire à un geste attendu qui n'existe pas.
  assert.equal(chantierQuiPorteLaPerle([brin("a"), brin("b")]), null);
});

cas("un seul en attente : la perle est dessus, où qu'il soit", () => {
  assert.equal(chantierQuiPorteLaPerle([brin("a"), brin("b", true), brin("c")]), "b");
  assert.equal(chantierQuiPorteLaPerle([brin("a", true), brin("b")]), "a");
  assert.equal(chantierQuiPorteLaPerle([brin("a"), brin("b"), brin("c", true)]), "c");
});

cas("plusieurs en attente : UNE perle, sur le premier", () => {
  // Une par chantier en attente ne désignerait plus rien : l'écran
  // redeviendrait le tableau de bord que le patron refuse.
  assert.equal(chantierQuiPorteLaPerle([brin("a"), brin("b", true), brin("c", true)]), "b");
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} Perle d'attente — ${echecs} échec(s).`);
if (echecs > 0) process.exit(1);
