/**
 * LES SAUTS DE PAGE DU DEVIS, ET SES ESPACES — sa planche du 3 novembre 2026,
 * codée le 4 (`appli/soignee/devis-mise-en-page.html`, « Nouvelle page ici »),
 * puis sa réponse du 4 sur `devis-mise-en-page-questions.html` : « dans la 1
 * oui la B », des espaces, et plusieurs « d'affilée ».
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

/**
 * Au plus : une page entière d'espaces (842 points, 30 par espace). La page
 * n'en prend de toute façon que ce qu'elle tient ; le plafond borne seulement
 * ce qu'une requête peut écrire.
 */
export const ESPACES_AU_PLUS = 27;

/**
 * Un espace de plus devant `cle` : sa réponse du 4 novembre 2026, plusieurs
 * « d'affilée ». Rend `null` au plafond, plutôt qu'une liste inchangée qu'on
 * prendrait pour un espace posé.
 */
export function unEspaceDePlus(
  espaces: Readonly<Record<string, number>>,
  cle: string
): Record<string, number> | null {
  const n = (espaces[cle] ?? 0) + 1;
  return n > ESPACES_AU_PLUS ? null : { ...espaces, [cle]: n };
}

/** Plus aucun espace devant `cle` : la croix de sa puce, ou un saut posé à sa place. */
export function sansEspacesDevant(espaces: Readonly<Record<string, number>>, cle: string): Record<string, number> {
  return Object.fromEntries(Object.entries(espaces).filter(([k]) => k !== cle));
}
