/**
 * Les chemins qu'on atteint SANS compte — et l'unique endroit où ils sont dits.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Pourquoi cette liste a quitté le middleware, le 12 août 2026.**
 *
 * Le patron, capture à l'appui : *« lorsque le client reçoit le lien cliquable
 * de la facture, s'il clique en dessous sur planning ou chantier, il a accès à
 * mon application. Ce n'est pas du tout ce que je veux. »*
 *
 * Il n'y avait pas de fuite — un appui sur « Planning » mène à la page de
 * connexion, et aucune de ses données n'est lisible. Mais **son client voyait
 * les onglets de son outil de travail au bas de sa facture**, ce qui est déjà
 * un de trop : une facture n'est pas un écran d'application, et une barre de
 * navigation inopérante est pire qu'absente.
 *
 * **La cause n'était pas l'oubli, c'était la duplication.** Deux listes
 * tenaient la même vérité, chacune de son côté :
 *
 *   - le middleware savait que `/factures` est public — il le disait depuis le
 *     6 août ;
 *   - la mise en page tenait sa PROPRE liste d'écrans sans navigation, où
 *     `/devis` figurait et `/factures` avait été oublié.
 *
 * Un écran public ajouté plus tard n'entrait donc que dans l'une des deux. Le
 * dépôt connaît ce défaut par cœur — c'est celui des barres de défilement, où
 * trois zones portaient la règle et la quatrième l'avait perdue. Deux copies de
 * la même règle finissent toujours par diverger (`CLAUDE.md` §3).
 *
 * **L'invariant, désormais tenu par construction :** ce qui est atteignable
 * sans session ne porte jamais la navigation du patron. Un nouveau chemin
 * public ajouté ici l'obtient des deux côtés, sans que personne ait à y penser.
 */
export const CHEMINS_PUBLICS = [
  "/login",
  "/api/auth",
  "/api/cron",
  "/api/session-perimee",
  // La page de réponse du client au devis. Elle n'est pas « ouverte » pour
  // autant : son seul accès est un jeton imprévisible, contrôlé en base par une
  // politique dédiée (migration 0015). Sans jeton exact, aucune ligne n'est
  // lisible.
  "/devis",
  // Même logique depuis le 6 août 2026, même garde-fou (migration 0024) : le
  // patron avait constaté que sa facture arrêtée ne parvenait jamais à son
  // client, faute de tout chemin vers lui.
  "/factures",
] as const;

/** Ce chemin est-il atteignable sans compte ? */
export function estCheminPublic(chemin: string): boolean {
  return CHEMINS_PUBLICS.some((p) => chemin === p || chemin.startsWith(`${p}/`));
}
