/**
 * LE TEMPS D'UN « ANNULER » : une seule durée pour toute l'appli.
 *
 * Six secondes, c'est le tiroir des retraits (`useRetraits`, la réversibilité
 * après plutôt que la confirmation avant, sa règle du 10 août 2026). C'est
 * aussi le bandeau d'un import rangé, depuis sa demande du 3 novembre 2026 :
 * *« une fois qu'ils sont rangés et que j'ai accepté, à la limite le Annuler
 * peut rester 6 secondes, mais il faut qu'il disparaisse un jour »*. Deux
 * durées écrites à deux endroits finissent toujours par diverger
 * (`CLAUDE.md` §3).
 */
export const ANNULER_PENDANT_MS = 6000;

/**
 * Ce que le serveur prend encore APRÈS les six secondes, et pourquoi il en faut.
 *
 * Le minuteur de l'écran part de la réponse qui lui a dit le temps restant,
 * donc un peu après le serveur ; et l'appui fait à la dernière seconde voyage
 * encore. Quatre secondes couvrent un aller et un retour lents sur le réseau
 * d'un chantier. Plus large, la porte resterait ouverte à un onglet qui
 * dormait : à son réveil, son minuteur retire le bandeau, mais un appui
 * tombé dans l'instant passerait encore.
 */
export const MARGE_RESEAU_ANNULER_MS = 4000;

/**
 * Le temps qui reste à montrer « Annuler », depuis le geste ; `null` une fois
 * passé. Compté par le SERVEUR : l'heure du téléphone n'y entre pas.
 */
export function resteAAnnuler(depuis: Date, maintenant: number): number | null {
  const reste = depuis.getTime() + ANNULER_PENDANT_MS - maintenant;
  // Une horloge qui recule ne prolonge pas la fenêtre au-delà de six secondes.
  return reste > 0 ? Math.min(reste, ANNULER_PENDANT_MS) : null;
}

/** Le serveur prend-il encore « Annuler » ? Les six secondes, plus la marge du réseau. */
export function annulationAdmise(depuis: Date, maintenant: number): boolean {
  return maintenant - depuis.getTime() <= ANNULER_PENDANT_MS + MARGE_RESEAU_ANNULER_MS;
}
