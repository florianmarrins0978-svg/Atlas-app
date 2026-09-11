/**
 * LE GESTE QUI POUSSE UN MOIS — la règle, à part de tout écran.
 *
 * ───────────────────────────────────────────────────────────────────────────
 * **Sa demande du 11 septembre 2026 :** *« ce qui serait bien c'est de pouvoir
 * déplacer les mois du planning en slidant soit à droite soit à gauche »*, puis,
 * dans la foulée : *« en plus des 2 flèches »*.
 *
 * **Cette précision décide tout, et elle ne se néglige pas.** `PRODUCT.md`
 * interdit qu'un geste caché porte une fonction à lui seul — *« pas de geste à
 * découvrir : un glissement, un appui long, un double appui ne s'apprennent pas
 * tout seuls »* —, parce que ceux qui s'en serviront ne sont pas à l'aise avec
 * un téléphone. Les deux flèches restent donc à leur place : le glissement est
 * un raccourci pour qui le connaît, jamais le seul chemin.
 *
 * Planche validée le 11 septembre : `appli/glisser-les-mois.html`, variante A
 * — *« le mois suit le doigt »*.
 *
 * **Écrit ici plutôt que dans le calendrier** (`CLAUDE.md` §4 sexies) : ce sont
 * deux décisions arithmétiques, et elles s'éprouvent sans monter un navigateur
 * ni promener un vrai doigt. L'écran, lui, ne fait que suivre ce qu'on lui
 * répond.
 * ───────────────────────────────────────────────────────────────────────────
 */

/**
 * Tant que le doigt n'a pas franchi ces pixels, le geste n'a pas encore de sens.
 *
 * **Trop bas, tout tremblement de la main déciderait d'un axe** — et une page
 * qu'on voulait faire défiler se bloquerait sous le doigt. Trop haut, le
 * glissement paraîtrait coller avant de partir.
 */
export const EVEIL_PX = 10;

/**
 * La part de la largeur au-delà de laquelle on change vraiment de mois.
 *
 * **On ne change pas de mois pour un frôlement** : en dessous, le mois revient
 * en place. Un quart de l'écran est ce qu'il a essayé sur la planche.
 */
export const PART_POUR_CHANGER = 0.25;

/** De quel côté part le geste — ou rien, tant qu'il est trop court pour le dire. */
export type AxeDuGeste = "cote" | "bas" | null;

/**
 * DE QUEL CÔTÉ PART LE DOIGT.
 *
 * **Le calendrier vit au milieu d'une page qui se fait défiler.** Un doigt qui
 * descend doit continuer à faire défiler : prendre la main sur tout mouvement
 * bloquerait la page sous le doigt de celui qui voulait seulement lire plus bas.
 * L'axe se décide UNE fois, au réveil, et ne change plus — sans quoi un
 * glissement un peu courbe basculerait d'un axe à l'autre en cours de route.
 */
export function axeDuGeste(dx: number, dy: number, eveil: number = EVEIL_PX): AxeDuGeste {
  if (Math.abs(dx) < eveil && Math.abs(dy) < eveil) return null;
  return Math.abs(dx) > Math.abs(dy) ? "cote" : "bas";
}

/**
 * COMBIEN DE MOIS LE GESTE FAIT FRANCHIR — −1, 0 ou +1.
 *
 * Pousser vers la GAUCHE (`dx` négatif) amène le mois SUIVANT, comme on pousse
 * une feuille pour découvrir celle du dessous.
 *
 * **`part` sert deux fois, et c'est voulu.** Au relâcher, elle vaut un quart :
 * c'est le seuil qui décide. Pendant le glissement, l'écran la rappelle à 0,5
 * pour savoir quel mois ÉCRIRE en titre — celui qui occupe le plus de place.
 * Sans cela on voit octobre arriver sous le doigt pendant que l'en-tête dit
 * encore septembre : deux vérités à deux centimètres, sur l'écran qui sert
 * justement à savoir où l'on est.
 *
 * **Une largeur nulle ne rend jamais un pas** : sans surface à parcourir, il n'y
 * a pas de geste à mesurer, et le comparer à zéro ferait franchir un mois au
 * moindre pixel (`CLAUDE.md` §5, « un contrôle qui mesure zéro ne mesure rien »).
 */
export function pasDuGlissement(
  dx: number,
  largeur: number,
  part: number = PART_POUR_CHANGER
): -1 | 0 | 1 {
  if (!(largeur > 0)) return 0;
  const seuil = largeur * part;
  if (dx <= -seuil) return 1;
  if (dx >= seuil) return -1;
  return 0;
}
