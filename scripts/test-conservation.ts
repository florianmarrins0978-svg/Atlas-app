import assert from "node:assert/strict";
import { archiveEchue, echeanceConservation } from "../src/lib/conservation";

// Jusqu'à quand une pièce se garde, et quand l'archive d'un compte fermé est
// échue (6 novembre 2026). Le côté qui compte : JAMAIS avant le terme légal.

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
const j = (iso: string) => new Date(`${iso}T12:00:00Z`);

cas("une facture de janvier 2026 se garde jusqu'au 31 décembre 2037", () => {
  assert.equal(echeanceConservation(j("2026-01-03"), 10).toISOString().slice(0, 10), "2037-12-31");
});

cas("même année, même terme, quel que soit le mois", () => {
  assert.equal(echeanceConservation(j("2026-12-30"), 10).toISOString(), echeanceConservation(j("2026-01-03"), 10).toISOString());
});

cas("jamais avant dix ans après la fin de l'année de la pièce, le terme d'un exercice civil", () => {
  for (const iso of ["2026-01-01", "2026-06-15", "2026-12-31"]) {
    assert.ok(echeanceConservation(j(iso), 10).getTime() >= Date.UTC(2036, 11, 31), iso);
  }
});

cas("une archive sans aucune pièce datée n'est pas échue : on ne conclut pas", () => {
  assert.equal(archiveEchue([], j("2090-01-01")), false);
});

cas("l'archive attend sa DERNIÈRE pièce", () => {
  const ech = [echeanceConservation(j("2020-05-01"), 10), echeanceConservation(j("2026-03-01"), 10)];
  assert.equal(archiveEchue(ech, j("2031-12-31")), false);
  assert.equal(archiveEchue(ech, j("2037-12-31")), false, "le dernier jour de conservation, rien ne part");
  assert.equal(archiveEchue(ech, j("2038-01-01")), true);
});

console.log(`\n${echecs === 0 ? "✅ 0 échec" : `❌ ${echecs} échec(s)`}`);
process.exit(echecs === 0 ? 0 : 1);
