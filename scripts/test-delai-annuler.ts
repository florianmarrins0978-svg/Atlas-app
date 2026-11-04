import assert from "node:assert/strict";
import { ANNULER_PENDANT_MS, MARGE_RESEAU_ANNULER_MS, annulationAdmise, resteAAnnuler } from "../src/lib/delai-annuler";
import { envoiAReprendre } from "../src/lib/import-pieces";

// LE TEMPS D'UN « ANNULER », sans base ni navigateur — 3 novembre 2026.
//
// Sa capture : « 48 documents rangés, Annuler » ne partait jamais. Ces règles
// disent combien de temps « Annuler » se montre, jusqu'où le serveur l'accepte
// encore, et ce que l'écran d'import reprend une fois ce temps passé.
// `test-pieces-importees-db.ts` les éprouve sur de vrais envois.

let echecs = 0;
function cas(nom: string, f: () => void) {
  try {
    f();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}\n    ${e instanceof Error ? e.message : String(e)}`);
  }
}

const geste = new Date("2026-11-03T18:00:00.000Z");
const apres = (ms: number) => geste.getTime() + ms;

cas("six secondes, une seule fois pour toute l'appli", () => {
  assert.equal(ANNULER_PENDANT_MS, 6000);
});

cas("« Annuler » se montre six secondes, puis plus du tout", () => {
  assert.equal(resteAAnnuler(geste, apres(0)), 6000);
  assert.equal(resteAAnnuler(geste, apres(5999)), 1);
  assert.equal(resteAAnnuler(geste, apres(6000)), null);
  assert.equal(resteAAnnuler(geste, apres(60_000)), null);
});

cas("une horloge qui recule ne prolonge pas la fenêtre", () => {
  assert.equal(resteAAnnuler(geste, apres(-30_000)), ANNULER_PENDANT_MS);
});

cas("le serveur prend encore l'appui parti à temps, et plus au-delà de la marge", () => {
  assert.equal(annulationAdmise(geste, apres(ANNULER_PENDANT_MS + 1)), true, "l'appui de la dernière seconde est refusé");
  assert.equal(annulationAdmise(geste, apres(ANNULER_PENDANT_MS + MARGE_RESEAU_ANNULER_MS)), true);
  assert.equal(annulationAdmise(geste, apres(ANNULER_PENDANT_MS + MARGE_RESEAU_ANNULER_MS + 1)), false, "un onglet endormi annule encore");
});

const etat = (x: Partial<{ annulableMs: number | null; recues: number; attendues: number }>) => ({
  id: "e1",
  annulableMs: null,
  recues: 3,
  attendues: 3,
  ...x,
});

cas("l'import reprend ce qui reste, une fois « Annuler » passé", () => {
  assert.equal(envoiAReprendre(etat({})), "e1");
  assert.equal(envoiAReprendre(etat({ annulableMs: 2500 })), null, "l'import reprend un rangement encore annulable");
});

cas("l'import ne reprend ni rien, ni un envoi pas encore arrivé", () => {
  assert.equal(envoiAReprendre(null), null);
  assert.equal(envoiAReprendre(etat({ recues: 0, attendues: 0 })), null);
  assert.equal(envoiAReprendre(etat({ recues: 2, attendues: 5 })), null, "un envoi coupé se reprend en choisissant le fichier, pas ici");
});

if (echecs > 0) {
  console.log(`\n✗ ${echecs} échec(s)`);
  process.exit(1);
}
console.log("\n✅ « Annuler » dure six secondes, et ce qui reste se reprend.");
