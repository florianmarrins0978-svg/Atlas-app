/**
 * L'ALLURE DE SES DOCUMENTS — la typographie, le fond, l'accent, le logo.
 *
 * **Sa demande du 23 août 2026 :** *« il faudrait que l'utilisateur puisse avoir
 * un endroit dédié à la modification de son devis. S'il veut rajouter son logo,
 * changer la typographie, changer le fond de page. »*
 *
 * **Ses quatre décisions, devant la planche `appli/allure-de-mes-devis.html` :**
 *
 *   1. le réglage vit dans « Devis & factures » (sa réponse **B**) ;
 *   2. il porte sur **le devis et la facture SEULEMENT**. La feuille de chantier
 *      et le compte rendu d'entretien gardent l'allure d'aujourd'hui — l'une est
 *      interne, l'autre est une page web, et il n'a demandé ni l'une ni l'autre ;
 *   3. **une dizaine de typographies**, et il les a validées à l'œil ;
 *   4. le fond de page **modifiable** — n'importe quelle couleur —, et
 *      *« les réglages actuels doivent être par défaut »*.
 *
 * **Fonction pure, dans `src/lib/`**, et ce n'est pas un rangement : la même
 * règle sert l'écran des réglages, le rendu du PDF et la revalidation au
 * serveur. Trois implémentations d'un même choix finiraient par diverger, et
 * c'est le client qui recevrait le document mal peint (`CLAUDE.md` §3).
 */

import { couleursDocument } from "./design-tokens";

/** Une typographie proposée, et le fichier que le PDF embarque. */
export type Typographie = {
  /** L'identifiant écrit en base. Ne change jamais : un réglage l'a peut-être posé. */
  clef: string;
  /** Ce qu'il lit à l'écran. */
  nom: string;
  /** La ligne grise dessous — à quoi elle ressemble, en deux mots. */
  dit: string;
  /**
   * La pile CSS pour l'écran. `null` : celle de l'appareil (le défaut).
   *
   * Elle nomme la famille EN PREMIER, puis un repli du même genre : une police
   * qui n'a pas fini de charger ne doit pas faire sauter la mise en page vers
   * une linéale quand il a choisi des empattements.
   */
  pileCss: string | null;
  /**
   * Le nom de la famille, seul — celui que `@font-face` déclare à l'écran.
   *
   * **Il est écrit à part plutôt que découpé dans `pileCss`.** Une pile s'écrit
   * avec des guillemets quand le nom porte une espace : la découper marcherait
   * pour « Inter » et pas pour « Work Sans », et l'écran retomberait en
   * silence sur la police de l'appareil — ce qui est exactement le mensonge
   * qu'on cherche à éviter.
   */
  famille: string | null;
  /**
   * Les deux fichiers embarqués dans le PDF, dans `src/server/pdf/polices/`.
   * `null` : Times et Helvetica, servies par le format lui-même.
   */
  fichiers: { normal: string; gras: string } | null;
};

/**
 * LES DIX, dans l'ordre où il les voit.
 *
 * **La première est celle d'aujourd'hui**, et c'est la valeur par défaut : sa
 * règle du 23 août. Elle n'embarque rien — c'est ce que ses devis portent
 * depuis toujours, et un réglage neuf ne doit pas changer l'allure de ses
 * documents tant qu'il n'y a pas touché.
 *
 * **Les neuf autres existent en fichier**, et c'est la condition pour figurer
 * ici : une police que le PDF ne pourrait pas embarquer ferait un écran qui
 * ment — il la choisirait, et son client recevrait autre chose.
 */
export const TYPOGRAPHIES: readonly Typographie[] = [
  {
    clef: "systeme",
    nom: "Celle d'aujourd'hui",
    dit: "Celle de l'appareil",
    pileCss: null,
    famille: null,
    fichiers: null,
  },
  {
    clef: "inter",
    nom: "Inter",
    dit: "Linéale, neutre",
    pileCss: 'Inter, ui-sans-serif, system-ui, sans-serif',
    famille: "Inter",
    fichiers: { normal: "inter-400.ttf", gras: "inter-700.ttf" },
  },
  {
    clef: "lato",
    nom: "Lato",
    dit: "Linéale, ronde",
    pileCss: 'Lato, ui-sans-serif, system-ui, sans-serif',
    famille: "Lato",
    fichiers: { normal: "lato-400.ttf", gras: "lato-700.ttf" },
  },
  {
    clef: "source-sans",
    nom: "Source Sans",
    dit: "Linéale, sobre",
    pileCss: '"Source Sans 3", ui-sans-serif, system-ui, sans-serif',
    famille: "Source Sans 3",
    fichiers: { normal: "source-sans-400.ttf", gras: "source-sans-700.ttf" },
  },
  {
    clef: "work-sans",
    nom: "Work Sans",
    dit: "Linéale, franche",
    pileCss: '"Work Sans", ui-sans-serif, system-ui, sans-serif',
    famille: "Work Sans",
    fichiers: { normal: "work-sans-400.ttf", gras: "work-sans-700.ttf" },
  },
  {
    clef: "archivo-narrow",
    nom: "Archivo Narrow",
    dit: "Étroite — tient plus de lignes",
    pileCss: '"Archivo Narrow", ui-sans-serif, system-ui, sans-serif',
    famille: "Archivo Narrow",
    fichiers: { normal: "archivo-narrow-400.ttf", gras: "archivo-narrow-700.ttf" },
  },
  {
    clef: "eb-garamond",
    nom: "EB Garamond",
    dit: "Empattements, classique",
    pileCss: '"EB Garamond", ui-serif, Georgia, serif',
    famille: "EB Garamond",
    fichiers: { normal: "eb-garamond-400.ttf", gras: "eb-garamond-700.ttf" },
  },
  {
    clef: "libre-baskerville",
    nom: "Libre Baskerville",
    dit: "Empattements, lisible",
    pileCss: '"Libre Baskerville", ui-serif, Georgia, serif',
    famille: "Libre Baskerville",
    fichiers: { normal: "libre-baskerville-400.ttf", gras: "libre-baskerville-700.ttf" },
  },
  {
    clef: "merriweather",
    nom: "Merriweather",
    dit: "Empattements, solide",
    pileCss: 'Merriweather, ui-serif, Georgia, serif',
    famille: "Merriweather",
    fichiers: { normal: "merriweather-400.ttf", gras: "merriweather-700.ttf" },
  },
  {
    clef: "playfair",
    nom: "Playfair Display",
    dit: "Empattements, contrasté",
    pileCss: '"Playfair Display", ui-serif, Georgia, serif',
    famille: "Playfair Display",
    fichiers: { normal: "playfair-400.ttf", gras: "playfair-700.ttf" },
  },
];

/**
 * SES RÉGLAGES D'AUJOURD'HUI — la valeur par défaut, mot pour mot sa règle.
 *
 * Le crème et l'or sont ceux de ses documents depuis toujours
 * (`design-tokens.ts`), la typographie est celle de l'appareil. Un réglage neuf
 * qui changerait l'allure de ses devis sans qu'il l'ait demandé serait un
 * défaut, pas une fonctionnalité.
 */
export const ALLURE_PAR_DEFAUT = {
  typographie: "systeme",
  // **Repris de `couleursDocument`, jamais retapé.** La première version
  // écrivait « #ece9e1 » ici — une teinte lue sur la maquette, que ses
  // documents n'ont jamais portée. Un réglage neuf, ouvert et refermé sans
  // rien changer, aurait donc repeint tous ses devis. C'est exactement la
  // valeur « provisoire » qui survit et devient un mensonge (`CLAUDE.md`
  // §4 bis). Trouvée par `test-allure-pdf.ts`, en comparant deux devis octet
  // pour octet.
  fond: couleursDocument.papier.toLowerCase(),
  accent: couleursDocument.accent.toLowerCase(),
} as const;

export type Allure = {
  typographie: string;
  fond: string;
  accent: string;
};

/** La typographie désignée, ou celle d'aujourd'hui si la clef ne dit rien. */
export function typographieDe(clef: string | null | undefined): Typographie {
  return TYPOGRAPHIES.find((t) => t.clef === clef) ?? TYPOGRAPHIES[0];
}

/**
 * Une couleur écrite `#rrggbb`, en minuscules — ou `null`.
 *
 * **On NORMALISE plutôt que de refuser.** Un nuancier rend `#ECE9E1` sur un
 * navigateur et `#ece9e1` sur un autre ; refuser l'un des deux ferait un
 * réglage qui marche sur son téléphone et pas sur son ordinateur. Ce qui n'est
 * pas une couleur, en revanche, ne rentre pas : la valeur reste celle d'avant.
 */
export function couleurNettoyee(brut: string | null | undefined): string | null {
  if (typeof brut !== "string") return null;
  const t = brut.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(t)) return t;
  // `#abc` est une écriture valide en CSS, et un nuancier peut la rendre.
  if (/^#[0-9a-f]{3}$/.test(t)) return "#" + [...t.slice(1)].map((c) => c + c).join("");
  return null;
}

/**
 * L'allure retenue, quoi qu'on lui passe.
 *
 * **Rien n'est refusé bruyamment : ce qui ne tient pas retombe sur le défaut.**
 * Un document doit toujours pouvoir se peindre — un devis qui refuserait de
 * s'imprimer parce qu'une couleur est mal écrite serait pire que le devis
 * couleur crème d'avant.
 */
export function normaliserAllure(brut: Partial<Allure> | null | undefined): Allure {
  return {
    typographie: typographieDe(brut?.typographie).clef,
    fond: couleurNettoyee(brut?.fond) ?? ALLURE_PAR_DEFAUT.fond,
    accent: couleurNettoyee(brut?.accent) ?? ALLURE_PAR_DEFAUT.accent,
  };
}

/** Vrai quand l'allure est exactement celle d'aujourd'hui — donc rien à écrire. */
export function estLAllureParDefaut(a: Allure): boolean {
  return (
    a.typographie === ALLURE_PAR_DEFAUT.typographie &&
    a.fond === ALLURE_PAR_DEFAUT.fond &&
    a.accent === ALLURE_PAR_DEFAUT.accent
  );
}

/**
 * L'ENCRE SUIT LE FOND — elle ne se choisit pas.
 *
 * **Il peut mettre n'importe quelle couleur de fond**, c'est sa décision. Un
 * fond sombre avec une encre noire donnerait un devis illisible, et il ne s'en
 * apercevrait qu'à l'impression, chez son client. Lui offrir un second réglage
 * pour l'encre ne ferait que déplacer le piège d'un cran.
 *
 * Le seuil suit la luminosité perçue — le vert compte plus que le bleu pour
 * l'œil, d'où les coefficients. Ce ne sont pas des chiffres de goût.
 */
export function encreSurFond(fond: string): { encre: string; encreDouce: string } {
  const c = couleurNettoyee(fond) ?? ALLURE_PAR_DEFAUT.fond;
  const r = parseInt(c.slice(1, 3), 16);
  const v = parseInt(c.slice(3, 5), 16);
  const b = parseInt(c.slice(5, 7), 16);
  const clair = 0.299 * r + 0.587 * v + 0.114 * b > 150;
  // L'encre douce sert les mentions et les intitulés : elle doit rester lisible
  // sur du papier, donc elle s'écarte peu de l'encre pleine.
  return clair
    ? { encre: "#141414", encreDouce: "#4a4a44" }
    : { encre: "#f5f3ee", encreDouce: "#cfccc4" };
}

/** Les composantes 0→1, ce qu'attend `pdf-lib`. */
export function enComposantes(couleur: string): { r: number; v: number; b: number } {
  const c = couleurNettoyee(couleur) ?? "#000000";
  return {
    r: parseInt(c.slice(1, 3), 16) / 255,
    v: parseInt(c.slice(3, 5), 16) / 255,
    b: parseInt(c.slice(5, 7), 16) / 255,
  };
}

/**
 * SON LOGO — ce qui est accepté, et pourquoi si peu.
 *
 * **Trois formats, pas plus.** `pdf-lib` ne sait embarquer qu'un PNG ou un
 * JPEG : un SVG, un HEIC de téléphone ou un WebP se choisiraient sans un mot à
 * l'écran, et c'est le devis parti chez le client qui n'aurait pas de logo.
 * Le refus se fait donc au moment de le poser, là où il peut encore en choisir
 * un autre.
 */
export const LOGOS_ACCEPTES = ["image/png", "image/jpeg"] as const;

/**
 * Un mégaoctet et demi. Un logo d'artisan pèse quelques dizaines de kilos ;
 * au-delà, c'est une photo prise au téléphone, et elle grossirait chaque devis
 * qu'il envoie — celui-là même que son client télécharge sur son forfait.
 */
export const LOGO_MAX_OCTETS = 1_500_000;

/** Le refus à lui montrer, ou `null` si l'image convient. Dans ses mots. */
export function refusDuLogo(mime: string, octets: number): string | null {
  if (!(LOGOS_ACCEPTES as readonly string[]).includes(mime)) {
    return "Ce format d'image ne s'imprime pas sur un devis. Choisissez un PNG ou un JPEG.";
  }
  if (octets > LOGO_MAX_OCTETS) {
    return "Cette image est trop lourde pour un devis. Prenez-en une de moins de 1,5 Mo.";
  }
  if (octets === 0) return "Cette image est vide.";
  return null;
}

/**
 * LA PLACE DU LOGO, en points PDF — la même pour tous.
 *
 * **Une hauteur fixe, une largeur libre.** Un logo carré et un logo en bandeau
 * n'ont rien à voir : imposer une boîte carrée écraserait le second. On fixe
 * donc ce qui doit s'aligner — la hauteur, contre le nom de l'entreprise — et
 * la largeur suit, jusqu'à une limite au-delà de laquelle le logo mangerait les
 * références du devis, à droite.
 */
export const LOGO_HAUTEUR = 34;
export const LOGO_LARGEUR_MAX = 150;

/** La taille rendue, à proportion gardée. Jamais agrandi au-delà du fichier. */
export function taillePourLogo(largeur: number, hauteur: number): { largeur: number; hauteur: number } {
  if (largeur <= 0 || hauteur <= 0) return { largeur: 0, hauteur: 0 };
  const facteur = Math.min(LOGO_HAUTEUR / hauteur, LOGO_LARGEUR_MAX / largeur);
  return { largeur: largeur * facteur, hauteur: hauteur * facteur };
}
