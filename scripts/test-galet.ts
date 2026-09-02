import assert from "node:assert";
import { readFileSync } from "node:fs";
import { CHARTES, contraste, estSombre } from "../src/lib/chartes";

/**
 * LE GALET — la matière de « À facturer » et de l'onglet actif de « Terminés ».
 *
 * *Sa demande du 2 septembre 2026, après la planche
 * `appli/facturer-note-vocale.html` : « code moi la A le calme avec la 4 le
 * galet, et code l'idée du galet aussi pour le bouton Tout et À facturer ».*
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **Cette suite existe pour deux pannes MUETTES**, qu'aucun type, aucun lint et
 * aucune capture ne verrait :
 *
 *   1. **L'ORDRE DANS LE FICHIER.** La capsule porte `atlas-plein` ET
 *      `atlas-galet`. Or `.atlas-plein` pose lui aussi un `background-image`
 *      (`--atlas-plein-fond`). Les deux règles ont la même spécificité : c'est
 *      donc la DERNIÈRE écrite qui gagne. Le jour où quelqu'un déplace le
 *      galet plus haut — ou rouvre un bloc `.atlas-plein` en dessous —, le
 *      dégradé disparaît et il ne reste qu'un aplat vert. Rien ne rougit. Ce
 *      piège n'est pas théorique : `AnneauNoteVocale.tsx` porte déjà le
 *      commentaire d'un écrasement PARTIEL du même genre, payé une fois.
 *
 *   2. **LA MATIÈRE QUI SE METTRAIT À SUIVRE LA CHARTE.** Le réflexe du dépôt
 *      est d'écrire `var(--atlas-rust)` plutôt qu'un vert en clair, et c'est la
 *      bonne règle PARTOUT AILLEURS. Ici elle casserait tout : sur Nuit et
 *      Sylve, `plein` vaut l'encre — un crème. Le dégradé finirait donc en
 *      blanc cassé, avec le mot « À FACTURER » écrit en blanc dessus (1,05 de
 *      contraste). C'est exactement le défaut du 22 août 2026, celui de sa
 *      capture « le mode nuit est illisible ».
 *
 *      Le galet est donc FIXE, comme `sage` et comme la porcelaine du micro :
 *      *ce qui fait une matière, c'est de ne pas changer de visage.* Seul l'or
 *      passe par une variable — il vaut la même valeur sur les huit chartes.
 *
 * **Elle sait échouer.** Vérifié en la confrontant aux deux états qu'elle
 * prétend détecter : en déplaçant le bloc `.atlas-galet` avant `.atlas-plein`
 * (le contrôle 1 rougit), et en remplaçant `#2f3b2f` par `var(--atlas-rust)`
 * (le contrôle 2 rougit en nommant Nuit et Sylve).
 *
 * **Ce qu'elle NE prétend PAS prouver.** Que le mot tient la norme des textes :
 * il ne la tient pas, et c'est un choix qu'il a fait en connaissance de cause.
 * Le chiffre était écrit sous le bouton sur la planche — 3,1 à l'entrée du
 * dégradé, là où il en faudrait 4,5. Ce qui est gardé ici, c'est le seuil d'un
 * SIGNE (3), au-dessous duquel le mot ne serait plus lisible du tout, et le
 * fait que la pente reste raide.
 * ─────────────────────────────────────────────────────────────────────────────
 */

let passed = 0;
let failed = 0;
function test(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ ${nom}`);
    passed++;
  } catch (err) {
    console.error(`❌ ${nom}`);
    console.error(`   ${err instanceof Error ? err.message : err}`);
    failed++;
  }
}

const CSS = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");

/** Le bloc de la classe, du sélecteur à son accolade fermante. */
function bloc(selecteur: string): string {
  const depart = CSS.indexOf(`${selecteur} {`);
  assert.ok(depart >= 0, `\`${selecteur}\` est introuvable dans globals.css.`);
  const fin = CSS.indexOf("\n}", depart);
  return CSS.slice(depart, fin + 2);
}

console.log("=== Le galet — la matière de « À facturer » ===\n");

test("Le galet est écrit APRÈS `.atlas-plein`, sinon son dégradé disparaît", () => {
  const plein = CSS.lastIndexOf(".atlas-plein {");
  const galet = CSS.indexOf(".atlas-galet {");
  assert.ok(plein >= 0, "`.atlas-plein` est introuvable.");
  assert.ok(galet >= 0, "`.atlas-galet` est introuvable.");
  assert.ok(
    galet > plein,
    "`.atlas-galet` est déclaré AVANT `.atlas-plein`. Les deux posent un " +
      "`background-image` à spécificité égale : c'est le dernier écrit qui " +
      "gagne, et la capsule redeviendrait un aplat vert sans que rien ne le dise."
  );
  // Et aucun `.atlas-plein` ne doit ROUVRIR plus bas et le repasser devant.
  //
  // **On cherche une RÈGLE, pas une mention.** Un sélecteur commence en début
  // de ligne ; `.atlas-plein` cité dans un commentaire, lui, est précédé d'une
  // étoile ou d'un accent grave. La première version de ce contrôle prenait un
  // `lastIndexOf` et rougissait sur son propre commentaire — un contrôle qui
  // accuse à tort coûte plus cher que pas de contrôle du tout.
  const rouvertures = [...CSS.matchAll(/^\.atlas-plein[^{]*\{/gm)]
    .map((m) => m.index ?? -1)
    .filter((i) => i > galet);
  assert.deepEqual(
    rouvertures,
    [],
    "Une règle `.atlas-plein` a été rouverte APRÈS `.atlas-galet` : elle " +
      "écrasera de nouveau le dégradé."
  );
});

test("Le fond s'écrit en DEUX propriétés, jamais en raccourci", () => {
  const b = bloc(".atlas-galet");
  assert.ok(
    b.includes("background-color:") && b.includes("background-image:"),
    "Le galet doit poser `background-color` ET `background-image` séparément."
  );
  assert.ok(
    !/\n\s*background:/.test(b),
    "Le raccourci `background:` remet `background-image` à `none` avant de " +
      "peindre : posé un jour au-dessus d'une autre règle, il efface le dégradé."
  );
});

test("La matière ne suit AUCUNE charte — elle est fixe, comme celle du micro", () => {
  const b = bloc(".atlas-galet");
  const variables = [...b.matchAll(/var\(--atlas-([a-zA-Z]+)/g)].map((m) => m[1]);
  const interdites = variables.filter((v) => v !== "or");
  assert.deepEqual(
    interdites,
    [],
    `Le galet emploie ${interdites.map((v) => `\`--atlas-${v}\``).join(", ")}. ` +
      "Sur Nuit et Sylve, l'accent EST l'encre : le dégradé finirait clair, " +
      "avec du blanc écrit dessus. Seul l'or peut passer par une variable — " +
      "il vaut la même valeur sur les huit chartes."
  );
});

test("Le mot blanc reste lisible sur les trois verts du dégradé", () => {
  const b = bloc(".atlas-galet");
  const degrade = b.match(/background-image:\s*linear-gradient\(([^;]+)\);/);
  assert.ok(degrade, "Le dégradé du galet est introuvable.");
  const verts = [...degrade![1].matchAll(/#[0-9a-fA-F]{6}/g)].map((m) => m[0]);
  assert.ok(verts.length >= 2, `Le dégradé ne porte que ${verts.length} couleur(s).`);

  // **Le seuil est celui d'un SIGNE, pas d'un texte, et c'est assumé.** Il a
  // choisi cette matière en ayant le chiffre sous les yeux : 3,1 à l'entrée du
  // dégradé. Écrire 4,5 ici ferait rougir SON choix ; écrire moins de 3 ne
  // défendrait plus rien. On garde donc la borne au-dessous de laquelle le mot
  // cesserait d'être lisible du tout.
  const SIGNE = 3;
  const faibles = verts
    .map((v) => ({ vert: v, mesure: contraste("#ffffff", v) }))
    .filter((m) => m.mesure < SIGNE);
  assert.deepEqual(
    faibles,
    [],
    "Le blanc du mot ne tient pas sur " +
      faibles.map((f) => `${f.vert} (${f.mesure.toFixed(2)})`).join(", ") +
      ` — il en faut ${SIGNE}. La version prudente est dessinée dans ` +
      "`appli/facturer-note-vocale.html` (« le filet doré », 10,9)."
  );
});

test("Sa silhouette se voit sur les huit chartes, claires comme sombres", () => {
  // **Le galet étant fixe, c'est le FOND DE PAGE qui bouge sous lui**, et le
  // bout du dégradé qui le détoure n'est pas le même des deux côtés : sur une
  // charte claire c'est son vert le plus SOMBRE qui le détache du crème, sur
  // une sombre c'est son vert le plus CLAIR qui le détache du noir. On demande
  // donc que l'un des bouts tienne, jamais un bout choisi d'avance.
  //
  // *La première version de ce contrôle exigeait le vert clair partout, et
  // rougissait sur les six chartes claires — c'est-à-dire sur l'écran que le
  // patron regarde tous les jours, où le bouton se voit parfaitement.*
  const degrade = bloc(".atlas-galet").match(/background-image:[^;]+;/);
  assert.ok(degrade, "Le dégradé du galet est introuvable.");
  const verts = [...degrade![0].matchAll(/#[0-9a-fA-F]{6}/g)].map((m) => m[0]);
  const OBJET = 3;
  const perdues = CHARTES.map((c) => {
    const meilleur = Math.max(...verts.map((v) => contraste(v, c.jetons.cream)));
    return {
      charte: c.libelle,
      sombre: estSombre(c.jetons),
      detoure: Math.round(meilleur * 100) / 100,
    };
  }).filter((m) => m.detoure < OBJET);
  assert.deepEqual(
    perdues,
    [],
    "Le galet se fond dans le fond sur : " +
      perdues.map((p) => `${p.charte} (${p.detoure})`).join(", ") +
      ". Un bouton qu'on ne détoure pas est un bouton qu'on ne voit pas."
  );
});

console.log(`\n${failed === 0 ? "✅" : "❌"} Le galet — ${passed} réussi(s), ${failed} échec(s).`);
if (failed > 0) process.exit(1);
