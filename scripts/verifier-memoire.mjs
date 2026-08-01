import { existsSync, readFileSync } from "node:fs";

// Vérifie que la mémoire du dépôt ne pointe pas dans le vide.
//
// Les six fichiers de mémoire (voir CLAUDE.md §2) citent des chemins : un
// fichier renommé, un dossier déplacé, et la documentation envoie le lecteur
// suivant vers une porte fermée. Or c'est précisément quand on arrive sans
// contexte qu'on n'a aucun moyen de deviner le bon chemin.
//
// Lancé par `npm run verifier:memoire`, et par la CI.

const FICHIERS = [
  "README.md",
  "CLAUDE.md",
  "AGENTS.md",
  "HANDOVER.md",
  "PROJECT_STATE.md",
  "ARCHITECTURE.md",
  "TODO.md",
  "CHANGELOG.md",
];

/** Les six fichiers de mémoire doivent exister — c'est le minimum. */
const OBLIGATOIRES = [
  "CLAUDE.md",
  "PROJECT_STATE.md",
  "ARCHITECTURE.md",
  "HANDOVER.md",
  "CHANGELOG.md",
  "TODO.md",
];

const problemes = [];

for (const f of OBLIGATOIRES) {
  if (!existsSync(f)) problemes.push(`${f} — fichier de mémoire manquant`);
}

for (const fichier of FICHIERS) {
  if (!existsSync(fichier)) continue;
  const contenu = readFileSync(fichier, "utf8");

  // Liens Markdown relatifs.
  for (const [, cible] of contenu.matchAll(/\]\(([^)#][^)]*)\)/g)) {
    if (/^(https?:|mailto:)/.test(cible)) continue;
    const chemin = cible.split("#")[0];
    if (chemin && !existsSync(chemin)) {
      problemes.push(`${fichier} — lien mort : ${cible}`);
    }
  }

  // Chemins de fichiers cités entre accents graves. Les motifs à joker et les
  // dépendances externes sont hors sujet : on ne vérifie que ce dépôt.
  for (const [, chemin] of contenu.matchAll(
    /`([a-zA-Z0-9_.\/\[\]-]+\.(?:ts|tsx|sql|md|mjs|yml|json))`/g
  )) {
    if (chemin.includes("*") || chemin.startsWith("node_modules")) continue;
    if (!chemin.includes("/")) continue; // simple nom de fichier en prose
    if (!existsSync(chemin)) {
      problemes.push(`${fichier} — chemin inexistant : ${chemin}`);
    }
  }
}

if (problemes.length > 0) {
  console.error("❌ La mémoire du dépôt pointe dans le vide :\n");
  for (const p of problemes) console.error(`   ${p}`);
  console.error(
    "\nCorriger le chemin, ou le fichier de mémoire — mais pas laisser en l'état :"
  );
  console.error("une référence morte trompe exactement celui qui arrive sans contexte.\n");
  process.exit(1);
}

console.log(`✅ Mémoire du dépôt cohérente (${FICHIERS.length} fichiers vérifiés).`);
