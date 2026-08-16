/**
 * Ce qui fait qu'un nouveau mot de passe est acceptable.
 *
 * *Dessiné le 14 août 2026 (`maquettes/atlas-reglages-moi.html`, écran 3), codé
 * le même jour après sa réponse : « il faut pouvoir confirmer son mdp 2× avant
 * de le changer et met le petit œil à côté pour afficher ou non le mdp ».*
 *
 * **Fonction pure, et c'est ce qui empêche les deux écarts habituels.** La même
 * fonction décide si le bouton s'allume ET si l'action serveur accepte
 * (`CLAUDE.md` §3). Deux implémentations divergent toujours, et ici la
 * divergence se paierait dans le mauvais sens : un bouton allumé sur une saisie
 * que le serveur refuse, ou l'inverse — un artisan qui croit son mot de passe
 * changé alors qu'il ne l'est pas.
 *
 * **Ce que cette règle NE fait pas, délibérément :** aucune exigence de
 * majuscule, de chiffre ou de caractère spécial. Elles ne rendent pas un mot de
 * passe plus sûr qu'une phrase longue, et sur un chantier elles produisent des
 * mots de passe notés sur un carnet. Huit caractères, et c'est tout.
 */

/** Huit caractères : ce que l'écran annonce, et ce que le serveur exige. */
export const LONGUEUR_MINIMALE = 8;

export type RefusMotDePasse =
  /** Moins de huit caractères. */
  | "trop-court"
  /** La confirmation ne redit pas la même chose. */
  | "confirmation-differente"
  /** Le nouveau est l'ancien : le geste n'aurait rien fait. */
  | "sans-changement"
  /** L'ancien mot de passe n'est pas celui du compte. */
  | "actuel-faux";

/**
 * Ce qui bloque, ou `null` si rien ne bloque.
 *
 * **L'ordre des contrôles est celui de la saisie**, et il n'est pas
 * indifférent : signaler « la confirmation diffère » alors que le mot de passe
 * fait trois caractères envoie corriger la mauvaise ligne. On dit d'abord ce
 * qui manque là où le doigt se trouve.
 */
export function verifierNouveauMotDePasse(
  nouveau: string,
  confirmation: string,
  actuel?: string
): RefusMotDePasse | null {
  if (nouveau.length < LONGUEUR_MINIMALE) return "trop-court";
  if (actuel !== undefined && actuel !== "" && nouveau === actuel) return "sans-changement";
  // La confirmation se compare TELLE QUELLE, espaces compris : un mot de passe
  // qui commence par une espace est un mot de passe valable, et le rogner ici
  // enregistrerait autre chose que ce qu'il a tapé.
  if (confirmation !== nouveau) return "confirmation-differente";
  return null;
}

/** Ce que l'artisan lit. Une phrase, pas un code. */
export function messageRefus(refus: RefusMotDePasse): string {
  switch (refus) {
    case "trop-court":
      return `Il faut au moins ${LONGUEUR_MINIMALE} caractères.`;
    case "confirmation-differente":
      return "Les deux saisies ne sont pas identiques.";
    case "sans-changement":
      return "C'est déjà votre mot de passe actuel.";
    case "actuel-faux":
      // **Ne dit PAS « mot de passe incorrect » tout court.** Sur cet écran il y
      // a trois champs : la phrase doit désigner LEQUEL, sans quoi il retape le
      // nouveau (`AGENTS.md` — une erreur qui accuse à tort coûte plus cher que
      // pas d'erreur du tout).
      return "Votre mot de passe actuel n'est pas celui-là.";
  }
}

/**
 * Ce que la ligne sous la confirmation dit, pendant la frappe.
 *
 * `null` tant qu'il n'a rien écrit dans la confirmation : lui annoncer que les
 * deux diffèrent alors qu'il n'a pas commencé à retaper serait une alarme qui
 * hurle à vide, et c'est ainsi qu'on apprend à ne plus les lire.
 */
export function etatConfirmation(
  nouveau: string,
  confirmation: string
): { identiques: boolean; message: string } | null {
  if (confirmation === "") return null;
  return confirmation === nouveau
    ? { identiques: true, message: "Les deux sont identiques ✓" }
    : { identiques: false, message: "Les deux saisies ne sont pas identiques." };
}
