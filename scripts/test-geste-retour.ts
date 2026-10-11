import assert from "node:assert/strict";
import {
  BORD_DU_NAVIGATEUR,
  bordLaisseAuNavigateur,
  faitReculer,
  lectureDuDoigt,
} from "../src/lib/geste-retour";

// GLISSER VERS LA DROITE POUR REVENIR : sa « B » du 25 septembre 2026.
//
// Ce que ces cas tiennent : un doigt qui fait défiler la page ne recule
// JAMAIS, un doigt qui part à gauche non plus (il découvre « Retirer »), et un
// geste court et lent se rend. Le reste, où le geste mène, est la flèche.

let echecs = 0;
function cas(nom: string, f: () => void) {
  try {
    f();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

cas("un appui ne dit encore rien", () => {
  assert.equal(lectureDuDoigt(4, 3), "attendre");
});
cas("un doigt qui descend fait défiler, il ne recule pas", () => {
  assert.equal(lectureDuDoigt(6, 40), "laisser");
  assert.equal(lectureDuDoigt(20, 18), "laisser");
});
cas("un doigt qui part à gauche garde « Retirer »", () => {
  assert.equal(lectureDuDoigt(-30, 2), "laisser");
});
cas("un doigt nettement vers la droite est suivi", () => {
  assert.equal(lectureDuDoigt(30, 5), "suivre");
});
cas("lâché au-delà du tiers, on recule ; en deçà et lentement, non", () => {
  assert.equal(faitReculer(150, 0, 390), true);
  assert.equal(faitReculer(100, 0.1, 390), false);
});
cas("un coup sec recule même court, un tressaillement non", () => {
  assert.equal(faitReculer(60, 0.8, 390), true);
  assert.equal(faitReculer(20, 2, 390), false);
});
cas("dans Safari le bord est au navigateur, sur l'écran d'accueil il est à nous", () => {
  assert.equal(bordLaisseAuNavigateur(BORD_DU_NAVIGATEUR - 1, true), true);
  assert.equal(bordLaisseAuNavigateur(BORD_DU_NAVIGATEUR - 1, false), false);
  assert.equal(bordLaisseAuNavigateur(200, true), false);
});

if (echecs) {
  console.log(`\n${echecs} cas en échec.`);
  process.exit(1);
}
console.log("\nGeste de retour : tous les cas tiennent.");
