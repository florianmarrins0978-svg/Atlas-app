import { chromium, devices, type Browser, type LaunchOptions } from "playwright";
import { existsSync } from "node:fs";

// Chemin spécifique à cet environnement de développement — utilisé
// uniquement s'il existe réellement. Sur un runner CI standard (après
// `npx playwright install chromium`), ce chemin n'existe pas : Playwright
// utilise alors son propre navigateur installé, sans configuration
// supplémentaire. PLAYWRIGHT_EXECUTABLE_PATH permet de surcharger
// explicitement si besoin (un autre environnement de développement, par
// exemple).
const CHEMIN_SANDBOX = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

/**
 * Le délai par défaut de toute attente, dans toutes les suites.
 *
 * **Trois faux échecs le 7 août 2026, tous le même.** Une suite passe seule et
 * tombe en batterie ; le message accuse alors le produit — l'adresse qui ne se
 * remplit pas, le lien du client qui n'arrive pas — alors que le seul coupable
 * est un serveur de développement qui compile une route pour la première fois,
 * sous trente-huit suites enchaînées.
 *
 * Un contrôle qui échoue au hasard est pire qu'aucun contrôle : il apprend à
 * ignorer le rouge. Quarante-cinq secondes ne cachent aucun défaut réel — une
 * page qui met plus de quarante-cinq secondes est cassée pour de bon — et elles
 * suppriment une classe entière de fausses alertes.
 *
 * Posé ICI plutôt que sur chaque appel : une valeur par site d'appel, c'est
 * trente endroits à corriger et vingt-neuf oublis.
 */
export const DELAI_PAR_DEFAUT_MS = 45_000;

/**
 * L'écran du patron — celui qu'il a dans la main, pas celui qu'on imagine.
 *
 * **Le 11 août 2026, un contrôle de chevauchement est passé au vert sur une
 * mise en page qui, chez lui, recouvrait « ou rédiger le devis à la main ».**
 * Les suites posaient 393 × 852 : la taille d'un iPhone 14 Pro *dalle
 * comprise*. Or la barre d'adresse du navigateur en mange près de deux cents —
 * la hauteur réellement disponible pour la page est de **664** px. Sur le cadre
 * trop haut, la bulle de l'assistant tombait 190 px plus bas et ne recouvrait
 * rien. Un contrôle qui mesure un écran que personne ne possède ne prouve pas
 * qu'il n'y a pas de défaut : il prouve qu'il ne sait pas le voir.
 *
 * `devices["iPhone 13"]` est le descripteur de Playwright, tenu à jour par des
 * gens dont c'est le métier : 390 × 664, trois pixels par point, tactile.
 * Écrire ces nombres à la main, c'est se condamner à les voir vieillir.
 *
 * **Posé ICI plutôt que sur chaque appel**, pour la même raison que le délai
 * ci-dessus : quarante sites d'appel, c'est quarante corrections et
 * trente-neuf oublis. Une suite qui a besoin d'autre chose — le devis complet
 * s'ouvre aussi sur un écran d'ordinateur — passe son propre `viewport`, et
 * c'est alors un choix visible dans son code, pas un héritage subi.
 */
export const ECRAN_DU_PATRON = devices["iPhone 13"];

/**
 * **Retenir le saut vers Messages, sans jamais annuler le geste.**
 *
 * Depuis le 18 août 2026, l'appui sur « Envoyer le devis » touche pour le
 * patron un lien `sms:` ou `mailto:` (`ExportClient.ouvrirLaMessagerie`) : sa
 * demande, *« tout de suite ça m'ouvre l'application […] supprime les étapes
 * qu'il y a entre »*.
 *
 * **Chromium ne sait pas ouvrir ces schémas.** Il laisse une navigation en
 * suspens, et le `page.reload()` du contrôle suivant n'atteint plus jamais son
 * `load` — un dépassement de délai qui accuse le rechargement alors qu'il va
 * très bien. Vingt et une suites appuient sur ce bouton : le défaut aurait
 * frappé partout, avec vingt et un messages qui désignent le mauvais coupable.
 *
 * On annule donc le SAUT, jamais le geste : le lien est bien créé et touché, et
 * c'est lui que les contrôles lisent (`a[data-transmission-directe]`). Ce
 * qu'aucun navigateur d'ici ne peut faire — ouvrir Messages —, on ne prétend
 * pas le faire.
 *
 * **Posé ICI plutôt que dans chaque suite**, pour la raison qui vaut déjà pour
 * le délai et l'écran : une garde écrite dans la première suite est une garde
 * oubliée dans les vingt suivantes.
 *
 * En chaîne, et non en fonction : `tsx` renomme les fonctions à la compilation
 * (`__name`), et le helper n'existe pas dans la page — l'évaluation tombe alors
 * sur « __name is not defined », une erreur qui accuse le contrôle au lieu du
 * code.
 */
const RETENIR_LE_SAUT_VERS_LA_MESSAGERIE = `
  window.__ouvertures = [];
  document.addEventListener("click", function (e) {
    var cible = e.target && e.target.closest
      ? e.target.closest("a[href^='sms:'],a[href^='mailto:']")
      : null;
    if (!cible) return;
    // Ce que l'application a tenté d'ouvrir se garde ICI, pour les contrôles.
    window.__ouvertures.push(cible.getAttribute("href"));
    e.preventDefault();
  }, true);
`;

/**
 * Le navigateur des suites, dont chaque contexte naît déjà patient — et déjà
 * à la taille du téléphone du patron.
 *
 * `newContext` est enveloppé plutôt que documenté : compter sur chaque suite
 * pour poser le délai et l'écran elle-même, c'est les poser dans la première et
 * les oublier dans les suivantes.
 *
 * **L'écran ne s'impose pas, il se propose.** Une suite qui passe son propre
 * `viewport` garde le sien — le devis complet, par exemple, s'ouvre aussi sur
 * un écran d'ordinateur, et le lui refuser serait remplacer un cadre faux par
 * un autre. Ce qui change, c'est le DÉFAUT : ne rien dire vaut désormais « le
 * téléphone », et non plus « une fenêtre d'ordinateur de 800 × 600 ».
 */
export async function lancerNavigateur(optionsSupplementaires: Omit<LaunchOptions, "executablePath"> = {}): Promise<Browser> {
  const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH ?? (existsSync(CHEMIN_SANDBOX) ? CHEMIN_SANDBOX : undefined);
  const navigateur = await chromium.launch({ ...optionsSupplementaires, ...(executablePath ? { executablePath } : {}) });

  const creerContexte = navigateur.newContext.bind(navigateur);
  navigateur.newContext = async (...args: Parameters<typeof creerContexte>) => {
    const [options, ...reste] = args;
    const surMesure = options?.viewport !== undefined;
    const contexte = await creerContexte(
      surMesure ? options : { ...ECRAN_DU_PATRON, ...options },
      ...reste
    );
    contexte.setDefaultNavigationTimeout(DELAI_PAR_DEFAUT_MS);
    contexte.setDefaultTimeout(DELAI_PAR_DEFAUT_MS);
    await contexte.addInitScript(RETENIR_LE_SAUT_VERS_LA_MESSAGERIE);
    return contexte;
  };

  return navigateur;
}
