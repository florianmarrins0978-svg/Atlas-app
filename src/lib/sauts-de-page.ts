/**
 * LES SAUTS DE PAGE DU DEVIS — sa planche du 3 novembre 2026, codée le 4
 * (`appli/soignee/devis-mise-en-page.html`, « Nouvelle page ici »).
 *
 * Un saut se pose DEVANT un élément du devis, jamais à une hauteur : une ligne
 * (`ligne:<id de la ligne de prix>`), ou un bloc de la fin. C'est ce qui le
 * garde devant la même ligne quand il en ajoute au-dessus.
 *
 * **Règle pure, et ce n'est pas un rangement** : l'action qui pose un saut, la
 * route qui dit où sont les éléments et l'écran qui les montre lisent la même
 * liste. Une clé validée deux fois de deux façons finirait par laisser passer
 * à l'un ce que l'autre refuse (`CLAUDE.md` §3).
 */

/** Les blocs de la fin qu'on peut faire passer à la page suivante. */
export const BLOCS_A_SAUTER = ["totaux", "notes", "modalites"] as const;

const LIGNE = /^ligne:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** La clé, si elle désigne un élément qu'on peut faire sauter ; sinon `null`. */
export function cleDeSaut(valeur: unknown): string | null {
  if (typeof valeur !== "string") return null;
  if ((BLOCS_A_SAUTER as readonly string[]).includes(valeur)) return valeur;
  return LIGNE.test(valeur) ? valeur : null;
}

/** Pose le saut s'il n'y est pas, le retire s'il y est. L'ordre ne compte pas. */
export function basculerSaut(sauts: readonly string[], cle: string): string[] {
  return sauts.includes(cle) ? sauts.filter((s) => s !== cle) : [...sauts, cle];
}
