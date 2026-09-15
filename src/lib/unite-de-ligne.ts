/**
 * L'UNITÉ D'UNE LIGNE QUAND ON N'A RIEN TOUCHÉ : « u ».
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **Sa demande du 15 septembre 2026 :** *« ce qui serait bien c'est que l'u
 * soit mise sur le devis ou facture par défaut : si on ne touche à rien, elle
 * se pose, on la voit. Tout à l'heure j'ai voulu valider et j'avais pas mis u,
 * sauf que je le voyais en gris clair, je pensais qu'il était posé par
 * défaut. »*
 *
 * Le champ montrait « u » en texte d'attente — gris clair —, ce qui se lit
 * comme une valeur posée, et le papier sortait sans unité. Une pièce se compte
 * en « u » ; c'est le cas de presque toutes ses lignes, et c'est ce que le
 * papier doit dire quand il n'a rien précisé.
 *
 * **Une seule règle, pour l'écran ET le papier.** La base garde `NULL` quand
 * il n'a rien tapé — rien n'y est inventé —, et c'est ICI, à la lecture, que
 * `NULL` veut dire « u ». L'écrire aussi à l'insertion serait une seconde
 * règle : le jour où l'une change, un devis et sa facture ne diraient plus la
 * même chose.
 */
export const UNITE_PAR_DEFAUT = "u";

export function uniteDeLaLigne(unite: string | null | undefined): string {
  const propre = (unite ?? "").trim();
  return propre === "" ? UNITE_PAR_DEFAUT : propre;
}
