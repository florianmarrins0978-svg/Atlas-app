#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
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

/** Ce que valent les dossiers en ce moment : leur rang, et qui les tient. */
function etatDesDossiers() {
  return worktreesExistants().map((dossier, i) => ({
    rang: i + 1,
    dossier,
    pris: pris(dossier),
  }));
}

/** « 1. …  libre » — la même liste pour dire et pour refuser. */
function ditLesDossiers(etat) {
  return etat
    .map(
      (d) =>
        `   ${d.rang}. ${d.dossier}${d.pris ? "   (occupé)" : "   libre"}` +
        (path.resolve(d.dossier) === path.resolve(RACINE) ? "   ← le principal" : "")
    )
    .join("\n");
}

function main() {
  const args = process.argv.slice(2);

  // **UN NUMÉRO EN PREMIER, ET C'EST LE DOSSIER — sa demande du 10 septembre
  // 2026 :** *« je peux leur dire prend le dossier numéro 2 ? »*. Les rangs
  // sont ceux que `sessions:preparer --liste` affiche : 1 est le dossier
  // principal. Tout le reste part à `claude` tel quel.
  const demande = /^\d+$/.test(args[0] ?? "") ? Number(args[0]) : null;
  const pourClaude = demande === null ? args : args.slice(1);

  const etat = etatDesDossiers();

  if (demande !== null && (demande < 1 || demande > etat.length)) {
    console.error(
      `❌ Il n'y a pas de dossier n° ${demande}. Ceux qui existent :\n\n${ditLesDossiers(etat)}\n\n` +
        `   Pour en ajouter :  npm run sessions:preparer ${Math.min(8, etat.length + 1)}`
    );
    process.exit(1);
  }

  // **Un dossier demandé et occupé se REFUSE, il ne se remplace pas.** Sans
  // choix, prendre le suivant est le service rendu ; avec un numéro, ce serait
  // ouvrir la session ailleurs qu'où il l'a dit, sans qu'il le voie.
  if (demande !== null && etat[demande - 1].pris) {
    console.error(
      `❌ Le dossier n° ${demande} est déjà occupé par une session.\n\n${ditLesDossiers(etat)}\n\n` +
        "   Sans numéro, « npm run session » prend le premier libre."
    );
    process.exit(1);
  }

  const choisi = demande !== null ? etat[demande - 1] : etat.find((d) => !d.pris);
  if (!choisi) {
    console.error(
      `❌ Les ${etat.length} dossiers de travail sont occupés :\n\n${ditLesDossiers(etat)}\n\n` +
        `   Pour en ajouter :  npm run sessions:preparer ${Math.min(8, etat.length + 1)}`
    );
    process.exit(1);
  }
  const libre = choisi.dossier;

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
  console.log(`Session n° ${choisi.rang} — ${libre}${marque}\n`);

  // **`shell` sous Windows, et nulle part ailleurs.** Claude Code s'y installe
  // en `.cmd`, que Node refuse de lancer directement depuis la CVE-2024-27980 ;
  // le shell, lui, sait le résoudre. Ailleurs, l'ajouter rouvrirait une porte
  // sur les arguments qu'on transmet.
  const enfant = spawn("claude", pourClaude, {
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

/**
 * **`main()` ne part QUE si ce fichier est lancé directement — 13 septembre 2026.**
 *
 * Il s'exécutait à l'import, et `test-ouvrir-session.ts` importe `cheminDuJeton`
 * d'ici : le seul fait de charger la suite OUVRAIT une vraie session dans le
 * dépôt courant. Sur la machine d'intégration, où « claude » n'est pas
 * installé, elle mourait sur « spawn claude ENOENT » — et comme `npm test`
 * rougissait, la construction, les suites navigateur et la connexion derrière
 * un proxy étaient toutes SAUTÉES. Une CI qui ne joue plus rien ne dit plus
 * rien, et c'est ce qui durait depuis le 10 septembre.
 *
 * Un module qui agit en étant lu ne peut pas être éprouvé : c'est l'effet de
 * bord qu'on retire, pas le symptôme qu'on rattrape (`CLAUDE.md` §4 quater).
 */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
