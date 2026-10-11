// LE GESTE QUI POUSSE UN MOIS — éprouvé sans navigateur et sans vrai doigt.
//
// **Sa demande du 11 septembre 2026 :** *« ce qui serait bien c'est de pouvoir
// déplacer les mois du planning en slidant soit à droite soit à gauche »*, puis
// *« en plus des 2 flèches »*. Planche `appli/glisser-les-mois.html`,
// variante A retenue.
//
// **Ce que cette suite défend, et qui a déjà failli passer :**
//   · une page qui se bloquerait sous le doigt de qui voulait la faire défiler ;
//   · un mois qui changerait pour un frôlement de huit pixels ;
//   · une largeur nulle qui ferait franchir un mois au moindre pixel — c'est le
//     défaut nommé par `CLAUDE.md` §5, « un contrôle qui mesure zéro ne mesure
//     rien », et il s'est produit ici même en éprouvant la planche : le doigt
//     d'essai tombait sous le bord de l'écran, et la mesure rendait un faux
//     « rien ne bouge » ;
//   · le passage de décembre à janvier, écrit quatre fois et donc voué à
//     diverger sur le seul cas qui compte.

import assert from "node:assert/strict";
import { axeDuGeste, pasDuGlissement, EVEIL_PX, PART_POUR_CHANGER } from "../src/lib/glissement";
import { moisDecale } from "../src/lib/mois";

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

console.log("=== Pousser le mois du doigt ===\n");

// ─── DE QUEL CÔTÉ PART LE DOIGT ────────────────────────────────────────────
essai("tant que le doigt n'a pas bougé, le geste n'a pas de sens", () => {
  assert.equal(axeDuGeste(0, 0), null);
  assert.equal(axeDuGeste(EVEIL_PX - 1, EVEIL_PX - 1), null);
});

// **Un doigt qui descend rend la main à la page.** Le calendrier vit au milieu
// d'un écran qui se fait défiler : le retenir bloquerait la page sous le doigt
// de celui qui voulait seulement lire plus bas.
essai("un doigt qui descend laisse la page défiler", () => {
  assert.equal(axeDuGeste(4, 40), "bas");
  assert.equal(axeDuGeste(-4, -40), "bas");
});

essai("un doigt qui part de côté prend le calendrier", () => {
  assert.equal(axeDuGeste(-40, 4), "cote");
  assert.equal(axeDuGeste(40, -4), "cote");
});

// Un geste en diagonale doit trancher, jamais hésiter : c'est le plus grand
// écart qui décide, et il décide UNE fois.
essai("une diagonale tranche par le plus grand écart", () => {
  assert.equal(axeDuGeste(30, 29), "cote");
  assert.equal(axeDuGeste(29, 30), "bas");
});

// ─── COMBIEN DE MOIS LE GESTE FAIT FRANCHIR ────────────────────────────────
essai("pousser vers la GAUCHE amène le mois suivant", () => {
  assert.equal(pasDuGlissement(-200, 360), 1);
});

essai("pousser vers la DROITE ramène le mois précédent", () => {
  assert.equal(pasDuGlissement(200, 360), -1);
});

// **On ne change pas de mois pour un frôlement** — sinon le mois sauterait
// chaque fois qu'un doigt effleure le calendrier en défilant.
essai("un frôlement ne change pas de mois", () => {
  assert.equal(pasDuGlissement(-20, 360), 0);
  assert.equal(pasDuGlissement(20, 360), 0);
});

essai("le seuil est un quart de la largeur, des deux côtés", () => {
  const largeur = 360;
  const seuil = largeur * PART_POUR_CHANGER;
  assert.equal(pasDuGlissement(-seuil, largeur), 1, "le seuil exact doit franchir");
  assert.equal(pasDuGlissement(-seuil + 1, largeur), 0, "un pixel avant le seuil ne franchit pas");
  assert.equal(pasDuGlissement(seuil, largeur), -1);
  assert.equal(pasDuGlissement(seuil - 1, largeur), 0);
});

// **UN CONTRÔLE QUI MESURE ZÉRO NE MESURE RIEN** (`CLAUDE.md` §5). Sans surface
// à parcourir, il n'y a pas de geste : comparer à zéro ferait franchir un mois
// au moindre pixel, et le calendrier s'emballerait sur un écran pas encore mis
// en page.
essai("sans largeur mesurée, aucun mois n'est franchi", () => {
  assert.equal(pasDuGlissement(-500, 0), 0);
  assert.equal(pasDuGlissement(-500, -1), 0);
  assert.equal(pasDuGlissement(-500, Number.NaN), 0);
});

// La moitié sert au TITRE pendant le geste : le mois écrit est celui qui occupe
// le plus de place. Sans lui, on voit octobre arriver pendant que l'en-tête dit
// encore septembre.
essai("à la moitié, le titre bascule sur le mois qui arrive", () => {
  assert.equal(pasDuGlissement(-100, 360, 0.5), 0, "avant la moitié, le titre ne bouge pas");
  assert.equal(pasDuGlissement(-180, 360, 0.5), 1, "à la moitié, il annonce le suivant");
});

// ─── LE MOIS D'À CÔTÉ ──────────────────────────────────────────────────────
//
// Le passage d'une année à l'autre vivait en clair dans chacune des deux
// flèches ; le glissement en réclamait deux usages de plus. C'est le seul cas
// où quatre copies auraient fini par diverger.
essai("décembre suivi de janvier change d'année", () => {
  assert.deepEqual(moisDecale({ annee: 2026, mois: 11 }, 1), { annee: 2027, mois: 0 });
});

essai("janvier précédé de décembre recule d'un an", () => {
  assert.deepEqual(moisDecale({ annee: 2026, mois: 0 }, -1), { annee: 2025, mois: 11 });
});

essai("un pas nul ne bouge rien", () => {
  assert.deepEqual(moisDecale({ annee: 2026, mois: 8 }, 0), { annee: 2026, mois: 8 });
});

essai("un saut de plusieurs mois traverse les années dans les deux sens", () => {
  assert.deepEqual(moisDecale({ annee: 2026, mois: 8 }, 16), { annee: 2028, mois: 0 });
  assert.deepEqual(moisDecale({ annee: 2026, mois: 8 }, -16), { annee: 2025, mois: 4 });
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} Le glissement des mois — ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
