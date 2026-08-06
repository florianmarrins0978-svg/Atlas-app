import assert from "node:assert/strict";
import { memeAdresse } from "../src/lib/adresses";

// **Une même rue ne s'imprime pas deux fois sur un devis.**
//
// Le 6 août 2026, le patron a créé un chantier en renseignant l'adresse des
// travaux et en laissant vide « adresse du client — si différente de l'adresse
// du chantier ». Sur son devis, le client apparaissait sans adresse, et la rue
// resurgissait tout en bas, nue, sans étiquette : « l'adresse n'est pas au bon
// endroit ».
//
// La règle éprouvée ici décide si les deux adresses désignent le même endroit.
// Elle sert **à deux endroits** — l'écran du devis et le PDF que le client
// reçoit — et c'est pour cela qu'elle est une fonction et non deux conditions
// recopiées (`CLAUDE.md` §3).

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

console.log("=== Deux adresses désignent-elles le même endroit ? ===");

cas("mot pour mot : la même", () => {
  assert.equal(memeAdresse("10 rue Denfert, Mantes", "10 rue Denfert, Mantes"), true);
});

cas("une majuscule ne fait pas une seconde adresse", () => {
  assert.equal(memeAdresse("10 RUE DENFERT, MANTES", "10 rue denfert, mantes"), true);
});

cas("un espace ou une virgule de plus non plus", () => {
  // Le cas réel : la même adresse tapée deux fois, à deux moments.
  assert.equal(memeAdresse("10 rue denfert rochereau 78200 mantes la jolie", "10 rue Denfert-Rochereau, 78200  Mantes-la-Jolie"), false);
  assert.equal(memeAdresse(" 10 rue des Lilas , Nantes ", "10 rue des Lilas, Nantes"), true);
});

cas("deux rues différentes restent deux adresses", () => {
  assert.equal(memeAdresse("10 rue des Lilas, Nantes", "12 rue des Lilas, Nantes"), false);
  assert.equal(memeAdresse("10 rue des Lilas, Nantes", "10 rue des Roses, Nantes"), false);
});

cas("deux absences ne sont PAS « la même adresse »", () => {
  // Sinon un devis sans aucune adresse masquerait la ligne qu'il faut
  // justement proposer de remplir.
  assert.equal(memeAdresse("", ""), false);
  assert.equal(memeAdresse(null, undefined), false);
  assert.equal(memeAdresse("   ", null), false);
});

cas("une adresse présente et une absente diffèrent", () => {
  assert.equal(memeAdresse("10 rue des Lilas", ""), false);
  assert.equal(memeAdresse("", "10 rue des Lilas"), false);
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} Comparaison d'adresses — ${echecs} échec(s).`);
if (echecs > 0) process.exit(1);
