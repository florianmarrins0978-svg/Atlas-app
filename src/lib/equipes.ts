// Comment une équipe s'appelle à l'écran — et quand elle ne s'appelle pas.
//
// **Demandé par le patron le 2026-08-10 :** *« soit équipe A équipe B, soit
// l'utilisateur pourra mettre des noms et prénoms. Mais s'il n'a pas d'équipe
// et qu'il ne met rien, il ne faut pas qu'il y ait quand même écrit équipe A
// équipe B. »*
//
// ─────────────────────────────────────────────────────────────────────────────
// **UNE SEULE FONCTION décide, et c'est tout l'objet de ce fichier.**
//
// Elle sert au planning ET à la revalidation serveur. Deux implémentations de
// cette règle divergeraient, et le jour où elles divergent l'écran promet une
// équipe que le serveur ne connaît pas. C'est la règle de `CLAUDE.md` §3, et
// elle a déjà été payée ailleurs : deux phrases d'annonce du banc d'essai
// avaient divergé, et le contrôle a accusé le mauvais coupable deux jours
// durant (`ARCHITECTURE.md` §50).
// ─────────────────────────────────────────────────────────────────────────────

/** Ce que le repli sait nommer : vingt équipes, A à T. */
export const LETTRES_EQUIPES = "ABCDEFGHIJKLMNOPQRST".split("");

/** Le maximum, ici comme dans `entreprises.nombre_equipes` et en base. */
export const MAX_EQUIPES = LETTRES_EQUIPES.length;

/** Une équipe telle que la base la porte — `nom` absent est un état normal. */
export type EquipeNommable = {
  /** 1 à 20. Décide de la lettre de repli et de l'ordre. */
  rang: number;
  nom?: string | null;
};

/** La lettre de repli d'un rang — « A » pour 1. Hors bornes, rien. */
export function lettreDeRepli(rang: number): string | null {
  return LETTRES_EQUIPES[rang - 1] ?? null;
}

/**
 * Comment cette équipe s'écrit — ou `null` quand il ne faut RIEN écrire.
 *
 * Trois cas, et le premier est celui que le patron a nommé :
 *
 * 1. **Une seule équipe → `null`.** Il n'y a personne à distinguer. Une
 *    demi-journée est libre, ou elle porte le nom de son chantier. Écrire
 *    « Équipe A » à un artisan qui travaille seul serait lui inventer une
 *    organisation qu'il n'a pas.
 * 2. **Un nom écrit → ce nom**, débarrassé de ses espaces. Un champ contenant
 *    trois espaces n'est pas un nom : le traiter comme tel afficherait une
 *    ligne vide, indiscernable de sa voisine.
 * 3. **Rien d'écrit, plusieurs équipes → la lettre.** C'est un repli assumé,
 *    pas une invention : « Équipe B » ne prétend rien savoir de personne, mais
 *    on ne laisse jamais deux lignes indiscernables.
 *
 * `null` veut dire « n'écris rien », jamais « écris une chaîne vide ».
 * L'appelant doit alors omettre l'élément, pas afficher du blanc.
 */
export function libelleEquipe(
  equipe: EquipeNommable | null | undefined,
  nombreEquipes: number
): string | null {
  // Zéro ou une équipe : rien à distinguer, donc rien à écrire. Le compteur est
  // borné à 1 côté écran comme côté serveur, mais une valeur aberrante en base
  // ne doit pas se traduire par un nom inventé.
  if (!Number.isFinite(nombreEquipes) || nombreEquipes <= 1) return null;

  const ecrit = equipe?.nom?.trim();
  if (ecrit) return ecrit;

  const lettre = equipe ? lettreDeRepli(equipe.rang) : null;
  return lettre ? `Équipe ${lettre}` : null;
}

/**
 * Les équipes à montrer, dans l'ordre, pour un nombre donné.
 *
 * Complète les rangs manquants : le patron peut avoir nommé la troisième sans
 * jamais avoir touché la deuxième, et la deuxième doit quand même exister à
 * l'écran. Écarte ce qui dépasse le compteur — ces lignes sont conservées en
 * base à dessein (redescendre puis remonter ne perd pas un nom), mais elles ne
 * se montrent pas.
 */
export function equipesAffichees<T extends EquipeNommable>(
  equipes: readonly T[],
  nombreEquipes: number
): (T | EquipeNommable)[] {
  const borne = Math.min(MAX_EQUIPES, Math.max(1, Math.trunc(nombreEquipes) || 1));
  const parRang = new Map(equipes.map((e) => [e.rang, e]));
  return Array.from({ length: borne }, (_, i) => parRang.get(i + 1) ?? { rang: i + 1, nom: null });
}

/**
 * La phrase qui accompagne le compteur, dans Réglages.
 *
 * **Aucun mot de métier ici**, et c'est une consigne explicite : « chantiers de
 * front » a été soumis au patron et rejeté — *« pour moi rien »*. La phrase dit
 * ce que le réglage CHANGE, pas comment on l'appelle.
 */
export function phraseDuCompteur(nombreEquipes: number): string {
  return nombreEquipes <= 1
    ? "Un chantier à la fois : un jour pris n'est plus proposé."
    : "Un jour reste proposé tant qu'une équipe est libre.";
}
