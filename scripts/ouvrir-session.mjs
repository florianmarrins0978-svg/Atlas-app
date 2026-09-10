#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { RACINE, SOUS_WINDOWS, worktreesExistants } from "./preparer-sessions.mjs";

/**
 * OUVRIR UNE SESSION — elle choisit son dossier toute seule.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Sa demande du 10 septembre 2026 :** *« non mais je veux qu'elle se
 * débrouille, qu'elle aille dans un dossier à chaque fois, seule »*.
 *
 * `npm run sessions:preparer` avait créé les dossiers ; il restait à LUI de
 * choisir lequel, d'y aller, et de se souvenir duquel était pris. Trois gestes
 * à répéter cinq fois par soirée, et une erreur possible à chaque fois : deux
 * sessions dans le même dossier, c'est-à-dire exactement la panne que les
 * dossiers venaient supprimer (`CLAUDE.md` §1.0).
 *
 *     npm run session          # et c'est tout, où qu'on soit dans le dépôt
 *
 * ─── COMMENT UN DOSSIER EST DIT « PRIS » ───────────────────────────────────
 *
 * **Par un processus vivant, jamais par un fichier laissé là.** C'est la leçon
 * du verrou de la batterie, payée le 9 septembre : un jeton qui se fie à un
 * battement se déclare mort au mauvais moment, et un jeton qu'on oublie
 * d'effacer condamne un dossier pour toujours. Ce lanceur RESTE en vie tant
 * que la session tourne — il attend son enfant. Son propre PID est donc la
 * preuve, et le signal 0 la question.
 *
 * Un jeton dont le processus a disparu — machine éteinte, terminal fermé
 * brutalement — est simplement ignoré, puis réécrit.
 *
 * ─── CE QU'IL NE FAIT PAS ──────────────────────────────────────────────────
 *
 * **Il ne crée pas de dossier.** `sessions:preparer` le fait, une fois pour
 * toutes, et lui seul sait installer les dépendances. Quand tous les dossiers
 * sont pris, ce lanceur le DIT et donne la commande — plutôt que de fabriquer
 * en silence un sixième worktree et de lancer un `npm install` de trois
 * minutes sous les yeux de quelqu'un qui attendait une session.
 * ───────────────────────────────────────────────────────────────────────────
 */

export const JETONS = path.join(tmpdir(), "atlas-sessions-ouvertes");

/**
 * **Exporté pour son contrôle, et c'est délibéré.** `test-ouvrir-session.ts`
 * doit poser un jeton pour simuler un dossier occupé ; recopier la règle de
 * nommage dans la suite en ferait une seconde implémentation, qui divergerait
 * au premier caractère interdit ajouté (`CLAUDE.md` §3).
 */
export function cheminDuJeton(dossier) {
  // Le chemin sert de nom : deux dépôts clonés côte à côte ne se disputent pas
  // leurs jetons. Les séparateurs et les deux-points de Windows n'ont pas leur
  // place dans un nom de fichier.
  return path.join(JETONS, path.resolve(dossier).replace(/[\\/:]/g, "_"));
}

/** Le processus nommé par ce jeton vit-il encore ? */
function pris(dossier) {
  const fichier = cheminDuJeton(dossier);
  if (!existsSync(fichier)) return false;
  try {
    const pid = Number(readFileSync(fichier, "utf8").trim());
    if (!Number.isInteger(pid) || pid <= 0) return false;
    // Le signal 0 ne tue rien : il demande seulement si le processus existe.
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function main() {
  const dossiers = worktreesExistants();

  const libre = dossiers.find((d) => !pris(d));
  if (!libre) {
    console.error(
      `❌ Les ${dossiers.length} dossiers de travail sont occupés.\n\n` +
        "   Pour en ajouter :  npm run sessions:preparer " +
        `${Math.min(8, dossiers.length + 1)}\n` +
        "   Pour voir qui tient quoi :  npm run sessions:preparer --liste"
    );
    process.exit(1);
  }

  mkdirSync(JETONS, { recursive: true });
  const jeton = cheminDuJeton(libre);
  // **Le jeton se pose AVANT de lancer**, et il porte le PID de CE processus.
  // Entre le choix et le démarrage de la session il s'écoule une seconde ;
  // deux lanceurs partis ensemble choisiraient sinon le même dossier.
  writeFileSync(jeton, `${process.pid}\n`, "utf8");

  const rendre = () => {
    try {
      if (existsSync(jeton) && Number(readFileSync(jeton, "utf8").trim()) === process.pid) {
        unlinkSync(jeton);
      }
    } catch {
      // Rien à rendre : le jeton mourra de lui-même, son processus étant parti.
    }
  };
  process.once("exit", rendre);
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
    process.once(signal, () => {
      rendre();
      process.exit(130);
    });
  }

  const marque = path.resolve(libre) === path.resolve(RACINE) ? " (le dossier principal)" : "";
  console.log(`Session dans ${libre}${marque}\n`);

  // **`shell` sous Windows, et nulle part ailleurs.** Claude Code s'y installe
  // en `.cmd`, que Node refuse de lancer directement depuis la CVE-2024-27980 ;
  // le shell, lui, sait le résoudre. Ailleurs, l'ajouter rouvrirait une porte
  // sur les arguments qu'on transmet.
  const enfant = spawn("claude", process.argv.slice(2), {
    cwd: libre,
    stdio: "inherit",
    shell: SOUS_WINDOWS,
  });
  enfant.on("error", (e) => {
    console.error(`❌ « claude » n'a pas pu démarrer : ${e.message}`);
    rendre();
    process.exit(1);
  });
  enfant.on("exit", (code) => {
    rendre();
    process.exit(code ?? 0);
  });
}

main();
