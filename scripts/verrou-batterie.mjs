#!/usr/bin/env node
/**
 * QUAND UNE BATTERIE TOURNE, PERSONNE NE TOUCHE AU DOSSIER.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Sa colère du 9 septembre 2026, et elle était méritée :** *« comment ça se
 * fait qu'à chaque fois il y a un problème sur la batterie ? Elle est quasi
 * finie et une autre session la fait s'arrêter ou envoie des fichiers ! Quand
 * une batterie tourne, personne n'y touche, personne ne prend les fichiers des
 * voisins. JE NE VEUX PLUS DE PROBLÈME SUR LA BATTERIE. »*
 *
 * Trois fois de suite, un verdict de dix minutes est parti à la poubelle parce
 * qu'une session voisine avait écrit pendant la mesure. Le dépôt savait déjà le
 * DIRE — `_batterie-solitaire.ts` annule le verdict et nomme les fichiers qui
 * ont bougé — mais dire après coup ne rend pas les dix minutes.
 *
 * **Ce fichier ne dit pas, il EMPÊCHE.** La batterie pose un verrou en
 * démarrant ; tant qu'il est là, `garde-batterie.mjs` refuse à toute session
 * — y compris celle qui l'a lancée — les gestes qui écrivent dans le dossier.
 *
 * ─── POURQUOI UN VERROU ET NON UNE CONSIGNE ────────────────────────────────
 *
 * `CLAUDE.md` §1 bis le dit déjà pour une autre règle : *une consigne en prose
 * se lit au début d'une conversation et s'oublie au bout de trois heures* — or
 * c'est au bout de trois heures qu'une session voisine enregistre un fichier.
 * Le patron a tranché le même arbitrage le 4 septembre, devant deux
 * propositions : le garde-fou automatique, jamais la règle écrite.
 *
 * ─── CE QU'IL NE FAIT PAS, ET C'EST DÉLIBÉRÉ ───────────────────────────────
 *
 * **Il ne bloque pas la lecture.** Lire un journal, un `git status`, un `grep` :
 * rien de tout cela ne fait bouger un octet, et refuser ces gestes ferait haïr
 * le verrou. Un garde-fou qui parle à tort s'apprend à être ignoré, et l'on
 * perd la protection sans s'en apercevoir.
 *
 * **Il ne peut pas bloquer pour toujours.** Une batterie tuée — c'est arrivé
 * trois fois aujourd'hui — laisserait sinon le dossier gelé jusqu'au
 * lendemain. Ce qui prouve sa vie est SON PROCESSUS : un verrou dont le
 * processus a disparu ne vaut plus rien. Le signe de vie, rafraîchi entre deux
 * étapes, n'est qu'un garde-fou de dernier recours contre un PID recyclé — d'où
 * son plafond très large.
 *
 * **Il ne tue rien.** Il refuse, il nomme ce qui tourne, et il rend la décision
 * à qui sait — comme `_batterie-solitaire.ts`.
 * ───────────────────────────────────────────────────────────────────────────
 */
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const CHEMIN_VERROU = path.join(RACINE, ".atlas-batterie-en-cours.json");

/**
 * ─── CE QUI PROUVE QU'UN VERROU VIT : SON PROCESSUS, PAS SON BATTEMENT ──────
 *
 * **Payé le 9 septembre 2026 au soir, deux heures après avoir écrit ce
 * fichier — et c'est le patron qui a vu passer une écriture voisine pendant
 * une mesure censée être protégée.**
 *
 * La première version tenait la vie du verrou à un signe rafraîchi toutes les
 * vingt secondes par un `setInterval`. Or `verifier-avant-livraison.ts`
 * enchaîne ses étapes en **`spawnSync`** : la boucle d'événements est bloquée
 * du début à la fin de la batterie, et **aucun timer ne part jamais**. Le signe
 * restait donc à l'heure du démarrage ; quatre-vingt-dix secondes plus tard, le
 * verrou se déclarait mort et rouvrait le dossier — au milieu de la mesure,
 * c'est-à-dire exactement quand il devait rester fermé.
 *
 * **Sa propre suite ne pouvait pas le voir** : elle écrivait des verrous à la
 * main, avec le signe qu'elle voulait. Elle éprouvait la lecture, jamais
 * l'écriture — c'est `CLAUDE.md` §5 quater, « éprouver le geste, pas la
 * fonction qu'on vient d'écrire ».
 *
 * **La correction est de changer la PREUVE, pas d'allonger le délai.** Ce qui
 * dit qu'une batterie tourne, c'est que son processus est vivant : `kill(pid, 0)`
 * le demande au système, et aucun timer n'a besoin de partir pour cela. Le
 * silence ne sert plus que de garde-fou contre un PID recyclé par le système
 * bien plus tard — d'où un plafond large, jamais un seuil serré.
 */
export const SILENCE_MAX_MS = 45 * 60_000;

/** Ce processus est-il encore là ? `kill(pid, 0)` ne tue rien, il interroge. */
export function vivant(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    // EPERM : il existe, mais appartient à quelqu'un d'autre. Il est vivant.
    return e?.code === "EPERM";
  }
}

/**
 * Le verrou tel qu'il est SUR LE DISQUE — ou `null` s'il ne vaut plus rien.
 *
 * Un fichier illisible, un JSON abîmé, un processus mort, un silence trop long :
 * dans les quatre cas on rend `null`. **Le doute profite au travail**, jamais au
 * verrou : un dossier gelé par erreur coûte plus cher qu'une mesure perdue, et
 * la mesure, elle, sait déjà se déclarer nulle.
 */
export function lireVerrou(maintenant = Date.now()) {
  if (!existsSync(CHEMIN_VERROU)) return null;
  let brut;
  try {
    brut = JSON.parse(readFileSync(CHEMIN_VERROU, "utf8"));
  } catch {
    return null;
  }
  if (typeof brut?.pid !== "number" || typeof brut?.dernierSigne !== "number") return null;
  if (!vivant(brut.pid)) return null;
  if (maintenant - brut.dernierSigne > SILENCE_MAX_MS) return null;
  return brut;
}

/** Depuis combien de minutes, en toutes lettres — pour le message de refus. */
export function depuis(verrou, maintenant = Date.now()) {
  const s = Math.max(0, Math.round((maintenant - verrou.debut) / 1000));
  if (s < 60) return `${s} seconde${s > 1 ? "s" : ""}`;
  const m = Math.round(s / 60);
  return `${m} minute${m > 1 ? "s" : ""}`;
}

function ecrire(verrou) {
  writeFileSync(CHEMIN_VERROU, `${JSON.stringify(verrou, null, 2)}\n`, "utf8");
}

/**
 * Poser le verrou, et le tenir jusqu'à ce qu'on le rende.
 *
 * Rend une fonction qui le rend — à appeler dans un `finally`. Les signaux
 * d'arrêt sont branchés dessus : une batterie interrompue au clavier rend son
 * verrou plutôt que de laisser le dossier gelé quatre-vingt-dix secondes.
 *
 * **`ATLAS_VERROU_BATTERIE` évite que les enfants se bloquent entre eux.** La
 * batterie lance `run-e2e-tests`, qui poserait un second verrou et se
 * refuserait l'entrée à lui-même. La variable dit : « il est déjà tenu, plus
 * haut ».
 */
export function prendreLeVerrou(quoi) {
  // Un enfant de la batterie ne reprend pas le verrou de son père : il rend un
  // couple inerte, pour que l'appelant n'ait pas à savoir lequel il est.
  if (process.env.ATLAS_VERROU_BATTERIE === "1") return { rendre: () => {}, signer: () => {} };

  const existant = lireVerrou();
  if (existant && existant.pid !== process.pid) {
    throw new Error(
      `Une batterie tourne déjà depuis ${depuis(existant)} (processus ${existant.pid}, « ${existant.quoi} »).\n` +
        `La machine est à un seul occupant : attendez qu'elle finisse.\n` +
        `Si elle est morte : node scripts/verrou-batterie.mjs rendre --force`
    );
  }

  const debut = Date.now();
  ecrire({ pid: process.pid, quoi, debut, dernierSigne: debut });
  process.env.ATLAS_VERROU_BATTERIE = "1";

  /**
   * Rafraîchir le signe de vie — appelé ENTRE les étapes, jamais par un timer.
   *
   * La batterie bloque sa boucle d'événements du début à la fin (`spawnSync`) :
   * un `setInterval` n'y part jamais. C'est le défaut du 9 septembre 2026, et
   * c'est pour cela que ce rafraîchissement est une fonction qu'on appelle,
   * pas une minuterie qu'on espère.
   */
  const signer = () => {
    try {
      ecrire({ pid: process.pid, quoi, debut, dernierSigne: Date.now() });
    } catch {
      // Le disque peut refuser une seconde. Le verrou tient quand même : ce
      // qui prouve sa vie est le processus, pas ce fichier.
    }
  };

  let rendu = false;
  const rendre = () => {
    if (rendu) return;
    rendu = true;
    try {
      const v = existsSync(CHEMIN_VERROU) ? JSON.parse(readFileSync(CHEMIN_VERROU, "utf8")) : null;
      // On ne retire QUE le sien : une batterie qui a débordé son silence a pu
      // être remplacée, et effacer le verrou du voisin rouvrirait sa mesure.
      if (v?.pid === process.pid) unlinkSync(CHEMIN_VERROU);
    } catch {
      /* rien à rendre */
    }
  };

  process.once("exit", rendre);
  for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
    process.once(signal, () => {
      rendre();
      process.exit(130);
    });
  }
  // Deux gestes, nommés : rendre à la fin, signer entre deux étapes.
  return { rendre, signer };
}

// ─── En ligne de commande : dire, ou rendre ────────────────────────────────
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const verbe = process.argv[2];
  if (verbe === "etat") {
    const v = lireVerrou();
    console.log(
      v
        ? `Une batterie tourne depuis ${depuis(v)} — processus ${v.pid}, « ${v.quoi} ».`
        : "Aucune batterie en cours : le dossier est libre."
    );
  } else if (verbe === "rendre") {
    const v = lireVerrou();
    if (v && !process.argv.includes("--force")) {
      console.error(
        `Refus : la batterie tourne encore (processus ${v.pid}, depuis ${depuis(v)}).\n` +
          `Si vous êtes certain qu'elle est morte : --force`
      );
      process.exit(1);
    }
    if (existsSync(CHEMIN_VERROU)) unlinkSync(CHEMIN_VERROU);
    console.log("Verrou rendu : le dossier est libre.");
  } else {
    console.error("usage : node scripts/verrou-batterie.mjs <etat|rendre [--force]>");
    process.exit(1);
  }
}
