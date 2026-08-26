/**
 * LE NUMÉRO DE SES DEVIS ET DE SES FACTURES.
 *
 * **Sa demande du 26 août 2026**, capture d'une autre application à l'appui :
 * *« dans la catégorie facture il faut rajouter le format de numéro, c'est
 * obligatoire il me semble »*.
 *
 * **Le format ne l'est pas ; la SUITE l'est.** Ce que la loi exige d'une
 * facture, c'est un numéro pris dans une suite chronologique, sans trou ni
 * doublon. Aucun format particulier n'est imposé. Atlas tenait déjà la suite —
 * un compteur atomique par entreprise ; ce qui manquait, c'est le choix de
 * l'habillage, et surtout ce qui suit.
 *
 * **CE QUI ÉTAIT CASSÉ, et que personne n'avait vu :** le millésime était écrit
 * en dur — `` `2026-${…}` `` dans `devis.ts`, `` `F2026-${…}` `` dans
 * `factures.ts`. **En janvier 2027, ses factures auraient encore dit 2026.** Un
 * défaut à retardement, qu'aucune suite ne voyait puisqu'elles tournent
 * aujourd'hui.
 *
 * **Ses trois décisions du 26 août**, devant la planche
 * `appli/format-de-numero.html` :
 *
 *   1. le compteur **repart à 1 au 1ᵉʳ janvier** ;
 *   2. **six chiffres** ;
 *   3. le **« F »** des factures reste.
 */

/** Ce qui distingue les deux suites. Elles ne se mêlent jamais. */
export type GenreDocument = "devis" | "facture";

export type FormatNumero = {
  /** Écrit en base. Ne change jamais : un réglage l'a peut-être posé. */
  clef: string;
  /** Ce qu'il lit dans la liste. */
  nom: string;
  /** La ligne grise dessous. */
  dit: string;
  /** Le millésime écrit devant : quatre chiffres, deux, ou rien. */
  annee: "longue" | "courte" | "aucune";
  /** Le mois, entre l'année et le numéro. */
  avecMois: boolean;
  /** Largeur du numéro, zéros compris. */
  chiffres: number;
};

/**
 * LES CINQ, dans l'ordre où il les voit — celui de la planche.
 *
 * **Le défaut est le DEUXIÈME, et c'est son choix**, pas un oubli : *« 6
 * chiffres »*. Ce n'est donc pas ce que le code faisait hier (quatre), et il l'a
 * décidé en connaissance de cause — la planche lui montrait les deux.
 */
export const FORMATS_NUMERO: readonly FormatNumero[] = [
  {
    clef: "annee-4",
    nom: "Année et 4 chiffres",
    dit: "Ce que portaient vos documents jusqu'ici",
    annee: "longue",
    avecMois: false,
    chiffres: 4,
  },
  {
    clef: "annee-6",
    nom: "Année et 6 chiffres",
    dit: "Le format par défaut",
    annee: "longue",
    avecMois: false,
    chiffres: 6,
  },
  {
    clef: "court",
    nom: "Année courte",
    dit: "Plus court à dicter au téléphone",
    annee: "courte",
    avecMois: false,
    chiffres: 4,
  },
  {
    clef: "mois",
    nom: "Année, mois, numéro",
    dit: "Le mois se lit sans ouvrir le document",
    annee: "longue",
    avecMois: true,
    chiffres: 3,
  },
  {
    clef: "suite",
    nom: "Une suite sans année",
    dit: "Ne repart jamais à 1",
    annee: "aucune",
    avecMois: false,
    chiffres: 4,
  },
];

/** Sa décision du 26 août 2026 : « 6 chiffres ». */
export const FORMAT_PAR_DEFAUT = "annee-6";

/**
 * LE « F » DES FACTURES — sa décision du 26 août : *« garde le F »*.
 *
 * Il sépare les deux suites d'un coup d'œil. Sans lui, un devis `2026-000012`
 * et une facture `2026-000012` se ressemblent, et c'est le genre de confusion
 * qui se paie devant un contrôle.
 */
const MARQUE: Record<GenreDocument, string> = { devis: "", facture: "F" };

/** Le format désigné, ou celui par défaut si la clef ne dit rien. */
export function formatDe(clef: string | null | undefined): FormatNumero {
  return (
    FORMATS_NUMERO.find((f) => f.clef === clef) ??
    FORMATS_NUMERO.find((f) => f.clef === FORMAT_PAR_DEFAUT)!
  );
}

/**
 * Le numéro écrit, tel qu'il partira chez le client.
 *
 * **Une seule fonction pour l'écran ET pour la base.** L'aperçu des réglages et
 * le numéro réellement attribué passent par ici : deux écritures d'une même
 * règle finiraient par diverger, et c'est le client qui lirait la mauvaise
 * (`CLAUDE.md` §3).
 *
 * @param mois de 1 à 12 — celui du document, jamais celui d'aujourd'hui quand
 *             on réécrit un ancien numéro.
 */
export function ecrireNumero(
  clef: string | null | undefined,
  genre: GenreDocument,
  { annee, mois, numero }: { annee: number; mois: number; numero: number }
): string {
  const f = formatDe(clef);
  const morceaux: string[] = [];
  if (f.annee === "longue") morceaux.push(String(annee));
  else if (f.annee === "courte") morceaux.push(String(annee % 100).padStart(2, "0"));
  if (f.avecMois) morceaux.push(String(mois).padStart(2, "0"));
  morceaux.push(String(numero).padStart(f.chiffres, "0"));
  return MARQUE[genre] + morceaux.join("-");
}

/**
 * Le compteur repart-il à 1 quand l'année change ?
 *
 * **Sa décision du 26 août : oui.** Mais elle ne vaut que si l'année FIGURE
 * dans le numéro — sinon `0148` succéderait à `0147` puis repartirait à `0001`,
 * et deux documents porteraient le même numéro à un an d'écart. Un doublon dans
 * une suite est exactement ce que la loi interdit.
 *
 * C'est la seule règle de ce fichier qui protège d'autre chose que d'une
 * laideur, et elle se déduit du format : elle ne se règle pas à part.
 */
export function repartChaqueAnnee(clef: string | null | undefined): boolean {
  return formatDe(clef).annee !== "aucune";
}
