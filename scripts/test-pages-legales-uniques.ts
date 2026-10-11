import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * LES DEUX PAGES LÉGALES NE PEUVENT PAS DIVERGER.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **Elles existent en deux exemplaires, et c'est imposé par le chemin, pas
 * choisi** : `.github/workflows/pages.yml` ne publie QUE le dossier `appli/` —
 * c'est là qu'il les lit depuis son téléphone —, et Next.js ne sert QUE le
 * dossier `public/` — c'est là que la porte les fait accepter.
 *
 * **Le danger n'est pas la copie, c'est l'écart.** Le jour où l'une des deux est
 * corrigée seule, on fait accepter un texte qui n'est pas celui qu'on publie —
 * et personne ne le voit, parce que les deux pages s'ouvrent normalement.
 *
 * **Ce que cette suite ne fait PAS** : réunir les deux fichiers. Tant que les
 * deux chemins de publication sont ce qu'ils sont, la copie est la seule forme
 * possible ; elle est notée dans `TODO.md`. Ce qui se tient ici, c'est qu'elles
 * restent identiques **au caractère près**.
 *
 * **Elle sait échouer** : changer un mot dans l'une des quatre la fait rougir en
 * nommant le fichier et la ligne.
 */

const RACINE = path.join(__dirname, "..");
const PAGES = ["conditions-utilisation.html", "confidentialite.html"];

let fautes = 0;
let caracteres = 0;

for (const page of PAGES) {
  const publiee = readFileSync(path.join(RACINE, "appli", page), "utf8");
  const servie = readFileSync(path.join(RACINE, "public", page), "utf8");
  caracteres += publiee.length;

  if (publiee === servie) {
    console.log(`✅ ${page} — identique des deux côtés (${publiee.length} caractères)`);
    continue;
  }

  fautes++;
  const a = publiee.split("\n");
  const b = servie.split("\n");
  const ligne = a.findIndex((l, i) => l !== b[i]);
  console.error(`❌ ${page} — les deux exemplaires diffèrent, ligne ${ligne + 1} :`);
  console.error(`   appli/  : ${(a[ligne] ?? "(fin du fichier)").trim().slice(0, 120)}`);
  console.error(`   public/ : ${(b[ligne] ?? "(fin du fichier)").trim().slice(0, 120)}`);
}

// Un contrôle qui mesure zéro ne mesure rien (`CLAUDE.md` §5) : deux fichiers
// vides seraient « identiques », et l'on ferait accepter une page blanche.
assert.ok(caracteres > 20_000, `seulement ${caracteres} caractères lus : les pages légales sont vides ou introuvables`);

if (fautes > 0) {
  console.error(
    "\nOn fait accepter un texte qui n'est pas celui qu'on publie. " +
      "Recopier celui qui fait foi vers l'autre — jamais laisser les deux vivre."
  );
  process.exit(1);
}

console.log(`\n${PAGES.length} pages légales, ${caracteres} caractères, aucun écart.`);
