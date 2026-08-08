// Lire la hauteur et le diamètre d'un arbre dans ce qui a été dit ou répondu.
//
// **Un seul vocabulaire, un seul endroit.** Trois modules avaient besoin de la
// même chose et l'auraient réécrite chacun à sa façon : celui qui décide s'il
// faut poser la question, celui qui range le prix dans la bonne case de la
// grille, et celui qui rapproche deux chantiers comparables. Deux lectures
// différentes du même « ⌀ 70 » auraient fait poser une question déjà répondue,
// ou ranger un prix dans la case d'à côté (`CLAUDE.md` §3).
//
// **Ce module ne devine rien.** Il rend `null` quand le texte ne porte pas la
// mesure. Un arbre « assez gros » n'a pas de diamètre, et lui en attribuer un
// mettrait un prix dans une case que le patron n'a jamais choisie.

/**
 * Le diamètre, en centimètres.
 *
 * Reconnaît ce qu'une dictée et une réponse produisent réellement :
 * « ⌀ 70 cm », « Ø70 », « diamètre 70 », « diamètre de 70 cm », « 70 cm de
 * diamètre ». Pas de mètres : personne n'annonce un tronc en mètres.
 */
const DIAMETRE = [
  /(?:⌀|Ø)\s*(\d{1,3})/i,
  /diam[èe]tre\s*(?:de\s*)?(\d{1,3})/i,
  // « centimètres » en toutes lettres autant que « cm » : une dictée dit
  // « quatre-vingt-dix centimètres de diamètre », pas « 90 cm ».
  /(\d{1,3})\s*(?:cm|centim[èe]tres?)\s*de\s*diam[èe]tre/i,
];

/**
 * La hauteur, en mètres.
 *
 * « 20 m de haut », « 20 mètres de haut », « hauteur 20 m », « haut de 20 m ».
 *
 * **La virgule est acceptée** — « 12,5 m » — parce qu'un élagueur l'écrit
 * ainsi. Le point aussi, parce qu'un clavier de téléphone le propose d'abord.
 */
const HAUTEUR = [
  /(\d{1,2}(?:[.,]\d)?)\s*m(?:[èe]tres?)?\s*de\s*haut/i,
  /hauteur\s*(?:de\s*)?(\d{1,2}(?:[.,]\d)?)/i,
  /haut(?:eur)?\s*(?:de\s*)?(\d{1,2}(?:[.,]\d)?)\s*m/i,
];

// --- Les nombres dictés s'écrivent en toutes lettres ----------------------
//
// **Ce n'est pas un raffinement, c'est le cas ordinaire.** Le patron ne tape
// pas, il parle : sa dictée de référence dit « un chêne mort de **vingt**
// mètres de haut », jamais « 20 m ». Une lecture qui n'accepte que les chiffres
// ne trouve donc à peu près jamais la hauteur — elle repose la question qu'il
// vient de répondre, et la case de sa grille reste introuvable.
//
// La transcription rend parfois des chiffres (« 20 m »), parfois des lettres,
// selon le service et la phrase. Les deux doivent marcher.

const UNITES: Record<string, number> = {
  un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9,
  dix: 10, onze: 11, douze: 12, treize: 13, quatorze: 14, quinze: 15, seize: 16,
};

// « soixante-dix » et « quatre-vingt-dix » ne figurent pas ici : ils se
// composent tout seuls (60 + 10, 80 + 10), comme « quatre-vingt-douze » (92).
const DIZAINES: Record<string, number> = {
  vingt: 20, vingts: 20, trente: 30, quarante: 40, cinquante: 50, soixante: 60,
};

const MOTS_NOMBRES = [...Object.keys(UNITES), ...Object.keys(DIZAINES), "cent", "cents"];

/**
 * Somme d'une suite de mots-nombres.
 *
 * « soixante-dix » → 70 et « quatre-vingt-douze » → 92 se composent d'eux-mêmes.
 * **Sauf « quatre-vingt », qui MULTIPLIE** : additionner donnerait 24 au lieu de
 * 80, et un tronc de 24 cm rangé dans la case des 80 cm est un prix faux
 * présenté comme une décision.
 */
function valeurDesMots(mots: readonly string[]): number | null {
  let valeur = 0;
  let vu = false;
  for (let i = 0; i < mots.length; i++) {
    const mot = mots[i];
    if (mot === "et") continue;

    if (mot === "quatre" && (mots[i + 1] === "vingt" || mots[i + 1] === "vingts")) {
      valeur += 80;
      vu = true;
      i++;
      continue;
    }
    if (mot === "cent" || mot === "cents") {
      valeur = (valeur || 1) * 100;
      vu = true;
      continue;
    }
    const n = UNITES[mot] ?? DIZAINES[mot];
    if (n === undefined) return null;
    valeur += n;
    vu = true;
  }
  return vu && valeur > 0 ? valeur : null;
}

/**
 * Récrit en chiffres les seules suites de mots-nombres, et rien d'autre.
 *
 * **Le motif énumère les mots-nombres au lieu de prendre « des lettres ».** Une
 * première version attrapait toute suite de mots, constatait que « un chêne
 * mort à abattre » n'était pas un nombre, et renonçait — y compris sur le
 * « vingt » qui suivait. Résultat : la hauteur dictée restait invisible, et la
 * question était reposée à chaque fois.
 */
const SUITE_DE_NOMBRES = new RegExp(
  `\\b(?:${MOTS_NOMBRES.join("|")})(?:[\\s-]+(?:et[\\s-]+)?(?:${MOTS_NOMBRES.join("|")}))*\\b`,
  "gi"
);

function enChiffres(texte: string): string {
  return texte.replace(SUITE_DE_NOMBRES, (groupe) => {
    const valeur = valeurDesMots(groupe.toLowerCase().split(/[\s-]+/));
    return valeur === null ? groupe : String(valeur);
  });
}

function premiereMesure(texte: string, motifs: readonly RegExp[]): number | null {
  // Les chiffres d'abord, sur le texte tel quel : si la transcription les a
  // écrits, aucune récriture ne peut les abîmer.
  for (const source of [texte, enChiffres(texte)]) {
    for (const motif of motifs) {
      const trouve = motif.exec(source);
      if (!trouve) continue;
      const valeur = Number(trouve[1].replace(",", "."));
      if (Number.isFinite(valeur) && valeur > 0) return valeur;
    }
  }
  return null;
}

/** Le diamètre du tronc en cm, lu dans un texte. `null` s'il n'y est pas. */
export function diametreLu(texte: string): number | null {
  return premiereMesure(texte, DIAMETRE);
}

/** La hauteur de l'arbre en mètres, lue dans un texte. `null` s'il n'y est pas. */
export function hauteurLue(texte: string): number | null {
  return premiereMesure(texte, HAUTEUR);
}

export type MesuresArbre = { hauteurM: number | null; diametreCm: number | null };

/**
 * Ce qu'on sait des dimensions de l'arbre sur ce chantier.
 *
 * **Les réponses du patron l'emportent sur la dictée**, et l'ordre des sources
 * le dit : il a pu corriger à l'arrêt d'avant-chiffrage ce que la transcription
 * avait mal entendu — « soixante-dix » devenant « 17 » est le genre d'accident
 * qu'une dictée produit, et sa réponse est ce qu'il a voulu dire.
 *
 * @param reponses  Les réponses données à l'arrêt, la plus fiable en premier.
 * @param textes    Les libellés des prestations, tels que dictés.
 */
export function mesuresArbre(reponses: readonly string[], textes: readonly string[]): MesuresArbre {
  const sources = [...reponses, ...textes];
  let hauteurM: number | null = null;
  let diametreCm: number | null = null;
  for (const source of sources) {
    if (hauteurM === null) hauteurM = hauteurLue(source);
    if (diametreCm === null) diametreCm = diametreLu(source);
  }
  return { hauteurM, diametreCm };
}
