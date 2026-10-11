/**
 * GLISSER VERS LA DROITE POUR REVENIR : la règle du geste, sans écran.
 *
 * **Sa demande du 25 septembre 2026 :** *« à chaque fois qu'il y a une touche
 * retour pour une page, qu'on puisse faire retour en slidant de gauche vers la
 * droite »*. Planche `appli/glisser-pour-revenir.html` ; il a retenu la **B** :
 * le geste part de n'importe où sur la page, pas seulement du bord.
 *
 * Ce fichier ne décide que du MOUVEMENT. Où le geste mène, c'est la flèche de
 * l'écran qui le sait (`GesteRetour.tsx` l'appuie) : deux chemins de retour
 * finiraient par ne plus mener au même endroit (`CLAUDE.md` §3).
 */

/** En deçà, le doigt n'a pas encore dit où il va : un appui, pas un geste. */
export const SEUIL_DE_LECTURE = 10;

/**
 * Le bord laissé au téléphone, dans un onglet de navigateur.
 *
 * Safari recule déjà depuis ce bord, par son historique à lui. Y répondre
 * aussi ferait reculer DEUX fois. Posée sur l'écran d'accueil, l'application
 * n'a plus ce geste du navigateur : le bord redevient le nôtre.
 */
export const BORD_DU_NAVIGATEUR = 20;

/** La part de la largeur au-delà de laquelle, lâché, on recule. */
export const PART_POUR_RECULER = 0.35;

/** Un coup sec (en px/ms) recule même court, comme sur l'iPhone. */
export const ELAN_POUR_RECULER = 0.5;
/** Mais pas un tressaillement : sous cette distance, l'élan ne compte pas. */
export const DISTANCE_MINIMALE_D_ELAN = 40;

export function bordLaisseAuNavigateur(x: number, dansUnOnglet: boolean): boolean {
  return dansUnOnglet && x < BORD_DU_NAVIGATEUR;
}

/**
 * Ce que le doigt a dit après ses premiers pixels.
 *
 * **Nettement de côté, et vers la droite**, sinon on le laisse : un doigt qui
 * descend fait défiler la page, et un doigt qui part à gauche découvre
 * « Retirer » sur une ligne (`LigneRetirable`). Le rapport de 1,5 écarte la
 * diagonale d'un pouce qui fait défiler.
 */
export function lectureDuDoigt(dx: number, dy: number): "attendre" | "suivre" | "laisser" {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < SEUIL_DE_LECTURE) return "attendre";
  return dx > 0 && dx > 1.5 * Math.abs(dy) ? "suivre" : "laisser";
}

/** Lâché ici, avec cet élan : recule-t-on ? */
export function faitReculer(dx: number, elan: number, largeur: number): boolean {
  if (dx >= largeur * PART_POUR_RECULER) return true;
  return elan >= ELAN_POUR_RECULER && dx >= DISTANCE_MINIMALE_D_ELAN;
}
