import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb, RGB } from "pdf-lib";
import Decimal from "decimal.js";
import { couleursDocument } from "@/lib/design-tokens";

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

const ENCRE = couleurHexa(PALETTE.encre);
const ETIQUETTE = couleurHexa(PALETTE.etiquette);
const TITRE_PARTIE = couleurHexa(PALETTE.titrePartie);
const COORDONNEES = couleurHexa(PALETTE.coordonnees);
const TRAIT_CLAIR = couleurHexa(PALETTE.traitClair);
const LEGAL = couleurHexa(PALETTE.legal);
const PAPIER = couleurHexa(PALETTE.papier);

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
};

type Contexte = {
  pdfDoc: PDFDocument;
  page: PDFPage;
  numeroPage: number;
  sans: PDFFont;
  sansGras: PDFFont;
  serif: PDFFont;
  serifGras: PDFFont;
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
    color: style.couleur ?? ENCRE,
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
    couleur: enHexa(style.couleur ?? ENCRE),
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
    couleur: enHexa(style.couleur ?? ENCRE),
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
  ctx.page.drawRectangle({ x: 0, y: 0, width: LARGEUR, height: HAUTEUR, color: PAPIER });
  ctx.trace.fonds.push({ page: ctx.numeroPage, couleur: PALETTE.papier });
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
};

export type DonneesDocument = {
  entrepriseNom: string;
  entrepriseAdresse?: string | null;
  entrepriseSiret?: string | null;
  entrepriseTelephone?: string | null;
  entrepriseEmail?: string | null;
  entrepriseIban?: string | null;
  clientNom?: string | null;
  clientAdresse?: string | null;
  clientTelephone?: string | null;
  adresseChantier?: string | null;
  conditionsPaiement?: string | null;
  devise: string;
  tauxTva: string;
  totalHt: string;
  totalTva: string;
  totalTtc: string;
  lignes: LigneDocument[];
};

export type OptionsDocument = {
  /** « DEVIS », « FACTURE », ou leur variante brouillon. */
  titre: string;
  /** Le bloc de références en haut à droite : libellé et valeur. */
  references: [string, string][];
  /** Intertitre du bloc de notes — le devis y met aussi ses conditions. */
  titreNotes: string;
  /** Mention légale du pied. Elle diffère du tout au tout entre les deux pièces. */
  mentionLegale: (data: DonneesDocument) => string;
  /** Le devis se signe, la facture se règle. */
  cadreSignature: boolean;
  /** Sur une facture, le rappel du devis d'origine. */
  rappel?: string | null;
};


export async function composerDocument(
  data: DonneesDocument,
  options: OptionsDocument
): Promise<{ pdf: Uint8Array; trace: TraceDocument }> {
  const pdfDoc = await PDFDocument.create();
  const ctx: Contexte = {
    pdfDoc,
    page: pdfDoc.addPage([LARGEUR, HAUTEUR]),
    numeroPage: 1,
    sans: await pdfDoc.embedFont(StandardFonts.Helvetica),
    sansGras: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
    serif: await pdfDoc.embedFont(StandardFonts.TimesRoman),
    serifGras: await pdfDoc.embedFont(StandardFonts.TimesRomanBold),
    trace: { pages: 1, textes: [], traits: [], cadres: [], fonds: [] },
  };
  poserPapier(ctx);

  let y = HAUTEUR - MARGE - 22;

  /** Descend de `hauteur`, en changeant de page si le pied est atteint. */
  const place = (hauteur: number): void => {
    if (y - hauteur < PLANCHER) y = pageSuivante(ctx);
  };

  // ─── En-tête : l'entreprise à gauche, les références à droite ───────────
  ecrire(ctx, data.entrepriseNom, MARGE, y, { taille: 22, police: ctx.sans });

  const coordonnees = [
    data.entrepriseAdresse,
    [data.entrepriseTelephone, data.entrepriseEmail].filter(Boolean).join(" — ") || null,
    data.entrepriseSiret ? `SIRET ${data.entrepriseSiret}` : null,
  ].filter((l): l is string => !!l);

  let yCoord = y - 15;
  for (const ligne of coordonnees) {
    ecrire(ctx, ligne, MARGE, yCoord, { taille: 8.5, couleur: COORDONNEES });
    yCoord -= 11;
  }

  const references = options.references;
  let yRef = y;
  for (const [libelle, valeur] of references) {
    ecrire(ctx, libelle, DROITE - 175, yRef, { taille: 8.5, police: ctx.sansGras, couleur: ETIQUETTE });
    ecrireADroite(ctx, valeur, DROITE, yRef, { taille: 9 });
    trait(ctx, yRef - 4, 0.5, TRAIT_CLAIR, DROITE - 105, DROITE);
    yRef -= 17;
  }

  y = Math.min(yCoord, yRef) - 8;
  trait(ctx, y, 1.6, ENCRE);
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
    ecrire(ctx, options.rappel, MARGE, y, { taille: 8.5, couleur: ETIQUETTE });
    y -= 20;
  }

  // ─── Émetteur et client, côte à côte ────────────────────────────────────
  const colonneDroite = MARGE + (DROITE - MARGE) / 2 + 10;
  const largeurColonne = (DROITE - MARGE) / 2 - 10;

  // Ces deux-là sont des `h3` dans le modèle : ils héritent donc de Playfair,
  // là où les en-têtes de colonnes et les intertitres restent en Inter.
  const etiquettePartie: Style = { taille: 8.5, police: ctx.serif, couleur: TITRE_PARTIE };
  ecrireEspace(ctx, "ÉMETTEUR", MARGE, y, APPROCHE_ETIQUETTE, etiquettePartie);
  ecrireEspace(ctx, "CLIENT", colonneDroite, y, APPROCHE_ETIQUETTE, etiquettePartie);
  y -= 15;

  const emetteur = [
    data.entrepriseNom,
    data.entrepriseAdresse,
    data.entrepriseSiret ? `SIRET ${data.entrepriseSiret}` : null,
  ]
    .filter((l): l is string => !!l)
    .flatMap((l) => enLignes(l, ctx.sans, 9, largeurColonne));

  const client = [
    data.clientNom,
    data.clientAdresse,
    data.clientTelephone,
    data.adresseChantier ? `Chantier : ${data.adresseChantier}` : null,
  ]
    .filter((l): l is string => !!l)
    .flatMap((l) => enLignes(l, ctx.sans, 9, largeurColonne));

  emetteur.forEach((l, i) => ecrire(ctx, l, MARGE, y - i * 12, { taille: 9 }));
  client.forEach((l, i) => ecrire(ctx, l, colonneDroite, y - i * 12, { taille: 9 }));
  y -= Math.max(emetteur.length, client.length) * 12 + 22;

  // ─── Tableau des lignes ─────────────────────────────────────────────────
  const xQte = DROITE - 240;
  const xPrix = DROITE - 140;
  const xMontant = DROITE;

  const enTeteColonne: Style = { taille: 7.5, police: ctx.sansGras, couleur: ETIQUETTE };
  const enTeteTableau = () => {
    ecrireEspace(ctx, "DESCRIPTION", MARGE, y, APPROCHE_ETIQUETTE, enTeteColonne);
    ecrireEspaceADroite(ctx, "QTÉ", xQte, y, APPROCHE_ETIQUETTE, enTeteColonne);
    ecrireEspaceADroite(ctx, "PRIX UNITAIRE HT", xPrix, y, APPROCHE_ETIQUETTE, enTeteColonne);
    ecrireEspaceADroite(ctx, "TOTAL HT", xMontant, y, APPROCHE_ETIQUETTE, enTeteColonne);
    y -= 9;
    trait(ctx, y, 1.2, ENCRE);
    y -= 17;
  };
  enTeteTableau();

  if (data.lignes.length === 0) {
    // Un tableau vide sans un mot laisse croire à un document tronqué.
    ecrire(ctx, "Aucune ligne pour l'instant.", MARGE, y, { taille: 9, couleur: ETIQUETTE });
    y -= 14;
    trait(ctx, y, 0.7, TRAIT_CLAIR);
    y -= 12;
  }

  for (const ligne of data.lignes) {
    const lignesLibelle = enLignes(ligne.libelle, ctx.sans, 9, xQte - MARGE - 50);
    const hauteurLigne = Math.max(lignesLibelle.length, 1) * 11 + 19;
    // Une ligne ne se coupe jamais en deux : elle passe entière à la page
    // suivante, en-tête de colonnes redessiné pour qu'on sache encore ce
    // qu'on lit.
    if (y - hauteurLigne < PLANCHER) {
      y = pageSuivante(ctx);
      enTeteTableau();
    }
    lignesLibelle.forEach((l, i) => ecrire(ctx, l, MARGE, y - i * 11, { taille: 9 }));
    ecrireADroite(ctx, ligne.quantite, xQte, y, { taille: 9 });
    ecrireADroite(ctx, formatMontant(ligne.prixUnitaire, data.devise), xPrix, y, { taille: 9 });
    ecrireADroite(ctx, formatMontant(ligne.montant, data.devise), xMontant, y, {
      taille: 9,
      police: ctx.sansGras,
    });
    y -= Math.max(lignesLibelle.length, 1) * 11 + 7;
    trait(ctx, y, 0.7, TRAIT_CLAIR);
    y -= 12;
  }

  // ─── Totaux, calés à droite ─────────────────────────────────────────────
  // Le bloc entier tient sur une seule page : un « Total TTC » séparé de son
  // « Total HT » par un saut de page se lit de travers.
  place(74);
  y -= 6;
  const gaucheTotaux = DROITE - 220;

  ecrire(ctx, "Total HT", gaucheTotaux, y, { taille: 9.5 });
  ecrireADroite(ctx, formatMontant(data.totalHt, data.devise), DROITE, y, { taille: 9.5 });
  y -= 16;

  const tauxLisible = new Decimal(data.tauxTva).toFixed(2).replace(/[.]00$/, "").replace(".", ",");
  ecrire(ctx, `TVA (${tauxLisible} %)`, gaucheTotaux, y, { taille: 9.5 });
  ecrireADroite(ctx, formatMontant(data.totalTva, data.devise), DROITE, y, { taille: 9.5 });
  y -= 14;

  trait(ctx, y, 1.6, ENCRE, gaucheTotaux, DROITE);
  y -= 22;

  ecrire(ctx, "Total TTC", gaucheTotaux, y, { taille: 14, police: ctx.serifGras });
  ecrireADroite(ctx, formatMontant(data.totalTtc, data.devise), DROITE, y, {
    taille: 14,
    police: ctx.serifGras,
  });
  y -= 34;

  // ─── Conditions et modalités de paiement ────────────────────────────────
  const etiquetteBloc: Style = { taille: 7.5, police: ctx.sansGras, couleur: ETIQUETTE };

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

  if (data.entrepriseIban) {
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
  trait(ctx, yPied + 22, 0.7, TRAIT_CLAIR);

  // Mot pour mot la mention du modèle du patron : c'est celle qu'il a déjà
  // envoyée à ses clients, et Atlas ne doit pas en dire autre chose.
  const mention = options.mentionLegale(data);
  enLignes(mention, ctx.sans, 7.8, 290).forEach((l, i) =>
    ecrire(ctx, l, MARGE, yPied - i * 10, { taille: 7.8, couleur: LEGAL })
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
      borderColor: TRAIT_CLAIR,
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
      { taille: 7.8, couleur: ETIQUETTE }
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
        color: LEGAL,
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
