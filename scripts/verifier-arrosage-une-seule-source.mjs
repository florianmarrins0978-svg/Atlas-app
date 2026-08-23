#!/usr/bin/env node
/*
  DEUX COPIES DU MÊME CALCUL — ce contrôle les empêche de diverger.

  **Pourquoi elles existent.** Le patron a demandé le 20 août 2026 de coder
  l'outil d'arrosage dans l'application. Le calcul était déjà écrit et éprouvé
  sur son téléphone (`appli/arrosage-calcul.js`, depuis le 17 août) : le
  récrire en TypeScript aurait produit une seconde façon de calculer un plan
  d'arrosage, et deux calculs qui divergent se paient en matériel commandé de
  travers (`CLAUDE.md` §3). Il a donc été REPRIS tel quel dans
  `src/lib/arrosage/`.

  **Le risque que cela crée, et que ce contrôle tient.** Une correction faite
  d'un seul côté, et la page publiée ne dit plus ce que l'application calcule.
  Ce contrôle compare les deux fichiers ligne à ligne, en écartant seulement ce
  qui DOIT différer : l'en-tête d'explication, la ligne d'import du catalogue,
  et la porte d'entrée serveur ajoutée à la fin.

  **Ce n'est pas une solution, c'est un sursis.** Une fois l'écran de
  l'application validé par le patron, `appli/arrosage.html` et ses deux scripts
  n'ont plus de raison d'être, et ce contrôle non plus. Ouvert dans `TODO.md`.

  Il sait échouer : changer un chiffre d'un côté le rend rouge en nommant la
  ligne.
*/

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = join(dirname(fileURLToPath(import.meta.url)), "..");

const PAIRES = [
  {
    quoi: "le calcul",
    publie: join(RACINE, "appli", "arrosage-calcul.js"),
    interne: join(RACINE, "src", "lib", "arrosage", "calcul.js"),
    /** La porte d'entrée serveur n'a pas d'équivalent publié. */
    coupeInterne: "   LA PORTE D'ENTRÉE DU CÔTÉ SERVEUR",
  },
  {
    quoi: "le catalogue",
    publie: join(RACINE, "appli", "arrosage-catalogue.js"),
    interne: join(RACINE, "src", "lib", "arrosage", "catalogue.js"),
    coupeInterne: null,
  },
];

/**
 * Le corps commun d'un fichier : sans l'en-tête ajouté, sans l'import, sans la
 * porte d'entrée. C'est ce qui doit être identique au caractère près.
 */
function corps(chemin, coupe) {
  let texte = readFileSync(chemin, "utf8");
  // La porte d'entrée serveur, ajoutée à la fin de la copie interne. On coupe
  // à l'OUVERTURE de son bloc de commentaire, pas à son titre : couper au titre
  // laissait derrière lui le trait d'ouverture et une ligne vide, et le contrôle
  // annonçait une divergence « à la ligne 950 » entre deux fichiers identiques.
  if (coupe && texte.includes(coupe)) {
    const titre = texte.indexOf(coupe);
    const ouverture = texte.lastIndexOf("/* ═", titre);
    texte = texte.slice(0, ouverture >= 0 ? ouverture : titre);
  }
  // L'en-tête d'explication, ajouté en tête de la copie interne : il se termine
  // à la ligne d'import. **On coupe à un repère précis plutôt que de filtrer les
  // commentaires** — un filtre sur « // » avalait aussi les commentaires du
  // code, et il a d'abord accusé les deux fichiers de diverger dès la ligne 1
  // alors qu'ils étaient identiques.
  const REPERE = 'import { CATALOGUE } from "./catalogue.js";';
  if (texte.includes(REPERE)) texte = texte.slice(texte.indexOf(REPERE) + REPERE.length);
  return texte
    .replace("export const CATALOGUE = {", "var CATALOGUE = {")
    .replace(/\/\* ═+[\s\S]*?═+ \*\/\s*$/, "")
    .trim();
}

const plaintes = [];
console.log("=== Le calcul d'arrosage n'a qu'une source ===\n");

for (const paire of PAIRES) {
  if (!existsSync(paire.publie) || !existsSync(paire.interne)) {
    // **Le jour où la page publiée disparaîtra, ce n'est pas un échec** : c'est
    // le but. Le contrôle le dit et s'efface, au lieu de rougir sur un
    // nettoyage voulu.
    console.log(`  · ${paire.quoi} : une seule copie subsiste, rien à comparer`);
    continue;
  }
  const a = corps(paire.publie, null).split("\n");
  const b = corps(paire.interne, paire.coupeInterne).split("\n");

  let premiere = null;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] !== b[i]) {
      premiere = { ligne: i + 1, publie: a[i] ?? "(fin du fichier)", interne: b[i] ?? "(fin du fichier)" };
      break;
    }
  }
  if (premiere) {
    plaintes.push(
      `${paire.quoi} diverge à la ligne ${premiere.ligne} :\n` +
        `      publié  : ${String(premiere.publie).trim().slice(0, 90)}\n` +
        `      interne : ${String(premiere.interne).trim().slice(0, 90)}`
    );
    console.log(`  ✗ ${paire.quoi} diverge à la ligne ${premiere.ligne}`);
    console.log(`      publié  : ${String(premiere.publie).trim().slice(0, 90)}`);
    console.log(`      interne : ${String(premiere.interne).trim().slice(0, 90)}`);
  } else {
    console.log(`  ✓ ${paire.quoi} : les deux copies sont identiques (${a.length} lignes)`);
  }
}

console.log(
  plaintes.length === 0
    ? "\n✅ Une seule source pour le calcul d'arrosage."
    : `\n❌ ${plaintes.length} divergence(s) : une correction n'a été reportée que d'un côté.`
);
process.exit(plaintes.length === 0 ? 0 : 1);
