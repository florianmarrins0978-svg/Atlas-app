import assert from "node:assert/strict";
import {
  PHOTOS_MAX_PAR_CHANTIER,
  PHOTOS_MAX_PAR_RETOUR,
  PHOTOS_PAR_SELECTION,
  limiterLaSelection,
  placesRestantes,
  refusDesPhotosDuRetour,
  refusDuPlafondDuChantier,
} from "../src/lib/photos-plafonds";

/**
 * LES PLAFONDS DE PHOTOS — la règle pure, sans base ni écran.
 *
 * **Ses trois chiffres du 20 septembre 2026** (15 par sélection sur la
 * pellicule, 10 sur le retour et par retour, 30 par chantier) sont tenus ici
 * par les valeurs qu'il a validées : les changer se voit, et se discute avec
 * lui.
 */

let echecs = 0;
function cas(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

console.log("=== Les plafonds de photos ===\n");

cas("ses trois chiffres, tels qu'il les a validés", () => {
  assert.equal(PHOTOS_PAR_SELECTION.pellicule, 15);
  assert.equal(PHOTOS_PAR_SELECTION.retour, 10);
  assert.equal(PHOTOS_MAX_PAR_RETOUR, 10);
  assert.equal(PHOTOS_MAX_PAR_CHANTIER, 30);
});

cas("les places restantes ne descendent jamais sous zéro", () => {
  assert.equal(placesRestantes(0, 30), 30);
  assert.equal(placesRestantes(29, 30), 1);
  assert.equal(placesRestantes(30, 30), 0);
  assert.equal(placesRestantes(31, 30), 0);
});

cas("la 31e photo d'un chantier est refusée, la 30e passe", () => {
  assert.equal(refusDuPlafondDuChantier(29), null);
  assert.match(refusDuPlafondDuChantier(30)!, /30 photos au plus par chantier/);
});

cas("un retour à 11 photos est refusé, à 10 il part", () => {
  assert.equal(refusDesPhotosDuRetour(10), null);
  assert.match(refusDesPhotosDuRetour(11)!, /10 photos au plus par retour/);
});

cas("une sélection sous les bornes passe entière, sans un mot", () => {
  const r = limiterLaSelection(["a", "b", "c"], { parSelection: 15, restantesSurLeChantier: 30 });
  assert.deepEqual(r, { retenues: ["a", "b", "c"], raison: null });
});

cas("une sélection trop large est coupée à la borne, dans SON ordre, et le dit", () => {
  const choisies = Array.from({ length: 17 }, (_, i) => `p${i}`);
  const r = limiterLaSelection(choisies, { parSelection: 15, restantesSurLeChantier: 30 });
  assert.equal(r.retenues.length, 15);
  assert.equal(r.retenues[0], "p0");
  assert.equal(r.retenues[14], "p14");
  assert.match(r.raison!, /15 photos au plus à la fois/);
});

cas("ce qui reste sur le chantier prime sur la borne de sélection, et la phrase le nomme", () => {
  const r = limiterLaSelection(["a", "b", "c", "d"], { parSelection: 15, restantesSurLeChantier: 2 });
  assert.deepEqual(r.retenues, ["a", "b"]);
  assert.match(r.raison!, /2 photos de plus au maximum sur ce chantier \(30 en tout\)/);
});

cas("un chantier plein ne prend rien, et dit le plafond", () => {
  const r = limiterLaSelection(["a"], { parSelection: 15, restantesSurLeChantier: 0 });
  assert.deepEqual(r.retenues, []);
  assert.match(r.raison!, /30 photos au plus par chantier/);
});

cas("une seule place restante s'écrit au singulier", () => {
  const r = limiterLaSelection(["a", "b"], { parSelection: 10, restantesSurLeChantier: 1 });
  assert.match(r.raison!, /^1 photo de plus au maximum/);
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} Les plafonds de photos — ${echecs} échec(s).`);
if (echecs > 0) process.exit(1);
