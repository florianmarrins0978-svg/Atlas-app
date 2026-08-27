// **De quel travail s'agit-il ? — une liste, pas un fourre-tout.**
//
// ─── Ce que ce module remplace ──────────────────────────────────────────────
//
// Jusqu'au 27 août 2026, la nature d'un travail se devinait par expressions
// régulières, dans SIX modules différents, chacun avec son propre vocabulaire :
// `lignes-vendables.ts` en connaissait cinq, `lecons-prix.ts` six, une autre
// encore dans `apprendre-grille.ts`, `prix-attribuable.ts`, `grille-prix.ts` et
// `questions-chiffrage.ts`. Aucune ne connaissait la tonte.
//
// D'où le devis du 26 août : « Tonte de la pelouse (1200 m²) » ne répondait à
// aucun motif, tombait dans la case `principal` — celle qui ramasse tout — et
// partageait sa ligne, son prix et son apprentissage avec le démontage d'un
// érable.
//
// ─── Les deux règles qui gouvernent ce fichier ──────────────────────────────
//
// **1. IDENTITÉ MÉTIER et CAPACITÉ DE CHIFFRAGE sont deux choses.** Une tonte
// est parfaitement identifiée ; Atlas ne sait pas la chiffrer tout seul. Les
// deux informations vivent ici côte à côte et ne se confondent jamais : c'est
// leur confusion qui a produit le fourre-tout.
//
// **2. Une nature inconnue reste une prestation À PART ENTIÈRE.** Elle ne
// rejoint aucun groupe, elle ne prend la nature de personne, et elle arrive sur
// le devis comme un travail distinct « à chiffrer ». Ce que le produit ne sait
// pas nommer, il ne le fond pas dans ce qu'il sait nommer — c'est exactement
// ce qui a coûté le devis du 26 août.
//
// ─── Ce qui n'y est pas, et pourquoi ────────────────────────────────────────
//
// Cette liste n'est PAS complète, et elle ne prétend pas l'être. Le patron a
// confirmé le 27 août 2026 vendre de la **plantation** et de la **clôture**, et
// a demandé qu'on le relance pour établir la liste entière (`HANDOVER.md`, et
// le rappel armé dans `scripts/verifier-memoire.mjs`). En attendant, rien n'est
// deviné : ce qui n'est pas ici vaut `null`, et `null` veut dire « on ne sait
// pas », jamais « c'est un abattage ».

/** Ce qu'Atlas sait faire du prix d'une nature, une fois le travail identifié. */
export type CapaciteChiffrage =
  /** Une grille du patron sait donner un prix (`grille-prix.ts`). */
  | "grille"
  /** Identifiée, mais aucun moteur de prix : la ligne sort « à chiffrer ». */
  | "aucune";

export type Nature = {
  cle: string;
  /** Ce qu'on écrit à l'écran quand il faut nommer la nature. */
  libelle: string;
  /**
   * Le motif qui la reconnaît dans un libellé.
   *
   * **Mécanisme HISTORIQUE, clairement identifié comme tel.** Il sert à relire
   * les prestations écrites avant que la colonne `nature` existe, et les
   * libellés stockés dans `lecons_prix`. Il n'est PAS la source des prestations
   * neuves : celles-là portent leur nature en colonne.
   */
  motif: RegExp;
  /**
   * Le client peut-il refuser cette ligne sans annuler le chantier ?
   *
   * Sa règle du 8 août 2026, à la question « qu'est-ce qui se détache ? » :
   * *« le dessouchage oui »*, *« et les grumes aussi »* — l'évacuation du menu
   * bois, non.
   */
  detachable: boolean;
  /**
   * Un travail qui ACCOMPAGNE l'abattage et ne se facture pas à part.
   *
   * Sa règle du 7 août 2026 : *« l'abattage, le broyage et l'évacuation, c'est
   * sur une ligne, et la fente, ça doit être séparé. »* Un accessoire SEUL
   * redevient le chantier — broyer du bois déjà à terre est un vrai travail.
   */
  accessoire: boolean;
  chiffrage: CapaciteChiffrage;
  /**
   * Où cette nature se place sur le devis.
   *
   * **L'ordre du CHANTIER, pas celui du code** : on abat, on enlève les grumes,
   * on fend ce qui reste, et la souche part en dernier — souvent un autre jour,
   * avec une autre machine. Séparé de l'ordre de la liste ci-dessous, qui sert
   * lui à départager deux motifs qui répondent sur le même texte.
   */
  ordreDevis: number;
  /**
   * L'unité dans laquelle ce travail se mesure, quand il n'y en a qu'une.
   *
   * Sert à traduire la quantité dictée en caractéristique de chiffrage — 800
   * « ml » de haie SONT la longueur qui fait son prix. `null` quand la nature
   * n'a pas d'unité unique : rien n'est alors traduit, et rien n'est deviné.
   */
  uniteDeMesure: string | null;
};

/**
 * Les natures qu'Atlas sait nommer, dans l'ordre de lecture d'un devis.
 *
 * **L'ordre compte, et il n'est pas décoratif.** Il décide de deux choses : la
 * nature retenue quand plusieurs motifs répondent sur un même texte (le plus
 * spécifique d'abord), et l'ordre des lignes du devis — on abat, on enlève les
 * grumes, on fend, et la souche part en dernier, souvent un autre jour.
 */
export const NATURES: readonly Nature[] = [
  {
    cle: "abattage",
    libelle: "Abattage",
    motif: /\b(abattage|abattre|abatt|d[ée]mont)/i,
    detachable: false,
    accessoire: false,
    chiffrage: "grille",
    ordreDevis: 0,
    uniteDeMesure: null,
  },
  {
    cle: "haie",
    libelle: "Taille de haie",
    motif: /\bhaie/i,
    detachable: true,
    accessoire: false,
    chiffrage: "grille",
    ordreDevis: 10,
    uniteDeMesure: "ml",
  },
  {
    // Après la haie : « taille de haie » ne doit jamais devenir un élagage.
    cle: "elagage",
    libelle: "Élagage",
    // L'apostrophe compte : « taille d'allégement sur marronnier » est un
    // élagage, et sans elle il ne l'était pas — c'est sa dictée du 7 août,
    // celle dont le devis est sorti vide.
    // L'apostrophe compte, ET l'espace aussi : `d(?:e|u|')\s*` laissait le
    // regard tomber juste après « de », donc AVANT l'espace — et « taille de
    // haie » redevenait un élagage. Le blanc fait partie du mot.
    motif: /\b(élagage|elagage|élaguer|elaguer|taille\s+(?:de\s+|du\s+|d'))(?!haie)/i,
    detachable: true,
    accessoire: false,
    chiffrage: "aucune",
    ordreDevis: 50,
    uniteDeMesure: null,
  },
  {
    // Avant les grumes : « enlèvement des grumes et dessouchage » est un
    // dessouchage — c'est le geste, quand les grumes sont la matière.
    cle: "dessouchage",
    libelle: "Dessouchage",
    motif: /\b(dessouch|d[ée]souch|souche|rognage)/i,
    detachable: true,
    accessoire: false,
    chiffrage: "grille",
    ordreDevis: 40,
    uniteDeMesure: null,
  },
  {
    cle: "grumes",
    libelle: "Enlèvement des grumes",
    motif: /\bgrume/i,
    detachable: true,
    accessoire: false,
    chiffrage: "grille",
    ordreDevis: 20,
    uniteDeMesure: "tonne",
  },
  {
    cle: "fendage",
    libelle: "Fendage",
    motif: /\b(fend|fente)/i,
    detachable: true,
    accessoire: false,
    chiffrage: "grille",
    ordreDevis: 30,
    uniteDeMesure: null,
  },
  {
    cle: "broyage",
    libelle: "Broyage",
    motif: /\bbroy/i,
    detachable: false,
    accessoire: true,
    chiffrage: "aucune",
    ordreDevis: 90,
    uniteDeMesure: null,
  },
  {
    cle: "evacuation",
    libelle: "Évacuation des déchets",
    motif: /[ée]vacuation|[ée]vacuer/i,
    detachable: false,
    accessoire: true,
    chiffrage: "aucune",
    ordreDevis: 91,
    uniteDeMesure: null,
  },
  {
    cle: "billonnage",
    libelle: "Billonnage",
    motif: /\b(billonn|coup[eé]\w*\s+en\s+\d|d[ée]bit\w*\s+en\s+\d|tron[çc]onn\w*\s+en\s+\d)/i,
    detachable: false,
    accessoire: true,
    chiffrage: "aucune",
    ordreDevis: 92,
    uniteDeMesure: null,
  },
  {
    // **Elle vient de SA dictée du 26 août**, pas d'une supposition : « tonte de
    // la pelouse, mille deux cents mètres carrés ». Aucun module ne la
    // connaissait, et c'est ce trou-là qui a fait partager une ligne à une
    // pelouse et à un érable.
    cle: "tonte",
    libelle: "Tonte",
    motif: /\b(tonte|tondre|tondu)/i,
    detachable: true,
    accessoire: false,
    chiffrage: "aucune",
    ordreDevis: 60,
    uniteDeMesure: "m²",
  },
  {
    // **Confirmée par lui le 27 août 2026** : « oui j'en vend ».
    cle: "plantation",
    libelle: "Plantation",
    motif: /\b(plantation|planter|plant[eé]\w*)/i,
    detachable: true,
    accessoire: false,
    chiffrage: "aucune",
    ordreDevis: 70,
    uniteDeMesure: null,
  },
  {
    cle: "cloture",
    libelle: "Clôture",
    motif: /\b(cl[oô]ture|grillage|palissade)/i,
    detachable: true,
    accessoire: false,
    chiffrage: "aucune",
    ordreDevis: 80,
    uniteDeMesure: "ml",
  },
];

const PAR_CLE = new Map(NATURES.map((n) => [n.cle, n]));

/** La nature de cette clé, ou `null` si le produit ne la connaît pas. */
export function nature(cle: string | null | undefined): Nature | null {
  if (!cle) return null;
  return PAR_CLE.get(cle.trim().toLowerCase()) ?? null;
}

/**
 * La nature devinée depuis un libellé — **mécanisme historique**.
 *
 * À n'employer que là où il n'y a pas de colonne : les prestations écrites
 * avant le 27 août 2026, et les libellés figés dans `lecons_prix`. Une
 * prestation neuve porte sa nature en base, et c'est celle-là qui fait foi.
 *
 * Rend `null` plutôt qu'une nature de repli : un travail qu'on ne sait pas
 * nommer reste un travail à part, jamais un abattage par défaut.
 */
export function natureDuLibelle(libelle: string): string | null {
  const texte = libelle.trim();
  if (!texte) return null;
  return NATURES.find((n) => n.motif.test(texte))?.cle ?? null;
}

/**
 * Toutes les natures reconnues dans un texte, pas seulement la première.
 *
 * **C'est la différence entre « ça parle d'abattage » et « ça ne parle que
 * d'abattage ».** Le premier motif qui répond suffisait partout, et c'est
 * exactement ce qui a rangé une tonte dans la case abattage.
 */
export function naturesDuLibelle(libelle: string): string[] {
  const texte = libelle.trim();
  if (!texte) return [];
  return NATURES.filter((n) => n.motif.test(texte)).map((n) => n.cle);
}

/**
 * L'unité dictée, traduite en caractéristique de chiffrage.
 *
 * **Ce n'est pas une déduction, c'est une correspondance d'unités.** 800 « ml »
 * sur une haie SONT sa longueur ; 6 « tonne » sur des grumes SONT leur tonnage.
 * Rien n'est deviné : sans nature connue, sans unité, ou quand l'unité dictée
 * n'est pas celle de la nature, on ne traduit rien.
 *
 * **Pourquoi ça manquait, et ce que ça coûtait.** La quantité vivait dans
 * `prestations.quantite` depuis le lot B, et le chiffrage ne la lisait nulle
 * part : il relisait « (800 ml) » dans le libellé. Corriger la colonne ne
 * changeait donc rien au prix — la colonne était décorative.
 */
export function caracteristiqueDeLaQuantite(
  cleNature: string | null | undefined,
  quantite: string | null | undefined,
  unite: string | null | undefined
): Record<string, number> | null {
  const n = nature(cleNature);
  if (!n || !n.uniteDeMesure || !quantite || !unite) return null;
  if (normaliserUnite(unite) !== normaliserUnite(n.uniteDeMesure)) return null;
  const valeur = Number(String(quantite).replace(",", "."));
  if (!Number.isFinite(valeur) || valeur <= 0) return null;

  switch (n.uniteDeMesure) {
    case "ml":
      return { longueurMl: valeur };
    case "tonne":
      return { tonnageT: valeur };
    default:
      // « m² » n'a pas de caractéristique de chiffrage : aucune grille ne s'en
      // sert. La quantité reste dans sa colonne, et la ligne sort « à chiffrer ».
      return null;
  }
}

/**
 * Deux unités désignent-elles la même chose ?
 *
 * Le modèle rend le mot du patron — « ml », « m.l. », « mètre linéaire », « t »,
 * « tonnes ». Comparer les chaînes brutes ferait manquer la correspondance une
 * fois sur deux ; les convertir serait inventer. On les normalise, sans jamais
 * transformer une valeur.
 */
export function normaliserUnite(unite: string): string {
  // Le pluriel se retire MOT PAR MOT avant de recoller : « mètres linéaires »
  // recollé d'abord donnerait « mètreslinéaire », qui ne ressemble à rien.
  const u = unite
    .trim()
    .toLowerCase()
    .split(/[\s.]+/)
    .filter(Boolean)
    .map((mot) => mot.replace(/s$/, ""))
    .join("");
  if (["ml", "mlineaire", "metrelineaire", "mètrelinéaire", "metrelinéaire"].includes(u)) return "ml";
  if (["m2", "m²", "metrecarre", "mètrecarré", "metrecarré"].includes(u)) return "m²";
  if (["t", "tonne"].includes(u)) return "tonne";
  if (["m3", "m³", "stere", "stère"].includes(u)) return u.startsWith("m") ? "m³" : "stère";
  return u;
}
