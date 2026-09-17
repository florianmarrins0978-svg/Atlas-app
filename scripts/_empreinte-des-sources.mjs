/**
 * « CE FICHIER A-T-IL CHANGÉ ? » — UNE SEULE FAÇON DE LE DIRE, POUR TOUS.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **LA DATE NE SUFFIT PAS, ET CE DÉPÔT L'A PAYÉ DEUX FOIS.**
 *
 * Le 9 septembre 2026, le garde-fou de la batterie a jeté le verdict d'une
 * mesure entière parce que deux fichiers portaient une date neuve : une session
 * voisine avait joué une commande git qui les avait réécrits **à l'identique**.
 * Rien n'avait changé. La batterie a appris la leçon et compare des contenus.
 *
 * **Le garde-fou de `main`, lui, ne l'avait pas apprise** — il gardait sa propre
 * mesure, par date de dernière écriture, et c'est ce qui a coûté la soirée du
 * 17 septembre 2026 : une fusion réécrit les fichiers qu'elle apporte, donc
 * leurs dates ; le verdict d'un lot vert était déclaré caduc à chaque avancée de
 * `main`, et la seule issue annoncée était cinquante minutes de batterie. Trois
 * sessions côte à côte se renvoyaient ainsi la batterie sans fin.
 *
 * **Deux façons de dire « ce fichier a changé » finissent toujours par
 * diverger** (`CLAUDE.md` §3). Il n'y en a donc plus qu'une, et elle vit ici :
 * la batterie (`_batterie-solitaire.ts`, `_portee-batterie.ts`) et le garde-fou
 * (`garde-fusion-main.mjs`) l'appellent tous les deux. Ce fichier est en `.mjs`
 * pour cette seule raison : un hook s'exécute en `node` nu, sans `tsx`.
 *
 * Le coût a été mesuré plutôt que supposé : **1 406 fichiers en 65 ms** sur ce
 * dépôt — contre cinquante minutes de batterie qu'un faux refus fait rejouer.
 */
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

/**
 * Ce qu'on relève d'un fichier : la date de sa dernière écriture, et son contenu.
 *
 * @typedef {{ date: number, empreinte: string }} Trace
 * @typedef {Map<string, Trace>} Empreinte
 */

const SURVEILLES = ["src", "scripts", "drizzle"];
const IGNORES = new Set(["node_modules", ".git", ".next"]);

/**
 * L'état des sources à un instant — pour savoir, plus tard, si elles ont bougé.
 *
 * On relève la date ET le contenu, et **c'est le contenu qui décide**
 * (`fichiersRemues`). La date reste relevée parce qu'elle se lit dans un
 * diagnostic, jamais parce qu'elle tranche.
 *
 * @param {string} racine
 * @returns {Empreinte}
 */
export function empreinteDesSources(racine) {
  /** @type {Empreinte} */
  const empreinte = new Map();
  const parcourir = (dossier) => {
    for (const entree of readdirSync(dossier, { withFileTypes: true })) {
      if (IGNORES.has(entree.name) || entree.name.startsWith(".next")) continue;
      const chemin = path.join(dossier, entree.name);
      if (entree.isDirectory()) {
        parcourir(chemin);
        continue;
      }
      if (!/\.(ts|tsx|js|mjs|mts|sql|css)$/.test(entree.name)) continue;
      empreinte.set(path.relative(racine, chemin), {
        date: statSync(chemin).mtimeMs,
        // sha1 et non sha256 : on cherche à distinguer deux versions d'un
        // fichier qu'on a soi-même sous la main, pas à résister à quelqu'un qui
        // en fabriquerait une collision exprès.
        empreinte: createHash("sha1").update(readFileSync(chemin)).digest("hex"),
      });
    }
  };
  for (const dossier of SURVEILLES) {
    try {
      parcourir(path.join(racine, dossier));
    } catch {
      // Un dossier absent n'est pas une faute : `drizzle/` n'existe pas partout.
    }
  }
  return empreinte;
}

/**
 * Ce qui a VRAIMENT bougé entre deux empreintes — écrit, ajouté ou supprimé.
 *
 * **Fonction pure**, et c'est ce qui permet de l'éprouver sans attendre
 * cinquante minutes qu'une batterie finisse.
 *
 * @param {Empreinte} avant
 * @param {Empreinte} apres
 * @returns {string[]}
 */
export function fichiersRemues(avant, apres) {
  /** @type {Set<string>} */
  const remues = new Set();
  for (const [chemin, trace] of apres) {
    const trAvant = avant.get(chemin);
    if (!trAvant) {
      remues.add(chemin); // neuf
      continue;
    }
    // La date seule ne prouve rien : une fusion ou un changement de branche
    // réécrit des fichiers à l'identique. C'est le contenu qui tranche.
    if (trAvant.empreinte !== trace.empreinte) remues.add(chemin);
  }
  for (const chemin of avant.keys()) {
    if (!apres.has(chemin)) remues.add(chemin);
  }
  return [...remues].sort();
}
