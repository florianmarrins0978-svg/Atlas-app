/**
 * LE TOURNAGE CHANGE D'ÉCRAN ENTRE DEUX FILMS.
 *
 * Les films du site (appli/scripts/film-outils.cjs) se tournent dans ces
 * démonstrations, d'une traite par outil. Entre le dernier geste de
 * l'artisan et le compte rendu que lit son client, il n'y a pas de geste
 * dans l'appli : c'est un autre téléphone. Le tournage ouvre donc cet écran
 * par un message que la page s'envoie à elle-même :
 *
 *   window.postMessage({ revenir: "<chemin>" }, "*")
 *
 * Avant les films, la page du site pilotait ici le téléphone à la demande
 * d'un guide (toucher, faire défiler) ; sa correction du 20 novembre 2026,
 * « comme s'il regardait un film », a retiré le guide, et ses ordres avec.
 */
import { naviguer } from "./routeur";

export function ecouterLeTournage() {
  window.addEventListener("message", (e) => {
    if (e.source !== window) return;
    const ordre = e.data as { revenir?: unknown } | null;
    if (ordre && typeof ordre.revenir === "string") naviguer(ordre.revenir);
  });
}
