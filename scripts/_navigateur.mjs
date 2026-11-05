import { existsSync, readdirSync } from "node:fs";

/**
 * LE NAVIGATEUR DES SUITES ET DES CAPTURES : un seul endroit pour le trouver.
 *
 * **Le défaut que ceci corrige, et il a coûté une nuit.** Le 28 octobre 2026,
 * les 88 suites navigateur d'une batterie sont tombées sur un poste du nuage
 * sans aucun défaut du produit : le dépôt cherchait Chromium à
 * `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`, écrit en dur dans une
 * cinquantaine de scripts. Le poste portait `chromium-1243/chrome-linux64`. Les
 * autres scripts devinaient le chemin de quatre autres façons, chacune avec son
 * oubli (`chrome-linux` sans `64`, la seule variable `CHROMIUM_PATH`…). Il
 * fallait passer deux variables à la main pour que la batterie voie un écran.
 *
 * **L'ordre, du plus sûr au plus deviné :**
 *   1. ce qu'on a demandé : `PLAYWRIGHT_EXECUTABLE_PATH`, `CHROMIUM_PATH`,
 *      `CHROME_ATLAS` (les trois noms que le dépôt employait déjà) ;
 *   2. le lien stable `<dossier>/chromium`, que l'installation pose vers la
 *      version présente, quelle qu'elle soit ;
 *   3. un `chromium-NNNN` du dossier, sous `chrome-linux64` ou `chrome-linux`,
 *      la version la plus récente d'abord ;
 *   4. rien : Playwright prend alors le sien. C'est le cas d'un runner de CI
 *      après `npx playwright install chromium`, et il ne faut rien lui imposer.
 *
 * Le dossier est `PLAYWRIGHT_BROWSERS_PATH`, sinon `/opt/pw-browsers`, celui
 * des postes du nuage.
 *
 * @param {Record<string, string | undefined>} [env]
 * @returns {string | undefined}
 */
export function cheminDuNavigateur(env = process.env) {
  const demande = env.PLAYWRIGHT_EXECUTABLE_PATH || env.CHROMIUM_PATH || env.CHROME_ATLAS;
  if (demande) return demande;

  const racine = env.PLAYWRIGHT_BROWSERS_PATH || "/opt/pw-browsers";
  if (!existsSync(racine)) return undefined;

  const lien = `${racine}/chromium`;
  if (existsSync(lien)) return lien;

  const versions = readdirSync(racine)
    .map((nom) => /^chromium-(\d+)$/.exec(nom))
    .filter((m) => m !== null)
    .sort((a, b) => Number(b[1]) - Number(a[1]));
  for (const [nom] of versions) {
    for (const sous of ["chrome-linux64", "chrome-linux"]) {
      const chemin = `${racine}/${nom}/${sous}/chrome`;
      if (existsSync(chemin)) return chemin;
    }
  }
  return undefined;
}
