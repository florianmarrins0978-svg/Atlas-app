#!/usr/bin/env node
/* =======================================================================
   Rappelle qu'un lot de code se clôt par un dossier pour ChatGPT.

   **Sa consigne du 26 août 2026, redite le 30, puis encore le 31 :**
   *« fais-moi un document que je peux copier et lui envoyer ! Enregistre, je
   veux ça à chaque fois sans avoir besoin de te le demander !!! »*

   La règle est écrite en gras dans `CLAUDE.md` depuis le 26 août. Elle n'a
   donc jamais manqué d'être écrite : elle a manqué d'être TENUE. Une consigne
   qui vit dans de la prose se lit au début d'une conversation et s'oublie au
   bout de trois heures — or c'est au bout de trois heures qu'un lot se termine.

   Un premier garde-fou a été posé dans `verifier-memoire.mjs` : il exige que
   tout dossier écrit figure dans son index. **Il ne pouvait pas attraper la
   faute suivante** — ne pas en écrire du tout. Celui-ci la voit.

   Branché sur `Stop` dans `.claude/settings.json` : il parle au moment où la
   session croit avoir fini, pas au moment où elle commence.

   ─── CE QU'IL NE FAIT PAS ───────────────────────────────────────────────

   Il ne bloque rien et ne juge pas la qualité d'un dossier : il ajoute du
   contexte. Devant le moindre doute il se tait — un rappel qui parle à tort
   s'apprend à être ignoré, et l'on perd le garde-fou sans s'en apercevoir.

   Il se tait donc quand la branche ne touche aucun code, quand un dossier a
   déjà été écrit dans les commits en cours, et quand il n'arrive pas à lire
   l'état de git.
   ======================================================================= */
import { execFileSync } from "node:child_process";

const git = (...args) => {
  try {
    return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
};

// **On regarde le LOT EN COURS, pas toute la branche.** Une branche qui porte
// déjà trois dossiers ne dit rien du travail fait depuis le dernier : c'est
// exactement l'angle mort de la première version, et il l'a signalé.
//
// Le repère est donc le dernier commit qui a POSÉ un dossier. Tout code écrit
// après lui appartient à un lot qui n'a pas encore le sien.
const dernierDossier = git(
  "log", "-1", "--format=%H", "--diff-filter=A", "--", "docs/pour-chatgpt"
);
const base = dernierDossier || git("merge-base", "HEAD", "origin/main");
if (!base) process.exit(0);

const tete = git("rev-parse", "HEAD");
if (!tete) process.exit(0);

// Le dossier vient d'être posé, et rien n'a suivi : il n'y a rien à rappeler.
if (dernierDossier === tete) process.exit(0);

const changes = git("diff", "--name-only", `${base}..HEAD`);
if (changes === null) process.exit(0);

const fichiers = changes.split("\n").filter(Boolean);
if (fichiers.length === 0) process.exit(0);

// Un lot de CODE, pas un lot de documentation : corriger une faute de frappe
// dans `TODO.md` n'appelle pas un dossier.
const duCode = fichiers.some((f) => f.startsWith("src/") || f.startsWith("scripts/"));
const unDossier = fichiers.some((f) => /^docs\/pour-chatgpt\/\d{2}-.+\.md$/.test(f));

if (duCode && !unDossier) {
  const combien = fichiers.filter((f) => f.startsWith("src/") || f.startsWith("scripts/")).length;
  console.error(
    `\n⚠ ${combien} fichier(s) de code modifié(s) depuis le dernier dossier, et AUCUN ` +
      `nouveau dossier dans docs/pour-chatgpt/.\n\n` +
      `  Sa consigne du 26 août 2026, redite le 30 et le 31 : « je veux ça à chaque fois\n` +
      `  sans avoir besoin de te le demander ». Un récapitulatif dans le fil ne se\n` +
      `  recopie pas depuis un téléphone — il lui faut un fichier.\n\n` +
      `  La convention : docs/pour-chatgpt/README.md.\n`
  );
}
process.exit(0);
