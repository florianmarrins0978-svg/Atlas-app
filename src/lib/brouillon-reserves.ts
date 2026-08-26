/**
 * CE QUE LE BROUILLON MET EN RÉSERVE — « À confirmer », « Non mentionné ».
 *
 * **Sa demande du 25 août 2026, capture à l'appui :** *« le à confirmer est trop
 * long, synthétise-le. Moins de mots ! »* Son écran portait deux questions
 * rédigées de trois lignes chacune, puis six manques — quatorze lignes de gris
 * avant d'arriver à ses prestations.
 *
 * **Deux leviers, et il en fallait deux.** La consigne donnée au modèle
 * (`extraction-service.ts`) raccourcit ce qu'il ÉCRIRA ; elle ne peut rien pour
 * les brouillons déjà enregistrés, qui gardent leurs phrases. Cette règle-ci
 * agit à la lecture, sur les uns comme sur les autres.
 *
 * **Ce qui est coupé se DIT.** Une liste tronquée en silence se lit comme une
 * liste complète : il croirait avoir vu toutes les réserves, et il chiffrerait
 * sans celle qui manquait. C'est la même règle que pour le plan d'arrosage
 * (`CLAUDE.md` §4 ter) — ce qui n'est pas montré s'écrit à l'écran.
 */

/**
 * Cinq, et pas dix. Il les lit sur un téléphone, entre deux chantiers : au-delà
 * il ne les lit plus du tout, et une liste qu'on ne lit pas ne protège de rien.
 */
export const RESERVES_MONTREES = 5;

export type Reserves = {
  /** Ce qui s'affiche, dans l'ordre du modèle — les plus importantes d'abord. */
  montrees: string[];
  /** Combien restent en dessous. Zéro : rien n'a été coupé. */
  reste: number;
};

/**
 * Les réserves à montrer, et le compte de celles qu'on laisse.
 *
 * **Le texte n'est PAS raccourci ici, et c'est délibéré.** Couper une phrase à
 * six mots donnerait « Il est mentionné 'des herbages, des massifs' » — la
 * question posée disparaîtrait et il resterait une entrée en matière qui ne
 * demande rien. Ce qui se coupe proprement, c'est le NOMBRE ; la brièveté des
 * lignes se joue à l'écriture, dans la consigne donnée au modèle.
 */
export function reservesLisibles(items: readonly string[] | null | undefined): Reserves {
  const propres = (items ?? []).map((t) => t.trim()).filter(Boolean);
  return {
    montrees: propres.slice(0, RESERVES_MONTREES),
    reste: Math.max(0, propres.length - RESERVES_MONTREES),
  };
}

/** « + 3 autres ». Rien du tout quand rien n'est coupé. */
export function phraseDuReste(reste: number): string | null {
  if (reste <= 0) return null;
  return `+ ${reste} autre${reste > 1 ? "s" : ""}`;
}
