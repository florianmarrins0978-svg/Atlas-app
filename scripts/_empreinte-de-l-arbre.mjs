/**
 * UNE EMPREINTE DE L'ARBRE DE TRAVAIL, en quelques millisecondes.
 *
 * Elle répond à une seule question : « le code a-t-il changé depuis que la
 * vérification a été jouée ? » — et elle doit y répondre dans un HOOK, donc
 * sans démarrer TypeScript.
 *
 * **Ce n'est pas un doublon de `empreinteDesSources`** (`_batterie-solitaire.ts`) :
 * celle-là compare fichier par fichier pour DIRE lesquels ont remué pendant une
 * batterie ; celle-ci rend une seule chaîne, et ne sait rien dire de plus. Les
 * deux ne se remplacent pas — et l'une est en TypeScript, hors d'atteinte d'un
 * hook qui doit rendre la main tout de suite.
 */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const SURVEILLES = ["src", "scripts", "drizzle", ".claude", ".devcontainer"];
const IGNORES = new Set(["node_modules", ".git", ".next", "dist", "coverage"]);
const EXTENSIONS = /\.(ts|tsx|js|mjs|mts|sql|css|json|md)$/;

export function empreinteDeLArbre(racine) {
  const morceaux = [];
  const parcourir = (dossier) => {
    let entrees;
    try {
      entrees = readdirSync(dossier, { withFileTypes: true });
    } catch {
      return; // dossier absent : un dépôt peut vivre sans `.devcontainer`.
    }
    for (const entree of entrees.sort((a, b) => a.name.localeCompare(b.name))) {
      if (IGNORES.has(entree.name)) continue;
      const chemin = path.join(dossier, entree.name);
      if (entree.isDirectory()) {
        parcourir(chemin);
        continue;
      }
      if (!EXTENSIONS.test(entree.name)) continue;
      // La taille et la date suffisent, et coûtent mille fois moins qu'une
      // lecture : deux versions d'un fichier qu'on vient d'écrire n'ont ni la
      // même date ni, presque jamais, la même taille. On ne cherche pas à
      // résister à quelqu'un qui fabriquerait la collision exprès.
      const etat = statSync(chemin);
      morceaux.push(`${path.relative(racine, chemin)}:${etat.size}:${Math.round(etat.mtimeMs)}`);
    }
  };
  for (const dossier of SURVEILLES) parcourir(path.join(racine, dossier));
  return createHash("sha1").update(morceaux.join("\n")).digest("hex");
}

/** Le contenu du témoin à déposer après une vérification verte. */
export function verdictAEcrire(racine, niveau) {
  return {
    niveau,
    empreinte: empreinteDeLArbre(racine),
    quand: new Date().toISOString(),
  };
}
