import { spawnSync } from "node:child_process";

/**
 * Lancer un `npm run …` et l'arrêter — des deux côtés de la Manche.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **CE QUE CE FICHIER RÉPARE, ET POURQUOI IL EXISTE.**
 *
 * Le 2 septembre 2026, la batterie s'arrêtait sur ses DEUX DERNIÈRES étapes —
 * « Suites navigateur » et « Connexion derrière un proxy » — avec un unique
 * `spawn EINVAL`. Les sept premières passaient. Le verdict accusait donc le
 * produit là où seule la machine parlait.
 *
 * Deux causes, toutes deux propres à Windows, et toutes deux invisibles
 * ailleurs :
 *
 *  1. **`npm` y est un `.cmd`, et Node refuse de le lancer sans shell.** Depuis
 *     la correction de la CVE-2024-27980, `spawn` rend `EINVAL` sur un `.bat`
 *     ou un `.cmd` tant que `shell` n'est pas vrai. Le message ne nomme ni le
 *     fichier ni la raison : il dit « argument invalide », et l'on cherche dans
 *     le produit ;
 *  2. **`process.kill(-pid)` n'existe pas sous Windows.** Le moins-devant-le-pid
 *     est un groupe de processus POSIX ; ici il rend `EINVAL` ou tue le mauvais.
 *     Le serveur d'essai survivait donc à la suite qui l'avait lancé, et gardait
 *     le port 3000 pour la suivante.
 *
 * **Le drapeau reste FAUX ailleurs**, et ce n'est pas une précaution : sous
 * shell, les arguments sont ré-interprétés par l'interpréteur. L'activer partout
 * changerait le comportement d'étapes qui marchent depuis des mois, pour un
 * défaut qui ne s'y produit pas. C'est la même règle que `verifier-avant-livraison.ts`,
 * qui a déjà payé ce piège un cran plus haut (`ARCHITECTURE.md`, « la batterie
 * ne tournait pas sous Windows »).
 *
 * **Écrit UNE fois, pour les deux appelants.** `run-e2e-tests.ts` et
 * `verifier-connexion-avec-serveur.mts` lançaient chacun leur serveur, et
 * auraient divergé au premier ajustement (`CLAUDE.md` §3).
 */
export const SOUS_WINDOWS = process.platform === "win32";

/** Le nom sous lequel `npm` s'appelle ici. */
export const NPM = SOUS_WINDOWS ? "npm.cmd" : "npm";

/**
 * Les options de `spawn` qui font qu'un `npm run …` démarre, et qu'on saura
 * l'arrêter.
 *
 * `detached` sert au tuage de l'arbre sous Unix ; sous Windows c'est `taskkill`
 * qui s'en charge, et le drapeau n'y coûte rien.
 */
export const OPTIONS_SERVEUR = {
  detached: true,
  shell: SOUS_WINDOWS,
} as const;

/**
 * Arrête un serveur et TOUT ce qu'il a lancé.
 *
 * `npm run dev` lance `next`, qui lance un serveur : tuer le seul `npm`
 * laisserait le port pris et la suite suivante accuserait le produit d'un
 * « ECONNREFUSED » qui n'est pas le sien.
 *
 * Rend `true` si l'ordre a pu être donné — jamais une promesse que le processus
 * est mort : sur les deux plateformes, l'arrêt est asynchrone.
 */
export function arreterArbre(pid: number | undefined, signal: NodeJS.Signals = "SIGTERM"): boolean {
  if (!pid) return false;
  try {
    if (SOUS_WINDOWS) {
      // `/T` : les enfants avec. `/F` : sans demander. Sans `/T`, `next` reste
      // et garde le port.
      spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"], { stdio: "ignore" });
      return true;
    }
    process.kill(-pid, signal);
    return true;
  } catch {
    // Déjà mort, ou jamais né : les deux cas se valent pour l'appelant.
    return false;
  }
}
