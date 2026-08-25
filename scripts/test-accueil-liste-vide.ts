import assert from "node:assert";
import { readFileSync } from "node:fs";

/**
 * L'ACCUEIL VIDE NE DIT PLUS QU'IL EST VIDE.
 *
 * *Sa demande du 25 août 2026, capture de l'accueil à l'appui :*
 * ***« supprime la phrase "aucun chantier pour l'instant" »***.
 *
 * Elle disait deux choses, et les deux étaient déjà à l'écran : que la liste est
 * vide — cela se voit — et par où commencer, alors que « CRÉER UN DEVIS » et son
 * rond doré sont juste au-dessus. Une phrase qui répète ce qu'on voit prend la
 * place des bandeaux, qui, eux, appellent une action.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **POURQUOI CE CONTRÔLE LIT LA SOURCE, ET NON L'ÉCRAN.**
 *
 * Un retrait ne se vérifie que par l'ABSENCE : sans contrôle, la phrase
 * reviendrait au premier rebasage sans que rien ne rougisse — c'est arrivé deux
 * fois dans ce dépôt (`CLAUDE.md` §5 bis).
 *
 * Mais l'état à mesurer — **aucun chantier** — est hors de portée des suites
 * navigateur : elles partagent le compte de démonstration, qui en porte
 * toujours. Une suite qui « vérifierait » l'absence sur un accueil PLEIN serait
 * verte sans avoir rien mesuré, et rassurerait à tort (`CLAUDE.md` §5).
 *
 * La branche vide est donc lue là où elle existe : dans le fichier. C'est
 * grossier, et c'est plus honnête qu'un vert qui ne prouve rien.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * **Sait échouer** : remettre la phrase dans `EcranChantiers.tsx` fait tomber la
 * première mesure en la citant.
 */

const ECRAN = "src/app/EcranChantiers.tsx";
const source = readFileSync(ECRAN, "utf8");

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

console.log("=== L'accueil vide ne dit plus qu'il est vide ===\n");

essai("la phrase « Aucun chantier pour l'instant » n'est plus à l'écran", () => {
  // Les apostrophes s'écrivent `&apos;` en JSX : on cherche donc les deux
  // formes, sans quoi le contrôle passerait à côté de son retour exact.
  const trouve = source.match(/Aucun chantier pour l(?:&apos;|')instant[^\n]*/);
  assert.equal(trouve, null, `elle est revenue : « ${trouve?.[0].trim()} »`);
});

essai("« Créez votre premier chantier » non plus", () => {
  assert.ok(
    !source.includes("Créez votre premier chantier"),
    "la seconde moitié de la phrase est revenue"
  );
});

// **Ce qui doit RESTER, et c'est la moitié qui compte.** Les bandeaux portent
// les réponses de ses clients — un devis accepté, une autre date proposée — et
// elles arrivent justement quand plus aucun chantier n'est en cours. Retirer la
// phrase ET les bandeaux laisserait un écran mort là où il y a une action à
// faire.
essai("les bandeaux restent affichés sur une liste vide", () => {
  const vide = source.slice(source.indexOf("restants.length === 0 ?"));
  const branche = vide.slice(0, vide.indexOf(") : ("));
  assert.ok(
    branche.includes("{bandeaux}"),
    "la branche « liste vide » ne rend plus les bandeaux : les réponses des clients seraient perdues"
  );
});

console.log("");
if (echecs) {
  console.log(`${echecs} ÉCHEC(S).`);
  process.exit(1);
}
console.log("L'accueil vide — 0 échec(s).");
