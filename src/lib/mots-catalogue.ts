// Ses mots à lui, par-dessus le vocabulaire de tout le monde.
//
// **Sa question du 17 août 2026**, capture de l'écran « Catalogue » à l'appui —
// et c'était la SECONDE fois, la première ayant produit `docs/QUESTIONS.md`
// §18 : *« À quoi sert cette page ?? On peut rien modifier rajouter »*.
//
// **Ce que le catalogue est, et qui explique tout le reste.** Le vocabulaire du
// métier : des mots, jamais des prix. Quand il dicte « faut me démonter le
// sapin du fond », aucun mot de la phrase n'est « élagage » — c'est le
// catalogue qui fait le rapprochement. Il est **commun à toutes les
// entreprises** (migration 0007, aucune RLS), et c'est pour ça que personne n'y
// écrivait.
//
// **L'arrangement retenu : B** (`docs/maquettes/69-mes-mots-au-catalogue.html`,
// choisi le 17 août). Ses mots s'ACCROCHENT aux entrées d'Atlas au lieu de
// vivre à côté. La nuance décide de ce que la dictée comprendra : « écimage »
// posé à côté d'« Élagage » ferait écrire une prestation neuve à chaque
// « écime-moi le tilleul » ; posé dedans, il est reconnu comme un élagage, avec
// les questions et les prix qui vont avec.
//
// **Ce module ne touche à rien** : il dit ce qu'un mot vaut, ce qui est refusé,
// et comment les deux vocabulaires se superposent à l'écran. Le dépôt écrit,
// l'écran affiche (`CLAUDE.md` §3).

/** Une entrée du vocabulaire commun, telle qu'Atlas la porte. */
export type EntreeCommune = {
  id: string;
  nomCanonique: string;
  /** Variantes et synonymes réunis : à l'écran, ils disaient la même chose. */
  mots: string[];
};

/** Un mot que l'entreprise a écrit — ou le nom d'une entrée à elle. */
export type MotAMoi = {
  id: string;
  mot: string;
  /** L'entrée d'Atlas à laquelle il s'accroche, s'il s'accroche à une. */
  referenceId: string | null;
  /** Son entrée à lui à laquelle il s'accroche, le cas échéant. */
  parentId: string | null;
};

/** Une carte de l'écran : une entrée, ses mots communs, et les siens. */
export type CarteCatalogue = {
  /** L'identifiant de l'entrée — celui d'Atlas, ou celui de SA ligne. */
  id: string;
  nom: string;
  /** Ce qu'Atlas connaît. Vide sur une entrée à lui. */
  motsCommuns: string[];
  /** Ce qu'il a ajouté, avec de quoi le retirer. */
  mesMots: { id: string; mot: string }[];
  /** Vrai quand l'entrée entière est à lui — elle n'existe que chez lui. */
  aMoi: boolean;
};

/**
 * Combien de mots il peut poser sur une entrée, et combien d'entrées à lui.
 *
 * **Ce ne sont pas des limites de confort.** Chaque mot est comparé à la dictée
 * à chaque demande : une entrée qui en porterait trois cents rapprocherait
 * n'importe quoi de n'importe quoi, et la dictée deviendrait moins juste au fur
 * et à mesure qu'il l'enrichit — exactement l'inverse de ce qu'il attend.
 */
export const MAX_MOTS_PAR_ENTREE = 20;
export const MAX_ENTREES_A_MOI = 100;

/** Ce qu'un mot peut mesurer. Au-delà, c'est une phrase, pas un mot. */
export const MAX_LONGUEUR_MOT = 40;

/**
 * Nettoie un mot saisi, ou dit qu'il ne vaut rien.
 *
 * Rend `null` quand il ne reste rien : l'appelant décide alors du refus plutôt
 * que d'enregistrer une ligne vide, qu'il ne pourrait ni lire ni viser au doigt.
 */
export function motNettoye(brut: string | null | undefined): string | null {
  if (!brut) return null;
  // Les espaces insécables viennent des claviers de téléphone ; laissées
  // telles quelles, deux mots identiques à l'œil se rangeraient à deux endroits.
  const propre = brut.replace(/ /g, " ").replace(/\s+/g, " ").trim();
  if (propre === "") return null;
  return propre.slice(0, MAX_LONGUEUR_MOT);
}

/**
 * Deux mots désignent-ils la même chose ?
 *
 * Indulgent sur la casse et les accents : « Écimage », « ecimage » et
 * « écimage » sont le même mot. Il dicte, il tape vite, et deux entrées pour un
 * seul mot ne rapprocheraient rien de plus.
 */
export function memeMot(a: string, b: string): boolean {
  const pliee = (t: string) =>
    t
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  return pliee(a) === pliee(b);
}

export type RefusMot =
  | "vide"
  | "deja_chez_atlas"
  | "deja_chez_moi"
  | "trop_de_mots"
  | "trop_d_entrees"
  | "introuvable";

/**
 * Ce qui interdit d'enregistrer ce mot — ou `null` s'il passe.
 *
 * **Refuser un mot qu'Atlas connaît déjà n'est pas une pédanterie.** Ajouter
 * « abattage » sous « Élagage », qui le porte déjà, ferait croire à un ajout
 * utile et n'apporterait rien à la dictée : le mot était déjà reconnu. L'écran
 * doit le dire, sans quoi il recommencera.
 */
export function refusDuMot(args: {
  mot: string | null;
  /** Les mots que le vocabulaire commun porte déjà pour cette entrée. */
  motsDuCommun: string[];
  /** Tous SES mots de cette famille — un mot ne sert qu'une entrée à la fois. */
  mesMotsDeLaFamille: string[];
  /** Combien de mots il a déjà posés sur cette entrée. */
  dejaSurCetteEntree: number;
}): RefusMot | null {
  const mot = motNettoye(args.mot);
  if (!mot) return "vide";
  if (args.motsDuCommun.some((m) => memeMot(m, mot))) return "deja_chez_atlas";
  if (args.mesMotsDeLaFamille.some((m) => memeMot(m, mot))) return "deja_chez_moi";
  if (args.dejaSurCetteEntree >= MAX_MOTS_PAR_ENTREE) return "trop_de_mots";
  return null;
}

/** La phrase à lui montrer. Un refus muet le laisse recommencer à l'identique. */
export function phraseDuRefus(refus: RefusMot): string {
  switch (refus) {
    case "vide":
      return "Écrivez un mot avant de valider.";
    case "deja_chez_atlas":
      return "Atlas connaît déjà ce mot pour cette entrée : il est reconnu quand vous dictez.";
    case "deja_chez_moi":
      return "Vous avez déjà posé ce mot ailleurs. Un mot ne peut désigner qu'une chose.";
    case "trop_de_mots":
      return `${MAX_MOTS_PAR_ENTREE} mots par entrée suffisent : au-delà, la dictée rapproche moins bien.`;
    case "trop_d_entrees":
      return `Vous avez atteint ${MAX_ENTREES_A_MOI} entrées à vous.`;
    case "introuvable":
      return "Cette entrée n'existe plus.";
  }
}

/**
 * Superpose ses mots au vocabulaire commun, dans l'ordre de l'écran.
 *
 * **Les entrées d'Atlas d'abord, les siennes ensuite.** Ce n'est pas un choix
 * d'affichage : le commun est ce qu'il retrouvera d'un appareil à l'autre et
 * d'une année à l'autre ; ses entrées à lui sont ce qu'il a dû ajouter, donc ce
 * qu'il doit pouvoir vérifier d'un coup d'œil.
 */
export function fusionnerCatalogue(args: {
  communes: EntreeCommune[];
  miens: MotAMoi[];
}): CarteCatalogue[] {
  const { communes, miens } = args;

  const cartes: CarteCatalogue[] = communes.map((c) => ({
    id: c.id,
    nom: c.nomCanonique,
    motsCommuns: c.mots,
    mesMots: miens
      .filter((m) => m.referenceId === c.id)
      .map((m) => ({ id: m.id, mot: m.mot })),
    aMoi: false,
  }));

  // Ses entrées à lui : celles qui ne s'accrochent à rien.
  for (const entree of miens.filter((m) => m.referenceId === null && m.parentId === null)) {
    cartes.push({
      id: entree.id,
      nom: entree.mot,
      motsCommuns: [],
      mesMots: miens.filter((m) => m.parentId === entree.id).map((m) => ({ id: m.id, mot: m.mot })),
      aMoi: true,
    });
  }

  return cartes;
}

/**
 * Tous les mots par lesquels une entrée peut être reconnue — les siens compris.
 *
 * **C'est la fonction qui fait que l'ajout SERT à quelque chose.** Un mot
 * visible à l'écran mais absent de la recherche serait le pire des deux mondes :
 * il croirait avoir appris quelque chose à Atlas, et la dictée continuerait de
 * ne pas comprendre — sans qu'aucun message ne le lui dise.
 */
export function motsReconnus(carte: CarteCatalogue): string[] {
  return [carte.nom, ...carte.motsCommuns, ...carte.mesMots.map((m) => m.mot)];
}

/**
 * Le mot-clé dicté correspond-il à cette carte ?
 *
 * **Le rapprochement est le même que celui du catalogue partagé** — inclusion
 * dans les deux sens, sur des mots repliés (casse et accents). Deux règles de
 * rapprochement, l'une pour le commun et l'autre pour ses mots, finiraient par
 * diverger : il verrait alors « écimage » reconnu et « écimages » non, sans
 * pouvoir deviner pourquoi.
 */
export function carteCorrespond(carte: CarteCatalogue, motCle: string): boolean {
  const plier = (t: string) =>
    t
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .trim();
  const cle = plier(motCle);
  if (!cle) return false;
  return motsReconnus(carte).some((m) => {
    const mot = plier(m);
    return mot !== "" && (mot.includes(cle) || cle.includes(mot));
  });
}
