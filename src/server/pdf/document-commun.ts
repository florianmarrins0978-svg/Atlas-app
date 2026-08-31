import { adressesDuDocument } from "../../lib/adresses";
import { ligneAttendSonPrix } from "../../lib/preparation-devis";
import { PDFDocument, PDFFont, PDFImage, PDFPage, StandardFonts, rgb, RGB } from "pdf-lib";
import Decimal from "decimal.js";
import { couleursDocument } from "@/lib/design-tokens";
import {
  encreSurFond,
  estLAllureParDefaut,
  normaliserAllure,
  taillePourLogo,
  typographieDe,
  type Allure,
} from "@/lib/allure-documents";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { logger } from "@/server/logger";
import { avecCivilite } from "@/lib/civilite";
import { libelleReduction } from "@/lib/reduction-devis";
import { lignesMentionsLegales, type PositionMentionsLegales } from "@/lib/mentions-legales";

// Le moteur commun des pièces que le client reçoit : devis et facture.
//
// **Pourquoi un moteur, et non deux fichiers jumeaux.** Le modèle d'Arborea
// donne au devis et à la facture la même mise en page — en-tête, titre centré,
// colonnes émetteur/client, tableau réglé, totaux, notes, modalités, pied.
// Les copier aurait produit deux implémentations qui finissent toujours par
// diverger (`CLAUDE.md` §3), et l'écart se serait vu sur le seul document que
// le client garde.
//
// Ce qui distingue les deux pièces passe par `OptionsDocument` : le titre, les
// références d'en-tête, la mention légale, le cadre de signature, et la ligne
// qui rappelle le devis d'origine sur une facture. Tout le reste est commun.

function couleurHexa(hexa: string): RGB {
  const n = parseInt(hexa.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

// Les teintes du document viennent de `couleursDocument`, et non de `colors` :
// l'application a repris la charte d'Arborea (vert pin) tandis que le devis et
// la facture gardent la terre cuite. Les tenir au même endroit rendait le devis
// solidaire d'un changement d'écran — c'est exactement ce qui vient d'arriver,
// et c'est le contrôle des couleurs qui l'a arrêté.
const PALETTE = {
  encre: couleursDocument.encre,
  etiquette: couleursDocument.etiquette, // en-têtes de colonnes, intertitres de bloc
  titrePartie: couleursDocument.accent, // « ÉMETTEUR » / « CLIENT »
  coordonnees: "#5a5a4c", // .brand-tagline
  traitClair: "#e2ded3", // --paper-warm
  legal: "#7a7a6a",
  papier: couleursDocument.papier, // le devis n'est pas sur du blanc
} as const;

/**
 * LES TEINTES D'UN DOCUMENT — calculées, plus constantes.
 *
 * **Sa demande du 23 août 2026 :** le fond de page et la couleur d'accent se
 * règlent, *« les réglages actuels doivent être par défaut »*. Elles étaient
 * sept constantes de module ; elles descendent maintenant sur le contexte,
 * parce qu'un document n'a plus la même allure qu'un autre.
 *
 * **L'ENCRE SUIT LE FOND, elle ne se choisit pas** (`encreSurFond`) : il peut
 * mettre n'importe quelle couleur, et un fond sombre avec une encre noire
 * donnerait un devis illisible dont il ne s'apercevrait qu'à l'impression, chez
 * son client. Un second réglage pour l'encre ne ferait que déplacer le piège.
 *
 * **Une constante de module aurait été pire qu'un désordre** : partagée entre
 * deux requêtes servies en même temps, elle aurait peint le devis de l'un aux
 * couleurs de l'autre.
 */
type Teintes = {
  encre: RGB;
  etiquette: RGB;
  titrePartie: RGB;
  coordonnees: RGB;
  traitClair: RGB;
  legal: RGB;
  papier: RGB;
  /**
   * Le fond, en clair — pour la trace.
   *
   * **La trace disait « #ece9e1 » pendant que la page se peignait en vert**,
   * parce qu'elle recopiait la palette d'origine au lieu de lire la teinte
   * retenue. Un contrôle d'apparence y aurait lu le crème sur un document
   * sombre : c'est exactement le genre de vert qui ne prouve rien.
   */
  papierEcrit: string;
};

function teintesDe(brut: Allure | null | undefined): Teintes {
  // **Rien n'est cru sur parole ICI NON PLUS.** Le dépôt normalise à l'écriture,
  // mais une ligne posée par une version d'avant, ou par une main dans la base,
  // arriverait telle quelle : « bleu roi » comme couleur de fond faisait sortir
  // un devis à la couleur littérale. Trouvé par `test-allure-pdf.ts`.
  const allure = brut ? normaliserAllure(brut) : null;
  // Sans allure réglée — ou réglée sur le défaut — ce sont EXACTEMENT les
  // couleurs d'avant : le document d'un patron qui n'a rien touché ne doit pas
  // changer d'un pixel.
  //
  // **Le second cas n'est pas une optimisation.** Les teintes calculées ne
  // retombent pas d'elles-mêmes sur les six constantes d'origine — l'encre
  // douce, le trait clair et la mention légale y ont chacune leur valeur. Sans
  // cette porte, ouvrir le réglage et le refermer sans rien changer aurait
  // suffi à faire dériver son devis.
  if (!allure || estLAllureParDefaut(allure)) {
    return {
      encre: couleurHexa(PALETTE.encre),
      etiquette: couleurHexa(PALETTE.etiquette),
      titrePartie: couleurHexa(PALETTE.titrePartie),
      coordonnees: couleurHexa(PALETTE.coordonnees),
      traitClair: couleurHexa(PALETTE.traitClair),
      legal: couleurHexa(PALETTE.legal),
      papier: couleurHexa(PALETTE.papier),
      papierEcrit: PALETTE.papier,
    };
  }
  const { encre, encreDouce } = encreSurFond(allure.fond);
  return {
    encre: couleurHexa(encre),
    etiquette: couleurHexa(encreDouce),
    // L'accent tient les titres de parties et le trait sous le titre : c'est
    // là qu'il se voit, et c'est ce que la planche lui a montré.
    titrePartie: couleurHexa(allure.accent),
    coordonnees: couleurHexa(encreDouce),
    // Le trait clair est l'encre très diluée : le calculer plutôt que de le
    // fixer évite un filet noir sur un fond sombre.
    traitClair: couleurHexa(encreDouce),
    legal: couleurHexa(encreDouce),
    papier: couleurHexa(allure.fond),
    papierEcrit: allure.fond,
  };
}

/** A4, et la marge de `@page{margin:1.1cm}` du modèle. */
const LARGEUR = 595.28;
const HAUTEUR = 841.89;
const MARGE = 31.2; // 1,1 cm
const DROITE = LARGEUR - MARGE;

/**
 * Hauteur réservée en bas de chaque page : mention légale, cadre de signature
 * et le trait qui les sépare du contenu. Rien ne descend en dessous.
 */
const HAUTEUR_PIED = 114;
const PLANCHER = MARGE + HAUTEUR_PIED;

/** Le modèle écrit ses montants avec `toLocaleString('fr-FR', …)` : « 1 400,00 € ». */
const SYMBOLES: Record<string, string> = { EUR: "€" };

function formatMontant(v: string, devise: string): string {
  const [entiere, decimales] = new Decimal(v).toFixed(2).split(".");
  const signe = entiere.startsWith("-") ? "-" : "";
  const chiffres = signe ? entiere.slice(1) : entiere;
  // Espace insécable (U+00A0) et non fine (U+202F) comme séparateur : la fine
  // n'existe pas dans l'encodage WinAnsi des polices standard d'un PDF, et
  // pdf-lib refuse alors d'écrire la ligne entière.
  const groupe = chiffres.replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0");
  return `${signe}${groupe},${decimales}\u00a0${SYMBOLES[devise] ?? devise}`;
}

/** Découpe un texte pour qu'aucune ligne ne dépasse `largeur`. */
function enLignes(texte: string, police: PDFFont, taille: number, largeur: number): string[] {
  const lignes: string[] = [];
  for (const paragraphe of texte.split("\n")) {
    let courante = "";
    for (const mot of paragraphe.split(/\s+/)) {
      const essai = courante ? `${courante} ${mot}` : mot;
      if (police.widthOfTextAtSize(essai, taille) > largeur && courante) {
        lignes.push(courante);
        courante = mot;
      } else {
        courante = essai;
      }
    }
    lignes.push(courante);
  }
  return lignes;
}

// ─── Ce que le document dépose sur le papier ────────────────────────────────
//
// Chaque geste est consigné au passage. Sans cela, rien de la mise en page
// n'est vérifiable : un PDF ne se relit pas, et un texte espacé lettre à lettre
// ne se retrouve même pas dans le flux. C'est cette trace que les tests
// interrogent — pour savoir qu'une mention est bien là, et surtout qu'aucune
// ligne n'est descendue sur le cadre de signature.

export type TexteTrace = {
  contenu: string;
  x: number;
  y: number;
  taille: number;
  page: number;
  /** En hexadécimal, pour qu'un contrôle puisse constater une teinte qui dérive. */
  couleur: string;
};
export type TraitTrace = { y: number; de: number; a: number; epaisseur: number; page: number };
export type CadreTrace = { x: number; y: number; largeur: number; hauteur: number; page: number };
export type TraceDocument = {
  pages: number;
  textes: TexteTrace[];
  traits: TraitTrace[];
  cadres: CadreTrace[];
  /** Le fond posé, une entrée par page — une page restée blanche se verrait. */
  fonds: { page: number; couleur: string }[];
  /**
   * Le logo, quand il y en a un : sa place et sa taille en points.
   *
   * **Sans cette trace, aucun contrôle ne peut rien dire du logo.** Une image
   * ne laisse pas de texte : un devis qui l'aurait perdue, ou qui l'écraserait
   * sur les coordonnées, passerait toutes les suites au vert.
   */
  logos: { x: number; y: number; largeur: number; hauteur: number }[];
};

type Contexte = {
  pdfDoc: PDFDocument;
  page: PDFPage;
  numeroPage: number;
  sans: PDFFont;
  sansGras: PDFFont;
  serif: PDFFont;
  serifGras: PDFFont;
  /** Les couleurs de CE document — son allure, ou celle d'avant. */
  teintes: Teintes;
  trace: TraceDocument;
};
type Style = { taille?: number; police?: PDFFont; couleur?: RGB };

/** Retrouve le nom hexadécimal d'une couleur posée, pour la consigner. */
function enHexa(couleur: RGB): string {
  const octet = (v: number) => Math.round(v * 255).toString(16).padStart(2, "0");
  return `#${octet(couleur.red)}${octet(couleur.green)}${octet(couleur.blue)}`;
}

/** Pose l'encre, sans rien consigner — les fonctions publiques s'en chargent. */
function poser(ctx: Contexte, contenu: string, x: number, y: number, style: Style) {
  ctx.page.drawText(contenu, {
    x,
    y,
    size: style.taille ?? 9.5,
    font: style.police ?? ctx.sans,
    color: style.couleur ?? ctx.teintes.encre,
  });
}

function ecrire(ctx: Contexte, contenu: string, x: number, y: number, style: Style = {}) {
  poser(ctx, contenu, x, y, style);
  ctx.trace.textes.push({
    contenu,
    x,
    y,
    taille: style.taille ?? 9.5,
    page: ctx.numeroPage,
    couleur: enHexa(style.couleur ?? ctx.teintes.encre),
  });
}

/** Texte calé sur son bord droit — colonnes de chiffres et bloc de totaux. */
function ecrireADroite(ctx: Contexte, contenu: string, droite: number, y: number, style: Style = {}) {
  const police = style.police ?? ctx.sans;
  const taille = style.taille ?? 9.5;
  ecrire(ctx, contenu, droite - police.widthOfTextAtSize(contenu, taille), y, style);
}

function trait(ctx: Contexte, y: number, epaisseur: number, couleur: RGB, de = MARGE, a = DROITE) {
  ctx.page.drawLine({ start: { x: de, y }, end: { x: a, y }, thickness: epaisseur, color: couleur });
  ctx.trace.traits.push({ y, de, a, epaisseur, page: ctx.numeroPage });
}

// ─── Petites capitales espacées ─────────────────────────────────────────────
//
// Le modèle espace les lettres de tous ses intertitres (`letter-spacing:0.08em`
// à `0.1em`) et de son titre. pdf-lib ne sait pas le faire : `drawText` n'a pas
// d'option d'approche. On écrit donc lettre par lettre. Sans cela les petites
// capitales se tassent et le document perd exactement ce qui le rendait
// reconnaissable — c'est ce que le patron voyait au premier coup d'œil.

/** Approche du modèle : une fraction du corps, comme un `em` en CSS. */
const APPROCHE_ETIQUETTE = 0.09;
const APPROCHE_TITRE = 0.06;

function largeurEspacee(contenu: string, police: PDFFont, taille: number, approche: number): number {
  const lettres = [...contenu];
  return (
    police.widthOfTextAtSize(contenu, taille) + taille * approche * Math.max(lettres.length - 1, 0)
  );
}

function ecrireEspace(
  ctx: Contexte,
  contenu: string,
  x: number,
  y: number,
  approche: number,
  style: Style = {}
) {
  const police = style.police ?? ctx.sans;
  const taille = style.taille ?? 9.5;
  let curseur = x;
  for (const lettre of contenu) {
    poser(ctx, lettre, curseur, y, style);
    curseur += police.widthOfTextAtSize(lettre, taille) + taille * approche;
  }
  // Consigné d'un bloc, et non lettre par lettre : c'est la mention qu'on veut
  // pouvoir retrouver, pas les vingt caractères qui la composent.
  ctx.trace.textes.push({
    contenu,
    x,
    y,
    taille,
    page: ctx.numeroPage,
    couleur: enHexa(style.couleur ?? ctx.teintes.encre),
  });
}

/** Même chose, calée sur le bord droit — en-têtes des colonnes de chiffres. */
function ecrireEspaceADroite(
  ctx: Contexte,
  contenu: string,
  droite: number,
  y: number,
  approche: number,
  style: Style = {}
) {
  const police = style.police ?? ctx.sans;
  const taille = style.taille ?? 9.5;
  // La dernière lettre ne porte pas d'approche à sa droite : la mesure la
  // retire déjà, sinon la colonne paraîtrait décalée d'un cheveu vers la gauche.
  ecrireEspace(ctx, contenu, droite - largeurEspacee(contenu, police, taille, approche), y, approche, style);
}

/**
 * Le papier crème du modèle, posé avant tout le reste.
 *
 * Le patron ne voit pas son devis sur du blanc. À l'impression, un navigateur
 * ne sort les fonds que si on le lui demande — un PDF, lui, les sort toujours :
 * cette teinte partira donc sur sa feuille. C'est le prix du « exactement le
 * même », et il est assumé ici plutôt que découvert à la première cartouche.
 */
function poserPapier(ctx: Contexte) {
  ctx.page.drawRectangle({ x: 0, y: 0, width: LARGEUR, height: HAUTEUR, color: ctx.teintes.papier });
  ctx.trace.fonds.push({ page: ctx.numeroPage, couleur: ctx.teintes.papierEcrit });
}

/** Ouvre une page de plus et rend l'ordonnée où reprendre le contenu. */
function pageSuivante(ctx: Contexte): number {
  ctx.page = ctx.pdfDoc.addPage([LARGEUR, HAUTEUR]);
  ctx.numeroPage += 1;
  ctx.trace.pages = ctx.numeroPage;
  poserPapier(ctx);
  return HAUTEUR - MARGE - 20;
}

// ─── Ce que toute pièce porte, et ce qui la distingue ───────────────────────

export type LigneDocument = {
  libelle: string;
  quantite: string;
  prixUnitaire: string;
  montant: string;
  /** L'unité de la quantité — « ml », « m² », « souche » (migration 0070). */
  unite?: string | null;
  /**
   * Le travail est identifié, son prix ne l'est pas (migration 0070).
   *
   * **Un devis portant une telle ligne ne peut pas être envoyé** — le contrôle
   * vit dans `envoyerDevis`. Elle n'apparaît donc que sur l'aperçu, celui qu'il
   * relit avant de décider, et il faut qu'elle y dise « à chiffrer » plutôt que
   * « 0,00 € » : un zéro se lit « gratuit ».
   */
  aChiffrer?: boolean | null;
};

export type DonneesDocument = {
  entrepriseNom: string;
  entrepriseAdresse?: string | null;
  entrepriseSiret?: string | null;
  entrepriseTelephone?: string | null;
  entrepriseEmail?: string | null;
  entrepriseIban?: string | null;
  /**
   * Les trois mentions légales, et leur emplacement (migration 0072). Absentes
   * sur un document d'avant la migration : rien de plus ne s'imprime.
   */
  entrepriseFormeJuridique?: string | null;
  entrepriseCapitalSocial?: string | null;
  entrepriseVilleRcs?: string | null;
  entrepriseMentionsLegalesPosition?: PositionMentionsLegales | null;
  clientNom?: string | null;
  /** Recopiée sur le document au moment où il est établi (migration 0038). */
  clientCivilite?: "mr" | "mme" | null;
  clientAdresse?: string | null;
  clientTelephone?: string | null;
  adresseChantier?: string | null;
  conditionsPaiement?: string | null;
  devise: string;
  tauxTva: string;
  /** **Déjà net de la réduction** — voir `src/lib/reduction-devis.ts`. */
  totalHt: string;
  totalTva: string;
  totalTtc: string;
  /**
   * Le prix accordé au client, s'il y en a un.
   *
   * *Arrangement B, choisi par le patron le 16 août 2026 :* « sous le total et
   * prix accordé au client ». Le prix plein s'écrit d'abord, la remise dessous,
   * puis le net — d'où le besoin des DEUX : le pourcentage pour la phrase, le
   * montant pour la colonne de droite.
   *
   * Absents : le bloc de totaux est exactement celui d'avant le 16 août. Les
   * milliers de devis déjà émis ne changent pas d'un pixel.
   */
  reductionPourcent?: string | null;
  reductionMontant?: string | null;
  lignes: LigneDocument[];
};

/**
 * SON LOGO, embarqué — ou rien, et le document sort quand même.
 *
 * **Une image refusée ne doit pas empêcher un devis de partir.** Un fichier
 * renommé en `.png` mais qui n'en est pas un, un JPEG progressif que `pdf-lib`
 * ne sait pas lire : dans tous ces cas le document se compose sans logo, et
 * l'incident se journalise. L'inverse — lever — priverait son client du devis
 * pour une question d'apparence.
 *
 * Le refus utile, celui qu'il peut corriger, se fait bien plus haut : au moment
 * où il choisit l'image (`refusDuLogo`).
 */
async function imageDuLogo(
  pdfDoc: PDFDocument,
  logo: LogoDocument | null | undefined
): Promise<PDFImage | null> {
  if (!logo) return null;
  try {
    return logo.mime === "image/png"
      ? await pdfDoc.embedPng(logo.octets)
      : await pdfDoc.embedJpg(logo.octets);
  } catch (err) {
    logger.error("Logo illisible, document composé sans lui", {
      mime: logo.mime,
      erreur: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * LES QUATRE POLICES DU DOCUMENT — celles d'avant, ou la sienne.
 *
 * **Un PDF n'a que deux polices nativement** : Times et Helvetica, celles du
 * format. C'est tout ce que ses devis portaient jusqu'au 23 août 2026, et c'est
 * ce que rend cette fabrique tant qu'il n'a rien choisi.
 *
 * **Une typographie choisie remplace les QUATRE**, linéale comme serif. Le
 * document distingue les deux par l'usage — la serif pour les titres de partie,
 * la linéale pour les intitulés de colonnes —, mais mêler la sienne à Times
 * ferait un document à deux mains, ce qui est pire que pas de choix du tout.
 *
 * **LES FICHIERS SONT DÉJÀ RÉDUITS, ET LE PDF LES EMBARQUE ENTIERS.** C'est
 * l'inverse de ce qu'on écrit d'ordinaire, et ça a été payé : `pdf-lib`
 * découpe lui-même la police quand on lui passe `subset: true`, et **son
 * découpeur ment**. Sur EB Garamond, un devis complet ne sortait plus que
 * « e e e Roc e e » — pas d'erreur, pas de journal : les caractères ne
 * s'imprimaient simplement pas. Un devis muet part quand même chez le client.
 *
 * Les fichiers de `polices/` ont donc été réduits une fois pour toutes au
 * latin dont ses documents ont besoin (`polices/LISEZ-MOI.md` donne la
 * commande). Ils pèsent 16 à 30 ko chacun, deux par document — et rien ne les
 * retouche à l'exécution. `scripts/test-polices-documents.ts` monte la garde.
 */
async function policesDu(
  pdfDoc: PDFDocument,
  allure: Allure | null | undefined
): Promise<{ sans: PDFFont; sansGras: PDFFont; serif: PDFFont; serifGras: PDFFont }> {
  // Même prudence que pour les teintes : une clef écrite par une version d'avant
  // ne doit pas empêcher le document de sortir.
  const choisie = allure ? typographieDe(normaliserAllure(allure).typographie) : null;
  if (!choisie?.fichiers) {
    return {
      sans: await pdfDoc.embedFont(StandardFonts.Helvetica),
      sansGras: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
      serif: await pdfDoc.embedFont(StandardFonts.TimesRoman),
      serifGras: await pdfDoc.embedFont(StandardFonts.TimesRomanBold),
    };
  }

  const dossier = path.join(process.cwd(), "src/server/pdf/polices");
  try {
    const [normal, gras] = await Promise.all([
      readFile(path.join(dossier, choisie.fichiers.normal)),
      readFile(path.join(dossier, choisie.fichiers.gras)),
    ]);
    const [police, policeGrasse] = await Promise.all([
      // `subset: false` : voir plus haut — le découpeur de `pdf-lib` perd des
      // caractères en silence, et Archivo Narrow le fait carrément tomber.
      pdfDoc.embedFont(normal, { subset: false }),
      pdfDoc.embedFont(gras, { subset: false }),
    ]);
    return { sans: police, sansGras: policeGrasse, serif: police, serifGras: policeGrasse };
  } catch (err) {
    // **Un fichier manquant ne doit pas empêcher son devis de sortir.** Il
    // partirait sans document chez son client, pour un choix d'apparence. On
    // retombe sur les polices du format, et l'on journalise — sans quoi
    // personne ne saurait jamais pourquoi son devis a repris son ancienne
    // allure (`AGENTS.md` : un défaut muet se rend d'abord bavard).
    logger.error("Typographie du document introuvable, retour aux polices du format", {
      typographie: choisie.clef,
      erreur: err instanceof Error ? err.message : String(err),
    });
    return {
      sans: await pdfDoc.embedFont(StandardFonts.Helvetica),
      sansGras: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
      serif: await pdfDoc.embedFont(StandardFonts.TimesRoman),
      serifGras: await pdfDoc.embedFont(StandardFonts.TimesRomanBold),
    };
  }
}

/**
 * Le logo tel qu'un document l'embarque : ses octets, et son format.
 *
 * **PNG ou JPEG, et rien d'autre** — ce sont les deux seuls que `pdf-lib` sait
 * embarquer. Le refus se fait bien plus haut, au moment où il choisit l'image
 * (`refusDuLogo`), pour qu'il puisse encore en prendre une autre.
 */
export type LogoDocument = { octets: Uint8Array; mime: string };

export type OptionsDocument = {
  /** « DEVIS », « FACTURE », ou leur variante brouillon. */
  titre: string;
  /**
   * L'allure réglée par le patron — typographie, fond, accent.
   *
   * **Absente : le document d'avant, au pixel près.** C'est ce que reçoit la
   * feuille de chantier et le compte rendu d'entretien, que sa décision du
   * 23 août 2026 laisse délibérément hors du réglage.
   */
  allure?: Allure | null;
  /**
   * Son logo, déjà lu — les octets et leur format.
   *
   * **Ce module ne va PAS le chercher lui-même.** Un composeur de document qui
   * saurait lire dans le stockage deviendrait impossible à éprouver sans
   * compartiment ; c'est le dépôt qui lit, et qui décide quoi faire d'un logo
   * introuvable.
   */
  logo?: LogoDocument | null;
  /** Le bloc de références en haut à droite : libellé et valeur. */
  references: [string, string][];
  /** Intertitre du bloc de notes — le devis y met aussi ses conditions. */
  titreNotes: string;
  /**
   * L'en-tête de la colonne des lignes. « DESCRIPTION » par défaut — mais une
   * fiche de chantier liste ce qui a été fait, pas ce qui est proposé.
   */
  enTeteLignes?: string;
  /**
   * Des blocs de texte supplémentaires — `[intertitre, contenu]` —, écrits
   * avant celui des notes.
   *
   * **Pourquoi ils existent.** La fiche de chantier a besoin de deux blocs de
   * plus que le devis : le matériel employé et le compte des photos. Le premier
   * réflexe avait été de les entasser dans le `rappel` de l'en-tête, séparés par
   * des retours à la ligne — mais ce champ s'écrit d'un seul trait : les trois
   * lignes se seraient imprimées bout à bout, ou `pdf-lib` aurait refusé le
   * saut de ligne. Un mécanisme nommé vaut mieux qu'un champ détourné.
   *
   * Le devis et la facture n'en passent aucun, et rien ne change pour eux.
   */
  blocsTexte?: [string, string][];
  /** Mention légale du pied. Elle diffère du tout au tout entre les deux pièces. */
  mentionLegale: (data: DonneesDocument) => string;
  /** Le devis se signe, la facture se règle. */
  cadreSignature: boolean;
  /** Sur une facture, le rappel du devis d'origine. */
  rappel?: string | null;
  /**
   * Le document ne porte AUCUN chiffre : ni colonnes de prix, ni totaux, ni TVA.
   *
   * **Pour la fiche de chantier**, demandée par le patron le 20 août 2026. Elle
   * dit ce qui a été fait, pas ce que ça coûte — le client l'a déjà su par le
   * devis, et le saura par la facture.
   *
   * **Pourquoi une option plutôt qu'un troisième moteur.** Devis, facture et
   * fiche partagent tout le reste : le papier, l'en-tête de l'entreprise, le
   * bloc émetteur/client, les notes, le pied, la pagination. Les recopier
   * produirait deux mises en page qui divergent — et c'est le client qui verrait
   * la différence entre les feuilles qu'un même artisan lui envoie
   * (`CLAUDE.md` §3).
   *
   * **Absente, rien ne change.** Chaque `if` posé pour elle est additif, et une
   * empreinte de la trace du devis et de la facture le prouve au centième de
   * point (`scripts/test-fiche-chantier-pdf.ts`).
   */
  sansChiffrage?: boolean;
};


export async function composerDocument(
  data: DonneesDocument,
  options: OptionsDocument
): Promise<{ pdf: Uint8Array; trace: TraceDocument }> {
  const pdfDoc = await PDFDocument.create();
  // **`registerFontkit` inconditionnellement**, même sans typographie choisie :
  // l'oublier ne se verrait qu'au premier document d'un patron qui en a réglé
  // une, c'est-à-dire chez lui et pas ici.
  pdfDoc.registerFontkit(fontkit);
  const polices = await policesDu(pdfDoc, options.allure);
  const ctx: Contexte = {
    pdfDoc,
    page: pdfDoc.addPage([LARGEUR, HAUTEUR]),
    numeroPage: 1,
    ...polices,
    teintes: teintesDe(options.allure),
    trace: { pages: 1, textes: [], traits: [], cadres: [], fonds: [], logos: [] },
  };
  poserPapier(ctx);

  /** La ligne de départ de l'en-tête, avant que le logo ne pousse le nom. */
  const yEnTete = HAUTEUR - MARGE - 22;
  let y = yEnTete;

  /** Descend de `hauteur`, en changeant de page si le pied est atteint. */
  const place = (hauteur: number): void => {
    if (y - hauteur < PLANCHER) y = pageSuivante(ctx);
  };

  // ─── Le logo, au-dessus du nom ──────────────────────────────────────────
  // **Au-dessus, et pas à côté.** Les références du devis occupent le quart
  // droit de cette même bande : un logo posé à gauche du nom viendrait les
  // toucher dès qu'il est un peu large, et un numéro de devis illisible coûte
  // plus cher qu'un en-tête d'un centimètre plus haut.
  const logo = await imageDuLogo(pdfDoc, options.logo);
  if (logo) {
    const t = taillePourLogo(logo.width, logo.height);
    const yImage = HAUTEUR - MARGE - t.hauteur;
    ctx.page.drawImage(logo, { x: MARGE, y: yImage, width: t.largeur, height: t.hauteur });
    ctx.trace.logos.push({ x: MARGE, y: yImage, largeur: t.largeur, hauteur: t.hauteur });
    // Le nom descend sous le logo ; les références, elles, restent en haut.
    y = yImage - 10 - 22;
  }

  // ─── En-tête : l'entreprise à gauche, les références à droite ───────────
  ecrire(ctx, data.entrepriseNom, MARGE, y, { taille: 22, police: ctx.sans });

  // **UNE LIGNE PAR INFORMATION**, sa demande du 25 août 2026 : *« en haut à
  // gauche il y a un tiret entre le numéro de tél et l'adresse e-mail, change
  // ça, il faut sauter une ligne, une ligne par information »*. Le téléphone et
  // l'e-mail tenaient sur la même ligne, séparés d'un tiret cadratin — c'est
  // lisible sur un écran large, c'est un pâté sur un devis imprimé.
  //
  // **La forme juridique, le capital et le RCS s'y glissent selon SON choix**
  // (migration 0072) : sous le nom, avec le reste des coordonnées, ou nulle
  // part. `lignesMentionsLegales` rend déjà zéro ligne quand rien n'a été
  // réglé — les documents d'avant la migration ressortent identiques à eux-
  // mêmes, sans qu'il ait fallu un `if` de plus ici.
  const positionMentions = data.entrepriseMentionsLegalesPosition ?? "aucune";
  const mentionsLegales = lignesMentionsLegales({
    formeJuridique: data.entrepriseFormeJuridique,
    capitalSocial: data.entrepriseCapitalSocial,
    villeRcs: data.entrepriseVilleRcs,
    siret: data.entrepriseSiret,
    position: positionMentions,
  });

  let yCoord = y - 15;
  if (positionMentions === "sous_nom") {
    for (const ligne of mentionsLegales) {
      ecrire(ctx, ligne, MARGE, yCoord, { taille: 8.5, couleur: ctx.teintes.coordonnees });
      yCoord -= 11;
    }
  }

  const coordonnees = [
    ...(positionMentions === "bas" ? mentionsLegales : []),
    data.entrepriseAdresse,
    data.entrepriseTelephone,
    data.entrepriseEmail,
    data.entrepriseSiret ? `SIRET ${data.entrepriseSiret}` : null,
  ].filter((l): l is string => !!l);

  for (const ligne of coordonnees) {
    ecrire(ctx, ligne, MARGE, yCoord, { taille: 8.5, couleur: ctx.teintes.coordonnees });
    yCoord -= 11;
  }

  const references = options.references;
  // Les références ne suivent PAS le logo : elles occupent leur propre colonne.
  let yRef = yEnTete;
  for (const [libelle, valeur] of references) {
    ecrire(ctx, libelle, DROITE - 175, yRef, { taille: 8.5, police: ctx.sansGras, couleur: ctx.teintes.etiquette });
    ecrireADroite(ctx, valeur, DROITE, yRef, { taille: 9 });
    trait(ctx, yRef - 4, 0.5, ctx.teintes.traitClair, DROITE - 105, DROITE);
    yRef -= 17;
  }

  y = Math.min(yCoord, yRef) - 8;
  trait(ctx, y, 1.6, ctx.teintes.encre);
  y -= 30;

  // ─── Titre centré ───────────────────────────────────────────────────────
  // Le brouillon le dit : une pièce non émise qui ne le signale pas peut être
  // transmise par erreur, alors qu'elle n'engage rien.
  const titre = options.titre;
  ecrireEspace(
    ctx,
    titre,
    (LARGEUR - largeurEspacee(titre, ctx.serif, 17, APPROCHE_TITRE)) / 2,
    y,
    APPROCHE_TITRE,
    { taille: 17, police: ctx.serif }
  );
  y -= 32;

  // Une facture rappelle le devis dont elle naît : sans ce lien, le client
  // reçoit deux pièces qu'il doit rapprocher lui-même. Elle consomme sa propre
  // hauteur : posée sans descendre, elle venait toucher « ÉMETTEUR ».
  if (options.rappel) {
    ecrire(ctx, options.rappel, MARGE, y, { taille: 8.5, couleur: ctx.teintes.etiquette });
    y -= 20;
  }

  // ─── Le client, seul ────────────────────────────────────────────────────
  // Le client occupe la moitié gauche : au-delà, une adresse longue viendrait
  // courir sous les références du devis, qui tiennent le quart droit.
  const largeurColonne = (DROITE - MARGE) / 2 - 10;

  // Ces deux-là sont des `h3` dans le modèle : ils prennent donc la serif, là
  // où les en-têtes de colonnes et les intertitres restent en linéale.
  // **Le PDF n'a jamais chargé Playfair ni Inter** — il embarque Times et
  // Helvetica, les polices standard du format. C'est ce qui l'a mis d'accord
  // tout seul avec l'écran le 10 août 2026, quand l'application est passée aux
  // polices de l'appareil.
  // **L'ÉMETTEUR N'APPARAÎT PLUS DEUX FOIS.** Sa question du 25 août 2026 :
  // *« pourquoi il y a deux fois l'émetteur sur l'aperçu ? »*. Il avait raison,
  // et ce n'était pas une convention : l'en-tête porte déjà le nom, l'adresse et
  // le SIRET, et le bloc du bas les réécrivait mot pour mot, dix centimètres
  // plus bas. Rien ne l'exigeait — les mentions obligatoires doivent figurer,
  // pas figurer deux fois.
  //
  // **Le client passe donc à gauche**, seul de sa rangée : une colonne
  // « CLIENT » restée à droite avec un vide en face se serait lue comme un
  // bloc oublié à l'impression.
  const etiquettePartie: Style = { taille: 8.5, police: ctx.serif, couleur: ctx.teintes.titrePartie };
  ecrireEspace(ctx, "CLIENT", MARGE, y, APPROCHE_ETIQUETTE, etiquettePartie);
  y -= 15;

  const client = [
    // **Le papier nomme le client comme l'écran et le message.** Une seule
    // règle (`src/lib/civilite.ts`) : recopiée ici, elle aurait fini par dire
    // « Mme Roux » à l'écran et « Mr. Roux » sur le PDF qu'elle garde.
    avecCivilite(data.clientNom, data.clientCivilite),
    // L'adresse du client — ou, à défaut, celle du chantier, sans étiquette.
    // La ligne « Chantier : … » ne subsiste que si les travaux ont lieu
    // ailleurs. Même fonction qu'à l'écran (`src/lib/adresses.ts`) : deux
    // règles recopiées auraient fini par diverger, et c'est le papier — ce que
    // le client garde — qui serait resté faux.
    adressesDuDocument(data).adresseClient,
    data.clientTelephone,
    adressesDuDocument(data).chantierSepare ? `Chantier : ${adressesDuDocument(data).chantierSepare}` : null,
  ]
    .filter((l): l is string => !!l)
    .flatMap((l) => enLignes(l, ctx.sans, 9, largeurColonne));

  client.forEach((l, i) => ecrire(ctx, l, MARGE, y - i * 12, { taille: 9 }));
  y -= client.length * 12 + 22;

  // ─── Tableau des lignes ─────────────────────────────────────────────────
  const xQte = DROITE - 240;
  const xPrix = DROITE - 140;
  const xMontant = DROITE;

  const enTeteColonne: Style = { taille: 7.5, police: ctx.sansGras, couleur: ctx.teintes.etiquette };
  const enTeteTableau = () => {
    ecrireEspace(ctx, options.enTeteLignes ?? "DESCRIPTION", MARGE, y, APPROCHE_ETIQUETTE, enTeteColonne);
    if (!options.sansChiffrage) {
      ecrireEspaceADroite(ctx, "QTÉ", xQte, y, APPROCHE_ETIQUETTE, enTeteColonne);
      ecrireEspaceADroite(ctx, "PRIX UNITAIRE HT", xPrix, y, APPROCHE_ETIQUETTE, enTeteColonne);
      ecrireEspaceADroite(ctx, "MONTANT HT", xMontant, y, APPROCHE_ETIQUETTE, enTeteColonne);
    }
    y -= 9;
    trait(ctx, y, 1.2, ctx.teintes.encre);
    y -= 17;
  };
  enTeteTableau();

  if (data.lignes.length === 0) {
    // Un tableau vide sans un mot laisse croire à un document tronqué.
    ecrire(ctx, "Aucune ligne pour l'instant.", MARGE, y, { taille: 9, couleur: ctx.teintes.etiquette });
    y -= 14;
    trait(ctx, y, 0.7, ctx.teintes.traitClair);
    y -= 12;
  }

  for (const ligne of data.lignes) {
    // Sans colonnes de prix, le libellé dispose de toute la feuille : garder la
    // largeur du devis couperait « Démontage de trois chênes en tête de chat »
    // en deux pour laisser la place à des colonnes qui n'existent pas.
    const largeurLibelle = options.sansChiffrage ? DROITE - MARGE : xQte - MARGE - 50;
    const lignesLibelle = enLignes(ligne.libelle, ctx.sans, 9, largeurLibelle);
    const hauteurLigne = Math.max(lignesLibelle.length, 1) * 11 + 19;
    // Une ligne ne se coupe jamais en deux : elle passe entière à la page
    // suivante, en-tête de colonnes redessiné pour qu'on sache encore ce
    // qu'on lit.
    if (y - hauteurLigne < PLANCHER) {
      y = pageSuivante(ctx);
      enTeteTableau();
    }
    lignesLibelle.forEach((l, i) => ecrire(ctx, l, MARGE, y - i * 11, { taille: 9 }));
    if (!options.sansChiffrage) {
      // **L'unité à côté de la quantité** : « 800 ml », plus « 800 » tout court.
      // Le client lisait « 800 × 17,50 € » sans savoir 800 de quoi.
      ecrireADroite(ctx, ligne.unite ? `${ligne.quantite} ${ligne.unite}` : ligne.quantite, xQte, y, {
        taille: 9,
      });
      // **« À chiffrer » ne se lit plus sur le seul drapeau** — sa capture du
      // 31 août 2026. Le tableau portait « à chiffrer » en face de deux lignes
      // qui pesaient 1 720 €, et le Total HT, lui, les comptait : 2 280,00 €
      // sous 560,00 € de montants visibles. Un client qui additionne n'y
      // arrive pas, et cesse de croire le reste du document.
      //
      // L'invariant vit dans `ligneAttendSonPrix` — un montant posé répond à
      // la question, quel que soit le drapeau — et il est partagé avec l'écran
      // et avec le contrôle d'envoi. Ce qui est imprimé fait donc toujours le
      // total imprimé.
      if (ligneAttendSonPrix({ libelle: ligne.libelle, montant: ligne.montant, aChiffrer: ligne.aChiffrer })) {
        // Ni prix unitaire, ni montant : il n'y en a pas. Écrire « 0,00 € »
        // serait annoncer un travail gratuit (26 août 2026).
        ecrireADroite(ctx, "à chiffrer", xMontant, y, { taille: 9, police: ctx.sansGras });
      } else {
        ecrireADroite(ctx, formatMontant(ligne.prixUnitaire, data.devise), xPrix, y, { taille: 9 });
        ecrireADroite(ctx, formatMontant(ligne.montant, data.devise), xMontant, y, {
          taille: 9,
          police: ctx.sansGras,
        });
      }
    }
    y -= Math.max(lignesLibelle.length, 1) * 11 + 7;
    trait(ctx, y, 0.7, ctx.teintes.traitClair);
    y -= 12;
  }

  // ─── Totaux, calés à droite ─────────────────────────────────────────────
  // Le bloc entier tient sur une seule page : un « Total TTC » séparé de son
  // « Total HT » par un saut de page se lit de travers.
  //
  // **Sauté en entier sur une fiche de chantier.** Écrire « Total TTC : 0,00 € »
  // sur un compte rendu de travaux ferait croire à un travail fait pour rien —
  // c'est la même règle que la fiche client, où un montant absent s'écrit « — »
  // et jamais « 0 € » (`CLAUDE.md` §4).
  if (!options.sansChiffrage) {
  const libelleRemise = libelleReduction(data.reductionPourcent ?? null);
  const avecRemise = libelleRemise !== null && data.reductionMontant != null;
  // Deux lignes de plus quand une remise est accordée : la place se réserve
  // AVANT le saut de page, sinon « Total TTC » se retrouve seul en haut de la
  // page suivante.
  place(avecRemise ? 74 + 32 : 74);
  y -= 6;
  const gaucheTotaux = DROITE - 220;

  if (avecRemise) {
    // **Le prix plein d'abord**, puis ce qui a été consenti, puis le net : c'est
    // la présentation qu'il a choisie, et c'est celle qui permet au client de
    // refaire le calcul. Le brut vaut net + retiré, jamais une troisième
    // colonne qui pourrait les contredire.
    const brut = new Decimal(data.totalHt).plus(new Decimal(data.reductionMontant!)).toFixed(2);
    ecrire(ctx, "Total HT", gaucheTotaux, y, { taille: 9.5 });
    ecrireADroite(ctx, formatMontant(brut, data.devise), DROITE, y, { taille: 9.5 });
    y -= 16;

    ecrire(ctx, libelleRemise!, gaucheTotaux, y, { taille: 9.5 });
    // **Le trait d'union, jamais le « moins » typographique (U+2212).** Les
    // polices standard du PDF sont encodées en WinAnsi, qui ne le connaît pas :
    // `pdf-lib` lève « WinAnsi cannot encode "−" », et c'est TOUT le devis qui
    // ne se génère plus. Trouvé par `test-reduction-parcours-db.ts`, pas par le
    // typage — l'écran, lui, l'affiche très bien, ce qui rendait le défaut
    // invisible partout ailleurs.
    ecrireADroite(ctx, `- ${formatMontant(data.reductionMontant!, data.devise)}`, DROITE, y, { taille: 9.5 });
    y -= 16;

    ecrire(ctx, "Total HT après remise", gaucheTotaux, y, { taille: 9.5 });
    ecrireADroite(ctx, formatMontant(data.totalHt, data.devise), DROITE, y, { taille: 9.5 });
    y -= 16;
  } else {
    ecrire(ctx, "Total HT", gaucheTotaux, y, { taille: 9.5 });
    ecrireADroite(ctx, formatMontant(data.totalHt, data.devise), DROITE, y, { taille: 9.5 });
    y -= 16;
  }

  const tauxLisible = new Decimal(data.tauxTva).toFixed(2).replace(/[.]00$/, "").replace(".", ",");
  ecrire(ctx, `TVA (${tauxLisible} %)`, gaucheTotaux, y, { taille: 9.5 });
  ecrireADroite(ctx, formatMontant(data.totalTva, data.devise), DROITE, y, { taille: 9.5 });
  y -= 14;

  trait(ctx, y, 1.6, ctx.teintes.encre, gaucheTotaux, DROITE);
  y -= 22;

  ecrire(ctx, "Total TTC", gaucheTotaux, y, { taille: 14, police: ctx.serifGras });
  ecrireADroite(ctx, formatMontant(data.totalTtc, data.devise), DROITE, y, {
    taille: 14,
    police: ctx.serifGras,
  });
  y -= 34;
  }

  // ─── Conditions et modalités de paiement ────────────────────────────────
  const etiquetteBloc: Style = { taille: 7.5, police: ctx.sansGras, couleur: ctx.teintes.etiquette };

  // Les blocs supplémentaires — matériel, photos — passent avant les notes :
  // ils décrivent le chantier, là où les notes commentent.
  for (const [intertitre, contenu] of options.blocsTexte ?? []) {
    const lignesBloc = enLignes(contenu, ctx.sans, 9, DROITE - MARGE);
    place(14 + lignesBloc.length * 12);
    ecrireEspace(ctx, intertitre, MARGE, y, APPROCHE_ETIQUETTE, etiquetteBloc);
    y -= 14;
    for (const l of lignesBloc) {
      ecrire(ctx, l, MARGE, y, { taille: 9 });
      y -= 12;
    }
    y -= 12;
  }

  if (data.conditionsPaiement) {
    const lignesNotes = enLignes(data.conditionsPaiement, ctx.sans, 9, DROITE - MARGE);
    place(14 + lignesNotes.length * 12);
    ecrireEspace(ctx, options.titreNotes, MARGE, y, APPROCHE_ETIQUETTE, etiquetteBloc);
    y -= 14;
    for (const l of lignesNotes) {
      ecrire(ctx, l, MARGE, y, { taille: 9 });
      y -= 12;
    }
    y -= 12;
  }

  // Les modalités de paiement suivent le chiffrage : sur une fiche de chantier,
  // un IBAN sans montant invite à payer une somme que personne n'a écrite.
  if (data.entrepriseIban && !options.sansChiffrage) {
    place(38);
    ecrireEspace(ctx, "MODALITÉS DE PAIEMENT", MARGE, y, APPROCHE_ETIQUETTE, etiquetteBloc);
    y -= 14;
    ecrire(ctx, "Paiement par virement bancaire", MARGE, y, { taille: 9 });
    y -= 12;
    ecrire(ctx, `IBAN : ${data.entrepriseIban}`, MARGE, y, { taille: 9 });
  }

  // ─── Pied : mention légale à gauche, cadre de signature à droite ────────
  // Ancré en bas de la dernière page plutôt qu'à la suite du contenu : le cadre
  // de signature d'un devis se cherche toujours au même endroit.
  const yPied = MARGE + 92;
  trait(ctx, yPied + 22, 0.7, ctx.teintes.traitClair);

  // Mot pour mot la mention du modèle du patron : c'est celle qu'il a déjà
  // envoyée à ses clients, et Atlas ne doit pas en dire autre chose.
  const mention = options.mentionLegale(data);
  enLignes(mention, ctx.sans, 7.8, 290).forEach((l, i) =>
    ecrire(ctx, l, MARGE, yPied - i * 10, { taille: 7.8, couleur: ctx.teintes.legal })
  );

  // Le cadre de signature n'appartient qu'au devis : une facture ne se signe
  // pas, elle se règle. En mettre un inviterait le client à un geste qui n'a
  // aucune valeur, et à croire qu'il lui reste quelque chose à accepter.
  if (options.cadreSignature) {
    const largeurSignature = 180;
    const gaucheSignature = DROITE - largeurSignature;
    ctx.page.drawRectangle({
      x: gaucheSignature,
      y: yPied - 24,
      width: largeurSignature,
      height: 50,
      borderColor: ctx.teintes.traitClair,
      borderWidth: 1,
      borderDashArray: [3, 3],
    });
    ctx.trace.cadres.push({
      x: gaucheSignature,
      y: yPied - 24,
      largeur: largeurSignature,
      hauteur: 50,
      page: ctx.numeroPage,
    });
    const legende = "Bon pour accord — signature du client";
    ecrire(
      ctx,
      legende,
      gaucheSignature + (largeurSignature - ctx.sans.widthOfTextAtSize(legende, 7.8)) / 2,
      yPied - 38,
      { taille: 7.8, couleur: ctx.teintes.etiquette }
    );
  }

  // ─── Pagination, seulement s'il y a plusieurs pages ──────────────────────
  // Le modèle n'en porte pas — il tient sur un écran. Un devis papier de deux
  // feuilles, lui, peut en perdre une sans que personne ne s'en aperçoive.
  if (ctx.trace.pages > 1) {
    const pages = ctx.pdfDoc.getPages();
    pages.forEach((page, i) => {
      const numero = `Page ${i + 1} / ${pages.length}`;
      const largeurNumero = ctx.sans.widthOfTextAtSize(numero, 7.5);
      page.drawText(numero, {
        x: (LARGEUR - largeurNumero) / 2,
        y: MARGE,
        size: 7.5,
        font: ctx.sans,
        color: ctx.teintes.legal,
      });
      ctx.trace.textes.push({
        contenu: numero,
        x: (LARGEUR - largeurNumero) / 2,
        y: MARGE,
        taille: 7.5,
        page: i + 1,
        couleur: PALETTE.legal,
      });
    });
  }

  return { pdf: await pdfDoc.save(), trace: ctx.trace };
}

/** Le bas réservé au pied de page, pour que les contrôles parlent des mêmes chiffres. */
export const PIED_DOCUMENT = { plancher: PLANCHER, marge: MARGE, hauteurPage: HAUTEUR };

/** La palette des pièces, exposée pour qu'un contrôle la constate. */
export const PALETTE_DOCUMENT = PALETTE;
