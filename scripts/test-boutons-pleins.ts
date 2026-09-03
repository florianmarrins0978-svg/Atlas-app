import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

/**
 * L'APLAT DES BOUTONS QU'ON APPUIE — un seul jeton, aucun reste.
 *
 * *Sa décision du 3 septembre 2026, sur `appli/boutons-verts.html` :* **« verdict
 * la D à plat sans brillant, donc tout ce qui est bouton cliquable tu remplaces
 * par la D »**, puis **« ne fais pas de bricolage, remplace correctement les
 * lignes de code, ne fais pas de pansement »**.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **CE QUE CETTE SUITE GARDE, ET QU'AUCUN AUTRE CONTRÔLE NE VOIT.**
 *
 * Le changement a consisté à remplacer `colors.rust` par `colors.plein` sur
 * quarante-six aplats de boutons, à la main de haut en bas. Un seul oublié ne
 * casse rien : il compile, il passe le lint, la page s'affiche — et il reste
 * **vert pin au milieu des verts sauge**, sur un écran que personne ne rouvrira
 * avant des semaines. C'est exactement le genre de reste qu'un « pansement »
 * laisse derrière lui, et c'est ce qu'il a demandé d'éviter.
 *
 * La règle gardée ici est donc mécanique et sans exception : **un élément qui
 * porte `atlas-plein` ne peint jamais son fond avec `colors.rust`.**
 *
 * ─── CE QUI N'EST PAS VISÉ, ET POURQUOI ──────────────────────────────────────
 *
 *   · **`rust` lui-même n'a pas bougé.** Il teinte des TEXTES, des icônes, des
 *     liserés et les fonds pâles `rustTint` : le confondre avec l'aplat des
 *     boutons aurait reverdi la moitié des écrans. C'est l'arbitrage du 31 août,
 *     et `scripts/test-chartes.ts` le garde de son côté.
 *   · **Les boutons CREUX** — sa consigne du 31 août : *« surtout pas ceux qui
 *     sont creux »*. Ils n'ont pas d'aplat ; ils ne sont donc jamais concernés.
 *   · **`src/app/design/*`**, hors produit et découplé depuis le 1ᵉʳ août.
 *   · **La note vocale** (`AnneauNoteVocale.tsx`) : *« ne touche pas à la note
 *     vocale »*, le 3 septembre. Sa tasse a sa propre matière dans `globals.css`
 *     et ne passe par aucun de ces jetons.
 *
 * **Elle sait échouer.** Vérifiée en remettant `colors.rust` sur le fond de
 * `PrimaryButton` : la suite le nomme, avec son fichier et sa ligne.
 * ─────────────────────────────────────────────────────────────────────────────
 */

let passes = 0;
let echecs = 0;
function essai(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${nom}`);
    passes++;
  } catch (err) {
    console.error(`  ✗ ${nom}`);
    console.error(`    ${err instanceof Error ? err.message : err}`);
    echecs++;
  }
}

console.log("=== L'aplat des boutons pleins ===\n");

/** Ce que l'écran écrit pour peindre un fond. */
const FOND = /(?:backgroundColor|background):\s*colors\.rust\b/;

const HORS_SUJET = [/[\\/]design[\\/]/, /AnneauNoteVocale\.tsx$/];

const ECRANS = execSync('git ls-files "src/**/*.tsx"', { encoding: "utf8" })
  .split("\n")
  .filter(Boolean)
  .filter((f) => !HORS_SUJET.some((r) => r.test(f)));

essai("aucun bouton plein n'est resté au vert pin", () => {
  // **On remonte de HUIT lignes, pas d'une.** Le style et la classe sont
  // rarement voisins : entre les deux vivent un `onClick`, un `disabled`, un
  // `data-atlas` et deux lignes de `className`. Une fenêtre d'une ligne ne
  // verrait presque rien et rendrait un vert qui ne prouve rien.
  const restes: string[] = [];
  for (const fichier of ECRANS) {
    const lignes = readFileSync(fichier, "utf8").split("\n");
    for (let i = 0; i < lignes.length; i++) {
      if (!FOND.test(lignes[i])) continue;
      const contexte = lignes.slice(Math.max(0, i - 8), i + 1).join("\n");
      if (!/atlas-plein/.test(contexte)) continue;
      restes.push(`${fichier}:${i + 1} — ${lignes[i].trim()}`);
    }
  }
  assert.deepEqual(
    restes,
    [],
    "Ces boutons pleins peignent encore leur fond avec `colors.rust`. Ils " +
      "resteront vert pin au milieu des verts sauge, sans que rien ne le " +
      "dise :\n      " + restes.join("\n      ")
  );
});

essai("l'action principale de l'application porte le jeton, pas une couleur", () => {
  // **`PrimaryButton` mérite son contrôle à lui.** Il n'existe qu'UNE forme
  // d'action principale dans Atlas — c'est le sujet de son propre fichier —, et
  // dix-sept écrans en dépendent. Si lui seul repassait au vert pin, ce sont
  // dix-sept écrans qui changeraient d'un coup, et la règle générale au-dessus
  // ne le verrait que si sa classe restait à portée de vue.
  const source = readFileSync("src/components/atlas/PrimaryButton.tsx", "utf8");
  assert.ok(
    /backgroundColor:\s*colors\.plein\b/.test(source),
    "`PrimaryButton` ne peint plus son aplat avec `colors.plein`"
  );
  assert.ok(
    !FOND.test(source),
    "`PrimaryButton` peint encore un fond avec `colors.rust`"
  );
});

essai("le jeton existe, et son repli est le vert qu'il a retenu", () => {
  // **Le repli n'est pas une formalité.** Une page rendue hors du gabarit — un
  // courriel, un document, un écran d'erreur servi sans les variables — ne
  // reçoit aucune charte. Sans repli, `var(--atlas-plein)` ne peint RIEN : le
  // bouton devient transparent, avec de la crème écrite dessus. Invisible en
  // développement, où le gabarit est toujours là.
  const jetons = readFileSync("src/lib/design-tokens.ts", "utf8");
  const ligne = jetons.match(/plein:\s*"([^"]+)"/);
  assert.ok(ligne, "`colors.plein` a disparu de `design-tokens.ts`");
  assert.equal(
    ligne![1],
    "var(--atlas-plein, #7d9a6d)",
    `le repli de \`plein\` n'est plus le vert du 3 septembre : ${ligne![1]}`
  );
});

console.log(`\nL'aplat des boutons pleins — ${echecs} échec(s), ${passes} réussi(s).`);
process.exit(echecs === 0 ? 0 : 1);
