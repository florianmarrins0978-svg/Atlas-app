// La grille de prix du fendage — hauteur de l'arbre × diamètre du tronc.
//
// **Ce que le patron a demandé, le 8 août 2026 :** *« pour la fente ils
// devraient demander la hauteur de l'arbre et son diamètre et on crée une liste
// de prix en fonction de la hauteur et du diamètre comme ça il invente rien. »*
// Puis, sur une première proposition à 3 × 3 cases : *« par contre il faut
// faire plus de tranche. »*
//
// **Pourquoi ces deux mesures, et pas le temps passé.** Ce qu'on fend, c'est du
// volume de bois. Le volume d'un tronc va comme le carré du diamètre multiplié
// par la hauteur : deux troncs de même hauteur, l'un de 30 cm et l'autre de
// 60 cm, ne font pas le double de bois mais le quadruple. Une grille à deux
// entrées suit cette réalité de bien plus près qu'une durée dictée à la louche.
//
// **La grille naît VIDE, et c'est le point entier.** Aucun prix n'y est posé par
// ce dépôt : un prix inventé serait exactement ce que `docs/AGENT.md` §3 interdit,
// et une case pré-remplie au jugé se retrouverait sur un devis client sans que
// personne ne l'ait décidée. Une case vide est une question posée — jamais un
// prix approché.
//
// Elle se remplit de deux façons, et les deux comptent :
//
//   1. **à la main**, depuis les réglages : le patron pose le prix d'une case
//      avant même d'avoir eu le chantier ;
//   2. **toute seule**, quand il écrit un prix de fendage sur un devis dont la
//      hauteur et le diamètre sont connus. C'est sa décision qui s'y range, pas
//      une moyenne.
//
// **Aucune interpolation, jamais.** Une case vide entourée de cases remplies
// pourrait « se deviner ». On ne le fait pas : un prix deviné se présenterait
// avec l'autorité des prix voisins, et le patron n'aurait aucun moyen de voir
// qu'il n'a jamais été décidé. Il vaut mieux poser la question.

/** Une tranche de la grille : sa clé stable, et ce que le patron lit. */
export type Tranche = {
  /** Clé stable, écrite en base. Ne change jamais — la mémoire en dépend. */
  cle: string;
  /** Borne basse **exclue**, en cm ou en m. */
  de: number;
  /** Borne haute **incluse**. `null` pour la dernière tranche, ouverte. */
  a: number | null;
  libelle: string;
};

/**
 * Les tranches de diamètre, en centimètres au pied.
 *
 * **Pourquoi si serré en bas et large en haut.** Entre 20 et 60 cm se trouve
 * l'essentiel de ce qui s'abat chez un particulier, et c'est là que 10 cm de
 * plus changent vraiment la quantité de bois. Au-delà de 90 cm, les arbres sont
 * rares et se chiffrent de toute façon un par un.
 *
 * La charnière de 70 cm vient de son propre dossier du 5 août 2026 : c'est le
 * diamètre du chêne mort qui sert d'exemple à tout le projet.
 */
export const DIAMETRES: readonly Tranche[] = [
  { cle: "d0", de: 0, a: 20, libelle: "jusqu'à 20 cm" },
  { cle: "d20", de: 20, a: 30, libelle: "20 à 30 cm" },
  { cle: "d30", de: 30, a: 40, libelle: "30 à 40 cm" },
  { cle: "d40", de: 40, a: 50, libelle: "40 à 50 cm" },
  { cle: "d50", de: 50, a: 60, libelle: "50 à 60 cm" },
  { cle: "d60", de: 60, a: 70, libelle: "60 à 70 cm" },
  { cle: "d70", de: 70, a: 90, libelle: "70 à 90 cm" },
  { cle: "d90", de: 90, a: null, libelle: "plus de 90 cm" },
];

/**
 * Les tranches de hauteur, en mètres.
 *
 * Cinq mètres est la maille qu'un élagueur estime à l'œil sans se tromper — au
 * mètre près, il devrait mesurer, et la question deviendrait pénible là où elle
 * doit se répondre en deux secondes (`docs/AGENT.md` §2 : l'arrêt reste
 * franchissable).
 */
export const HAUTEURS: readonly Tranche[] = [
  { cle: "h0", de: 0, a: 5, libelle: "jusqu'à 5 m" },
  { cle: "h5", de: 5, a: 10, libelle: "5 à 10 m" },
  { cle: "h10", de: 10, a: 15, libelle: "10 à 15 m" },
  { cle: "h15", de: 15, a: 20, libelle: "15 à 20 m" },
  { cle: "h20", de: 20, a: 25, libelle: "20 à 25 m" },
  { cle: "h25", de: 25, a: null, libelle: "plus de 25 m" },
];

/**
 * Dans quelle tranche tombe une mesure.
 *
 * **La borne haute est INCLUSE** : un tronc de 50 cm est « 40 à 50 cm », pas
 * « 50 à 60 ». C'est ainsi qu'on lit une grille en français, et les valeurs
 * rondes — 40, 50, 60 — sont précisément celles qu'un artisan annonce. Se
 * tromper de côté sur ces trois-là déplacerait la majorité des cas.
 *
 * Rend `null` sur une mesure qui n'en est pas une : zéro, négative, infinie.
 * Aucune tranche par défaut — on ne range pas au hasard ce qu'on n'a pas mesuré.
 */
export function trancheDe(valeur: number, tranches: readonly Tranche[]): Tranche | null {
  if (!Number.isFinite(valeur) || valeur <= 0) return null;
  return tranches.find((t) => valeur > t.de && (t.a === null || valeur <= t.a)) ?? null;
}

export type CelluleFendage = {
  /** Clé de la case, `h10|d40`. Stable : c'est elle qui est écrite en base. */
  cle: string;
  hauteur: Tranche;
  diametre: Tranche;
  /** Ce que le patron lit : « 10 à 15 m de haut · tronc de 40 à 50 cm ». */
  libelle: string;
};

/**
 * La case de la grille qui correspond à un arbre.
 *
 * Rend `null` dès qu'une des deux mesures manque : **sans les deux, il n'y a pas
 * de case**, et donc pas de prix à aller chercher. C'est le cas normal au début
 * d'une dictée, pas une anomalie — il déclenche la question.
 */
export function celluleFendage(hauteurM: number | null, diametreCm: number | null): CelluleFendage | null {
  if (hauteurM === null || diametreCm === null) return null;
  const hauteur = trancheDe(hauteurM, HAUTEURS);
  const diametre = trancheDe(diametreCm, DIAMETRES);
  if (!hauteur || !diametre) return null;
  return {
    cle: `${hauteur.cle}|${diametre.cle}`,
    hauteur,
    diametre,
    libelle: `${hauteur.libelle} de haut · tronc de ${diametre.libelle}`,
  };
}

/** Retrouve une case depuis sa clé — pour relire ce qui a été écrit en base. */
export function celluleDepuisCle(cle: string): CelluleFendage | null {
  const [cleHauteur, cleDiametre] = cle.split("|");
  const hauteur = HAUTEURS.find((t) => t.cle === cleHauteur);
  const diametre = DIAMETRES.find((t) => t.cle === cleDiametre);
  if (!hauteur || !diametre) return null;
  return {
    cle: `${hauteur.cle}|${diametre.cle}`,
    hauteur,
    diametre,
    libelle: `${hauteur.libelle} de haut · tronc de ${diametre.libelle}`,
  };
}

/** Toutes les cases, dans l'ordre où l'écran les affiche : une ligne par hauteur. */
export function toutesLesCellules(): CelluleFendage[] {
  return HAUTEURS.flatMap((hauteur) =>
    DIAMETRES.map((diametre) => ({
      cle: `${hauteur.cle}|${diametre.cle}`,
      hauteur,
      diametre,
      libelle: `${hauteur.libelle} de haut · tronc de ${diametre.libelle}`,
    }))
  );
}

/**
 * Le prix d'un fendage, s'il a déjà été décidé pour cette case.
 *
 * `prixConnus` est la grille telle qu'elle est en base : clé de case → prix HT.
 * Rend `null` quand la case est vide, **sans jamais regarder les voisines** —
 * voir l'en-tête de ce fichier : pas d'interpolation.
 */
export function prixDuFendage(
  cellule: CelluleFendage | null,
  prixConnus: ReadonlyMap<string, string>
): { prix: string; cellule: CelluleFendage } | null {
  if (!cellule) return null;
  const prix = prixConnus.get(cellule.cle);
  if (prix === undefined) return null;
  return { prix, cellule };
}
