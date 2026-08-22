// Les grilles de prix du patron — une par nature de travail.
//
// **Ce que le patron a demandé, le 8 août 2026 :** *« pour la fente ils
// devraient demander la hauteur de l'arbre et son diamètre et on crée une liste
// de prix en fonction de la hauteur et du diamètre comme ça il invente rien. »*
// Puis, sur une première proposition à 3 × 3 cases : *« par contre il faut
// faire plus de tranche. »*
//
// **Et le 14 août 2026 :** *« je dois pouvoir ajouter ou retirer des cases. »*
// Les tranches ci-dessous ne sont donc plus la grille : elles en sont le
// **point de départ**, celui d'une entreprise qui n'a encore rien réglé. Ce
// qu'une entreprise a réglé vit en base (`tranches_grille`, `natures_grille`),
// et toutes les fonctions de ce fichier prennent désormais ses axes en
// paramètre.
//
// **Le paramètre est OBLIGATOIRE, et c'est délibéré.** Une valeur par défaut
// silencieuse aurait chiffré un devis contre les tranches d'origine pendant que
// le patron remplissait les siennes — un prix faux qu'aucune erreur ne
// signale. Le compilateur oblige donc chaque appelant à dire quelles tranches
// il emploie.
//
// **Pourquoi ces deux mesures, et pas le temps passé.** Ce qu'on fend, c'est du
// volume de bois. Le volume d'un tronc va comme le carré du diamètre multiplié
// par la hauteur : deux troncs de même hauteur, l'un de 30 cm et l'autre de
// 60 cm, ne font pas le double de bois mais le quadruple. Une grille à deux
// entrées suit cette réalité de bien plus près qu'une durée dictée à la louche.
//
// **L'abattage se chiffre à la TECHNIQUE, pas à la hauteur**, et c'est lui qui
// l'a tranché : chez lui le même chêne de 70 cm vaut 600 € au pied, 1 000 € en
// démontage, 1 400 € avec rétention. La hauteur, elle, ne décide de rien — c'est
// pourtant elle que les dictées donnent (`docs/EXEMPLE-DICTEE.md`).
//
// **La haie n'a qu'une case**, et ce n'est pas un oubli : son devis du 5 août
// dit « 350 € pour 20 ml », soit 17,50 €/ml, sans mention de hauteur. Lui
// inventer une seconde dimension qu'il n'a jamais nommée ferait quarante cases
// vides à remplir pour rien.
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

/** Une façon d'abattre : c'est elle qui fait 600 ou 1 400 € du même arbre. */
export type Technique = { cle: string; libelle: string };

/**
 * Les trois axes d'une entreprise — ce à partir de quoi ses cases se fabriquent.
 *
 * Un seul objet plutôt que trois paramètres : le jour où un quatrième axe
 * apparaît, les signatures ne bougent pas.
 */
export type Axes = {
  diametres: readonly Tranche[];
  hauteurs: readonly Tranche[];
  techniques: readonly Technique[];
};

/**
 * Les tranches de diamètre d'origine, en centimètres au pied.
 *
 * **Pourquoi si serré en bas et large en haut.** Entre 20 et 60 cm se trouve
 * l'essentiel de ce qui s'abat chez un particulier, et c'est là que 10 cm de
 * plus changent vraiment la quantité de bois. Au-delà de 90 cm, les arbres sont
 * rares et se chiffrent de toute façon un par un.
 *
 * La charnière de 70 cm vient de son propre dossier du 5 août 2026 : c'est le
 * diamètre du chêne mort qui sert d'exemple à tout le projet.
 *
 * **Ce ne sont plus que des tranches de départ.** Elles valent pour une
 * entreprise qui n'a rien réglé ; dès qu'elle en ajoute ou en retire une, ce
 * sont les siennes qui font foi (`tranches_grille`).
 */
export const DIAMETRES_PAR_DEFAUT: readonly Tranche[] = [
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
 * Les tranches de hauteur d'origine, en mètres.
 *
 * Cinq mètres est la maille qu'un élagueur estime à l'œil sans se tromper — au
 * mètre près, il devrait mesurer, et la question deviendrait pénible là où elle
 * doit se répondre en deux secondes (`docs/AGENT.md` §2 : l'arrêt reste
 * franchissable).
 */
export const HAUTEURS_PAR_DEFAUT: readonly Tranche[] = [
  { cle: "h0", de: 0, a: 5, libelle: "jusqu'à 5 m" },
  { cle: "h5", de: 5, a: 10, libelle: "5 à 10 m" },
  { cle: "h10", de: 10, a: 15, libelle: "10 à 15 m" },
  { cle: "h15", de: 15, a: 20, libelle: "15 à 20 m" },
  { cle: "h20", de: 20, a: 25, libelle: "20 à 25 m" },
  { cle: "h25", de: 25, a: null, libelle: "plus de 25 m" },
];

/**
 * Les trois façons d'abattre d'origine, et l'écart de prix qu'elles portent.
 *
 * Les clés sont celles de l'arrêt d'avant-chiffrage (`questions-chiffrage.ts`) :
 * la question posée au patron et la case de sa grille doivent parler la même
 * langue, sinon sa réponse ne désigne rien.
 */
export const TECHNIQUES_PAR_DEFAUT: readonly Technique[] = [
  { cle: "au_pied", libelle: "au pied" },
  { cle: "demontage", libelle: "démontage" },
  { cle: "demontage_retention", libelle: "démontage avec rétention" },
];

/** Les axes d'une entreprise qui n'a encore rien réglé. */
export const AXES_PAR_DEFAUT: Axes = {
  diametres: DIAMETRES_PAR_DEFAUT,
  hauteurs: HAUTEURS_PAR_DEFAUT,
  techniques: TECHNIQUES_PAR_DEFAUT,
};

/** Lequel des trois axes — le mot est écrit en base, il ne change pas. */
export type NomAxe = "diametre" | "hauteur" | "technique";

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

// ---------------------------------------------------------------------------
// Ajouter et retirer des tranches — sa demande du 14 août 2026
// ---------------------------------------------------------------------------

/**
 * Le libellé d'une tranche, écrit comme il l'écrirait.
 *
 * Trois formes, et pas une de plus : la première tranche part de zéro
 * (« jusqu'à 20 cm »), la dernière est ouverte (« plus de 90 cm »), les autres
 * encadrent (« 40 à 50 cm »).
 */
export function libelleDeTranche(de: number, a: number | null, unite: string): string {
  if (a === null) return `plus de ${nombreCourt(de)} ${unite}`;
  if (de <= 0) return `jusqu'à ${nombreCourt(a)} ${unite}`;
  return `${nombreCourt(de)} à ${nombreCourt(a)} ${unite}`;
}

/** « 20 », pas « 20.00 » — et « 2,5 » avec la virgule française. */
function nombreCourt(n: number): string {
  return String(Math.round(n * 100) / 100).replace(".", ",");
}

/** L'unité d'un axe, telle qu'elle s'écrit dans un libellé. */
export function uniteDeAxe(axe: NomAxe): string {
  return axe === "hauteur" ? "m" : "cm";
}

/**
 * Une clé de tranche qui n'entre en collision avec aucune autre.
 *
 * **La clé ne se relit jamais comme une borne**, et c'est ce qui compte : elle
 * est écrite en base à côté d'un prix, et ce prix doit rester rattaché à la
 * même case même si le libellé change. `d90` désignait « plus de 90 cm » et
 * pourrait désigner demain « 90 à 120 cm » : le suffixe évite qu'un ancien prix
 * se retrouve rattaché à une tranche qui n'est plus la sienne.
 */
export function nouvelleCleTranche(axe: NomAxe, de: number, dejaPrises: ReadonlySet<string>): string {
  const prefixe = axe === "hauteur" ? "h" : axe === "diametre" ? "d" : "t";
  const base = `${prefixe}${Math.round(de)}`;
  if (!dejaPrises.has(base)) return base;
  for (let n = 2; n < 1000; n++) {
    const essai = `${base}_${n}`;
    if (!dejaPrises.has(essai)) return essai;
  }
  throw new Error("Impossible de nommer cette tranche : trop de tranches portent la même borne.");
}

/** Ce qu'une tranche neuve peut se voir refuser, et pourquoi. */
export type RefusTranche = { raison: string };

/**
 * Ranger une tranche neuve parmi les autres — ou dire pourquoi c'est impossible.
 *
 * **Le recouvrement est refusé, et ce n'est pas du zèle.** `trancheDe` retient
 * la PREMIÈRE tranche qui contient la mesure : deux tranches qui se chevauchent
 * ne produisent pas une erreur, elles produisent un prix pris dans la mauvaise
 * case. Un tronc de 95 cm chiffré au tarif des 20 cm ne se voit sur aucun
 * écran — il se voit sur le devis du client.
 *
 * La liste rendue est **triée par borne basse** : c'est l'ordre où le patron
 * lit sa grille, et l'ordre où `trancheDe` doit chercher.
 */
export function rangerTranche(
  tranches: readonly Tranche[],
  neuve: { de: number; a: number | null; libelle: string; cle: string }
): { tranches: Tranche[] } | RefusTranche {
  if (!Number.isFinite(neuve.de) || neuve.de < 0) {
    return { raison: "La borne basse doit être un nombre positif." };
  }
  if (neuve.a !== null && (!Number.isFinite(neuve.a) || neuve.a <= neuve.de)) {
    return { raison: "La borne haute doit être plus grande que la borne basse." };
  }
  const chevauche = tranches.find((t) => {
    const finT = t.a ?? Number.POSITIVE_INFINITY;
    const finN = neuve.a ?? Number.POSITIVE_INFINITY;
    return neuve.de < finT && t.de < finN;
  });
  if (chevauche) {
    // **Le cas de tous les jours, et il mérite sa phrase.** La dernière tranche
    // est ouverte — « plus de 90 cm » — donc TOUT ce qui dépasse 90 y tombe
    // déjà : aucune tranche plus haute ne peut s'ajouter tant qu'elle est là.
    // Un refus qui dirait seulement « ça recouvre » laisserait sans issue.
    //
    // On ne lui repousse PAS sa borne à sa place : un prix posé pour « plus de
    // 90 cm » deviendrait le prix des « plus de 120 cm » sans qu'il l'ait
    // décidé. Il retire, il repose — et ses prix l'attendent.
    if (chevauche.a === null) {
      return {
        raison:
          `« ${chevauche.libelle} » n'a pas de borne haute : tout ce qui dépasse ${chevauche.de} y tombe déjà. ` +
          `Retirez-la d'abord, puis reposez vos deux tranches — ses prix vous attendront.`,
      };
    }
    return {
      raison: `Cette tranche recouvre « ${chevauche.libelle} ». Deux tranches qui se chevauchent feraient chiffrer un arbre dans la mauvaise case.`,
    };
  }
  return { tranches: [...tranches, { ...neuve }].sort((x, y) => x.de - y.de) };
}

// ---------------------------------------------------------------------------
// Les natures de travail
// ---------------------------------------------------------------------------

/**
 * Comment les cases d'une grille se fabriquent.
 *
 * **Trois formes, parce que trois réalités** — et non par goût de la variété :
 * deux axes croisés quand deux choses décident du prix, un seul axe quand une
 * seule décide, une case quand le prix est unitaire et se multiplie.
 */
export type FormeGrille = "une-case" | "un-axe" | "technique-diametre" | "hauteur-diametre";

export type Nature = {
  /** Clé stable, écrite en base à côté de chaque prix. */
  cle: string;
  titre: string;
  aide: string;
  /** Le nom de l'axe, tel que l'écran l'annonce au-dessus des cases. */
  axe: string;
  forme: FormeGrille;
  /** Pour une grille à une seule case : sa clé et ce que le patron lit. */
  cleUnique?: string;
  libelleUnique?: string;
  /**
   * **Le chiffrage sait-il aller chercher cette grille tout seul ?**
   *
   * Les cinq natures d'origine, oui : `proposition-prix.ts` les reconnaît dans
   * une dictée. Une nature ajoutée par le patron, **non** — et c'est la limite
   * de ce geste, qu'il faut lui dire plutôt que la lui laisser découvrir. Sa
   * grille se remplit et se relit ; Atlas ne la proposera pas de lui-même tant
   * que rien ne lui apprend à la reconnaître dans une note vocale.
   */
  integree: boolean;
};

/** La case des grumes : un prix **à la tonne** (sa réponse du 9 août 2026). */
export const CELLULE_GRUMES = "tonne";

/** La case de la haie : un prix au mètre linéaire, et rien d'autre. */
export const CELLULE_HAIE = "ml";

/**
 * Les cinq natures d'origine, dans l'ordre du chantier — pas dans celui du code.
 *
 * L'abattage d'abord : c'est le poste qui porte le plus gros écart chez lui —
 * 600, 1 000 ou 1 400 € pour le même chêne selon la technique. Puis ce qui s'en
 * détache, dans l'ordre où il le fait : les grumes, la fente, la souche.
 *
 * **Elles vivaient dans l'écran jusqu'au 14 août 2026**, et leurs titres y
 * étaient écrits une seconde fois. Deux listes finissent toujours par diverger
 * (`CLAUDE.md` §3) ; celle-ci est désormais la seule.
 */
export const NATURES_PAR_DEFAUT: readonly Nature[] = [
  {
    cle: "abattage",
    titre: "Abattre un arbre",
    aide: "Par technique et par diamètre — c'est la technique qui fait le plus gros écart.",
    axe: "Diamètre du tronc",
    forme: "technique-diametre",
    integree: true,
  },
  {
    cle: "grumes",
    titre: "Enlever les grumes",
    // L'unité est dite à l'écran, parce que c'est elle qui change tout : un
    // prix saisi ici sera MULTIPLIÉ par le tonnage du chantier. Le taire ferait
    // écrire un forfait dans une case qui n'en est pas une.
    aide: "Un prix à la tonne. Atlas le multiplie par le tonnage enlevé sur le chantier.",
    axe: "",
    forme: "une-case",
    cleUnique: CELLULE_GRUMES,
    libelleUnique: "Prix de la tonne",
    integree: true,
  },
  {
    cle: "fendage",
    titre: "Fendre le bois",
    aide: "Par hauteur d'arbre et par diamètre : c'est le volume de bois qui décide.",
    axe: "Diamètre du tronc",
    forme: "hauteur-diametre",
    integree: true,
  },
  {
    cle: "dessouchage",
    titre: "Dessoucher",
    aide: "Par diamètre de souche seulement : la hauteur de l'arbre qui n'est plus là ne décide de rien.",
    axe: "Diamètre de la souche",
    forme: "un-axe",
    integree: true,
  },
  {
    cle: "haie",
    titre: "Tailler une haie",
    aide: "Un seul prix, au mètre linéaire. Atlas le multiplie par la longueur du chantier.",
    axe: "",
    forme: "une-case",
    cleUnique: CELLULE_HAIE,
    libelleUnique: "Prix du mètre linéaire",
    integree: true,
  },
];

/** Les natures d'origine reconnues par le moteur de chiffrage. */
export type NatureGrille = "fendage" | "abattage" | "haie" | "dessouchage" | "grumes";

/** Tout ce qu'il faut pour fabriquer les cases d'une entreprise. */
export type Grilles = { axes: Axes; natures: readonly Nature[] };

export const GRILLES_PAR_DEFAUT: Grilles = { axes: AXES_PAR_DEFAUT, natures: NATURES_PAR_DEFAUT };

/**
 * La clé d'un travail ajouté par le patron.
 *
 * **Préfixée, et jamais nue.** « abattage » saisi à la main ne doit pas venir
 * se poser sur la grille d'abattage intégrée, dont le chiffrage se sert : le
 * préfixe garantit qu'un travail à lui reste à lui.
 */
export function cleDeNaturePerso(titre: string, dejaPrises: ReadonlySet<string>): string {
  const base =
    "perso_" +
    (titre
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "travail");
  if (!dejaPrises.has(base)) return base;
  for (let n = 2; n < 1000; n++) {
    if (!dejaPrises.has(`${base}_${n}`)) return `${base}_${n}`;
  }
  throw new Error("Impossible de nommer ce travail : trop de travaux portent le même nom.");
}

// ---------------------------------------------------------------------------
// Les cases
// ---------------------------------------------------------------------------

export type Cellule = {
  /** Clé de la case, `h10|d40`. Stable : c'est elle qui est écrite en base. */
  cle: string;
  /** Le premier axe — hauteur, technique, ou le rôle tenu par la case unique. */
  hauteur: Tranche;
  diametre: Tranche;
  /** Ce que le patron lit : « 10 à 15 m de haut · tronc de 40 à 50 cm ». */
  libelle: string;
};

/** Ancien nom du même objet — soixante lignes l'emploient encore. */
export type CelluleFendage = Cellule;

/**
 * La case de la grille qui correspond à un arbre.
 *
 * Rend `null` dès qu'une des deux mesures manque : **sans les deux, il n'y a pas
 * de case**, et donc pas de prix à aller chercher. C'est le cas normal au début
 * d'une dictée, pas une anomalie — il déclenche la question.
 */
export function celluleFendage(
  hauteurM: number | null,
  diametreCm: number | null,
  axes: Axes
): Cellule | null {
  if (hauteurM === null || diametreCm === null) return null;
  const hauteur = trancheDe(hauteurM, axes.hauteurs);
  const diametre = trancheDe(diametreCm, axes.diametres);
  if (!hauteur || !diametre) return null;
  return celluleCroisee(hauteur, diametre);
}

function celluleCroisee(hauteur: Tranche, diametre: Tranche): Cellule {
  return {
    cle: `${hauteur.cle}|${diametre.cle}`,
    hauteur,
    diametre,
    libelle: `${hauteur.libelle} de haut · tronc de ${diametre.libelle}`,
  };
}

/** Retrouve une case de fendage depuis sa clé — pour relire ce qui est en base. */
export function celluleDepuisCle(cle: string, axes: Axes): Cellule | null {
  const [cleHauteur, cleDiametre] = cle.split("|");
  const hauteur = axes.hauteurs.find((t) => t.cle === cleHauteur);
  const diametre = axes.diametres.find((t) => t.cle === cleDiametre);
  if (!hauteur || !diametre) return null;
  return celluleCroisee(hauteur, diametre);
}

/** Toutes les cases de fendage, dans l'ordre où l'écran les affiche. */
export function toutesLesCellules(axes: Axes): Cellule[] {
  return axes.hauteurs.flatMap((hauteur) => axes.diametres.map((diametre) => celluleCroisee(hauteur, diametre)));
}

/**
 * La case de la grille d'abattage : la technique, puis le diamètre.
 *
 * `null` dès qu'il manque l'une des deux — et c'est le cas normal au début
 * d'une dictée, pas une anomalie : il déclenche la question.
 */
export function celluleAbattage(technique: string | null, diametreCm: number | null, axes: Axes): Cellule | null {
  const t = axes.techniques.find((x) => x.cle === technique);
  if (!t || diametreCm === null) return null;
  const diametre = trancheDe(diametreCm, axes.diametres);
  if (!diametre) return null;
  return celluleTechnique(t, diametre);
}

function celluleTechnique(t: Technique, diametre: Tranche): Cellule {
  return {
    cle: `${t.cle}|${diametre.cle}`,
    // La « hauteur » de la case porte ici la technique. Le type est partagé
    // avec le fendage pour que l'écran et le dépôt n'aient qu'une forme à
    // connaître ; ce sont les LIBELLÉS qui disent au patron de quoi on parle.
    hauteur: { cle: t.cle, de: 0, a: null, libelle: t.libelle },
    diametre,
    libelle: `${t.libelle} · tronc de ${diametre.libelle}`,
  };
}

/**
 * La case du dessouchage : le diamètre, et rien d'autre.
 *
 * C'est la taille de la souche qui décide du travail — la hauteur de l'arbre
 * qui n'est plus là ne dit plus rien. On réemploie les tranches de l'abattage :
 * ce sont les mêmes troncs, et deux jeux de tranches pour la même réalité
 * finiraient par diverger (`CLAUDE.md` §3).
 */
export function celluleDessouchage(diametreCm: number | null, axes: Axes): Cellule | null {
  if (diametreCm === null) return null;
  const diametre = trancheDe(diametreCm, axes.diametres);
  if (!diametre) return null;
  return celluleDiametreSeul(diametre, "Souche de");
}

function celluleDiametreSeul(diametre: Tranche, prefixe: string): Cellule {
  return {
    cle: diametre.cle,
    hauteur: { cle: "un-axe", de: 0, a: null, libelle: prefixe },
    diametre,
    libelle: `${prefixe} ${diametre.libelle}`,
  };
}

function celluleUnique(nature: Nature): Cellule {
  const cle = nature.cleUnique ?? "unique";
  const libelle = nature.libelleUnique ?? "Prix unitaire";
  return {
    cle,
    hauteur: { cle, de: 0, a: null, libelle },
    diametre: { cle, de: 0, a: null, libelle },
    libelle,
  };
}

/** Toutes les cases d'une nature, dans l'ordre où l'écran les affiche. */
export function cellulesDeNature(nature: Nature, axes: Axes): Cellule[] {
  switch (nature.forme) {
    case "une-case":
      return [celluleUnique(nature)];
    case "un-axe":
      return axes.diametres.map((d) => celluleDiametreSeul(d, nature.cle === "dessouchage" ? "Souche de" : "Pour"));
    case "technique-diametre":
      return axes.techniques.flatMap((t) => axes.diametres.map((d) => celluleTechnique(t, d)));
    case "hauteur-diametre":
      return toutesLesCellules(axes);
  }
}

/** Toutes les cases d'une nature désignée par sa clé. */
export function cellulesDe(cleNature: string, grilles: Grilles): Cellule[] {
  const nature = grilles.natures.find((n) => n.cle === cleNature);
  return nature ? cellulesDeNature(nature, grilles.axes) : [];
}

/**
 * Retrouve une case depuis sa clé, quelle que soit sa nature.
 *
 * **Une clé inconnue ne rend rien**, et c'est ce qui protège la base : une clé
 * inventée depuis un navigateur n'écrit nulle part (voir `poserPrixGrille`).
 */
export function celluleDeNature(cleNature: string, cle: string, grilles: Grilles): Cellule | null {
  return cellulesDe(cleNature, grilles).find((c) => c.cle === cle) ?? null;
}

/**
 * Le prix d'une case, s'il a déjà été décidé.
 *
 * `prixConnus` est la grille telle qu'elle est en base : clé de case → prix HT.
 * Rend `null` quand la case est vide, **sans jamais regarder les voisines** —
 * voir l'en-tête de ce fichier : pas d'interpolation.
 */
export function prixDuFendage(
  cellule: Cellule | null,
  prixConnus: ReadonlyMap<string, string>
): { prix: string; cellule: Cellule } | null {
  if (!cellule) return null;
  const prix = prixConnus.get(cellule.cle);
  if (prix === undefined) return null;
  return { prix, cellule };
}

/**
 * Combien de cases une tranche neuve ajoutera — ou une tranche retirée emportera.
 *
 * **C'est la phrase que l'écran doit dire AVANT de valider.** Une tranche de
 * diamètre sert à trois grilles : l'ajouter en pose dix d'un coup. Un écran qui
 * le tait transforme un geste anodin en dix questions surprises au chantier
 * suivant — c'est le seul vrai risque de ce lot.
 */
export function casesParTranche(axe: NomAxe, grilles: Grilles): { total: number; parNature: { nature: Nature; cases: number }[] } {
  const parNature = grilles.natures
    .map((nature) => ({ nature, cases: casesQueUneTrancheDonne(axe, nature, grilles.axes) }))
    .filter((x) => x.cases > 0);
  return { total: parNature.reduce((n, x) => n + x.cases, 0), parNature };
}

function casesQueUneTrancheDonne(axe: NomAxe, nature: Nature, axes: Axes): number {
  switch (nature.forme) {
    case "une-case":
      return 0;
    case "un-axe":
      return axe === "diametre" ? 1 : 0;
    case "technique-diametre":
      if (axe === "diametre") return axes.techniques.length;
      if (axe === "technique") return axes.diametres.length;
      return 0;
    case "hauteur-diametre":
      if (axe === "diametre") return axes.hauteurs.length;
      if (axe === "hauteur") return axes.diametres.length;
      return 0;
  }
}

/** Combien de cases une nature neuve fabriquera, selon la forme choisie. */
export function casesDUneForme(forme: FormeGrille, axes: Axes): number {
  switch (forme) {
    case "une-case":
      return 1;
    case "un-axe":
      return axes.diametres.length;
    case "technique-diametre":
      return axes.techniques.length * axes.diametres.length;
    case "hauteur-diametre":
      return axes.hauteurs.length * axes.diametres.length;
  }
}
