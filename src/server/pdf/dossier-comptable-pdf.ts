import { LineCapStyle, PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage, type PDFEmbeddedPage } from "pdf-lib";
import { charte } from "@/lib/chartes";
import { couleursDocument } from "@/lib/design-tokens";
import { logger } from "../logger";
import { enEuros } from "@/lib/euros";
import { texteDuPapier } from "@/lib/texte-pdf";
import { NOM_CATEGORIE, ORDRE_CATEGORIES } from "@/lib/couleurs-comptable";
import { ligneDuTotal, type LigneImprimee } from "@/lib/ticket-imprime";
import {
  libelleMotif,
  libellePeriode,
  jourComplet,
  jourEnMots,
  suiteDeLaPiece,
  type Categorie,
  type Ecart,
  type Motif,
} from "@/lib/pour-mon-comptable";

/**
 * LE DOSSIER DU COMPTABLE, EN PDF — lot 3 de « Pour mon comptable ».
 *
 * Ses choix du 24 octobre 2026 (`TODO.md`) : **côte à côte**, la ligne de
 * banque à gauche et sa pièce réécrite à droite, le total de la pièce
 * surligné en bleu gris ; « Voir la photo » vers les vraies photos rangées
 * TOUT AU BOUT, chacune avec « Retour à la ligne » ; les sorties en rouge et
 * les entrées en vert (son choix B).
 *
 * **Sa planche du 26 octobre 2026** (`appli/soignee/comptable-dossier.html`)
 * l'a resserré sans rien changer de tout cela : la première page dit d'abord
 * que tout est justifié, puis les chiffres, les mois et les catégories ;
 * chaque mois commence sa page, sous des colonnes titrées ; la case de la pièce
 * prend la hauteur de son contenu (elle réservait 118 points pour un ticket de
 * trois lignes) ; la date d'une ligne mince ne touche plus le trait du dessus ;
 * les tickets perdus suivent le dernier mois, avec leur total.
 *
 * **Les liens visent une PAGE, jamais un nom** : les lecteurs de téléphone
 * suivent mal les destinations nommées (sa remarque du 23 octobre, « ça marche
 * pas »).
 *
 * **Ce qui n'y est pas, et ne s'invente pas** : le solde de la banque au début
 * et à la fin de chaque mois. La lecture d'Enable Banking ne le rapporte pas
 * encore (`TODO.md`). Le dossier donne les totaux du mois, qui se lisent sur
 * les lignes.
 */

export type PieceDeLaLigne =
  | {
      genre: "ticket";
      fournisseur: string;
      date: string;
      totalTtc: string | null;
      tva: string | null;
      photo: Fichier | null;
      /** Le ticket recopié ligne par ligne (lot 5), ou `null` pour un ticket d'avant : il garde alors son résumé. */
      lignes: LigneImprimee[] | null;
    }
  | { genre: "facture"; societe: string; nom: string; totalTtc: string | null; fichier: Fichier | null }
  | { genre: "facture-emise"; numero: string }
  /** Un virement reçu qui paie une facture faite hors d'Atlas (migration 0148) : son total lu, ou tapé, et son fichier. */
  | { genre: "facture-hors-atlas"; totalTtc: string | null; fichier: Fichier | null };

export type Fichier = { octets: Uint8Array; nature: "image" | "pdf" };

export type LignePourLeDossier = {
  jour: string;
  libelle: string;
  sens: "entree" | "sortie";
  montant: string;
  categorie: Categorie;
  piece: PieceDeLaLigne | null;
  ticketPerdu: boolean;
  motif: Motif | null;
  /**
   * Le montant de la pièce contre celui de la ligne, lu par le dépôt
   * (`ecartDeMontant`). Une pièce jointe malgré l'écart le porte : le
   * comptable doit le voir, écrit sous elle par `suiteDeLaPiece`.
   */
  ecart: Ecart;
};

export type DonneesDossier = {
  entreprise: { nom: string; siret: string | null; adresse: string | null };
  banque: string | null;
  du: string;
  au: string;
  rangeLe: string;
  gardeJusquAu: string;
  lignes: LignePourLeDossier[];
};

const LARGEUR = 595.28;
const HAUTEUR = 841.89;
const MARGE = 42;
/** Le haut et le bas du contenu, ceux de la planche ; le pied de page vit dessous. */
const HAUT = HAUTEUR - 40;
const BAS = 50;
const UTILE = LARGEUR - 2 * MARGE;
const ORIGINE = charte("origine").jetons;

// Les quatre colonnes d'un mois, celles de la planche : Date, Ligne de banque,
// Montant, Justificatif. La date a six points de plus que sur la planche :
// « 22 septembre » s'y écrit en entier.
const X_LIBELLE = MARGE + 58 + 10;
const L_PIECE = 186;
const X_PIECE = LARGEUR - MARGE - L_PIECE;
/** Le bord droit des montants. */
const X_MONTANT = X_PIECE - 12;
const L_LIBELLE = X_MONTANT - 72 - 10 - X_LIBELLE;
/** La première rangée d'une page de mois, sous les titres des colonnes. */
const Y_RANGEES = HAUT - 61;
/** Le bas des rangées : sous la dernière, la place de « Suite d'octobre page 12 ». */
const BAS_RANGEES = BAS + 20;

function couleur(hex: string) {
  const n = hex.replace("#", "");
  return rgb(parseInt(n.slice(0, 2), 16) / 255, parseInt(n.slice(2, 4), 16) / 255, parseInt(n.slice(4, 6), 16) / 255);
}
type Teinte = ReturnType<typeof rgb>;

const ENCRE = couleur("#1c1c1a");
const DOUX = couleur("#4a4a44");
const GRIS = couleur("#6b6b5c");
const FILET = couleur("#e4e0d6");
const SEPARATION = couleur("#efece5");
const PAPIER = couleur("#f3f1eb");
const FOND_PIECE = couleur("#faf9f5");
const CLICHE = couleur("#d8d4cb");
const LIEN = couleur("#8b6835");
const ATTESTE_FOND = couleur(ORIGINE.carteVertFond);
const ATTESTE = couleur("#2f4a26");
const ECART = couleur(ORIGINE.carteAmbreTexte);
const SURLIGNE = couleur(couleursDocument.surligne);
const SORTIE = couleur(ORIGINE.montantSortie);
const ENTREE = couleur(ORIGINE.montantEntree);
const COULEUR_CAT: Record<Categorie, Teinte> = {
  carburant: couleur(ORIGINE.catCarburant),
  repas: couleur(ORIGINE.catRepas),
  materiel: couleur(ORIGINE.catMateriel),
  hotel: couleur(ORIGINE.catHotel),
  transport: couleur(ORIGINE.catTransport),
  autre: couleur(ORIGINE.catAutre),
  virement: couleur(ORIGINE.catVirement),
  recu: couleur(ORIGINE.catRecu),
};

type Polices = { sans: PDFFont; gras: PDFFont; oblique: PDFFont; serif: PDFFont; mono: PDFFont; monoGras: PDFFont };

/**
 * Le texte pour les polices du PDF. Les lettres en exposant de « 1ᵉʳ » n'y
 * existent pas, et `texteDuPapier` les retirerait : « 1 janvier ». Elles
 * s'écrivent donc « 1er », comme sur un document imprimé.
 */
function papier(texte: string): string {
  return texteDuPapier(texte.replace(/ᵉʳ/g, "er").replace(/ᵉ/g, "e"));
}

/** Le texte, ramené à ce que les polices du PDF savent écrire, et coupé à la largeur. */
function ajuste(texte: string, police: PDFFont, taille: number, largeur: number): string {
  let t = papier(texte);
  if (police.widthOfTextAtSize(t, taille) <= largeur) return t;
  while (t.length > 1 && police.widthOfTextAtSize(`${t}...`, taille) > largeur) t = t.slice(0, -1);
  return `${t.trimEnd()}...`;
}

function ecrire(page: PDFPage, texte: string, x: number, y: number, police: PDFFont, taille: number, teinte = ENCRE, largeur = LARGEUR - MARGE - x) {
  page.drawText(ajuste(texte, police, taille, largeur), { x, y, size: taille, font: police, color: teinte });
}

function ecrireADroite(page: PDFPage, texte: string, xDroit: number, y: number, police: PDFFont, taille: number, teinte = ENCRE) {
  const t = papier(texte);
  page.drawText(t, { x: xDroit - police.widthOfTextAtSize(t, taille), y, size: taille, font: police, color: teinte });
}

/** Un morceau de phrase dans sa police et sa teinte : « Justifié par sa nature : » puis, en gras, « un loyer ». */
type Bout = { t: string; police: PDFFont; teinte: Teinte };

/**
 * Des bouts de phrase coupés en lignes, au mot près. Une phrase coupée à la
 * largeur d'une colonne perdait sa fin (« TVA non... ») : le comptable doit
 * lire la mention entière. Seul un mot plus large que la colonne se coupe.
 */
function enLignes(bouts: Bout[], taille: number, largeur: number): Bout[][] {
  const lignes: Bout[][] = [];
  let courante: Bout[] = [];
  let place = largeur;
  for (const b of bouts) {
    for (const mot of papier(b.t).split(/(?<= )/)) {
      const plein = b.police.widthOfTextAtSize(mot.trimEnd(), taille);
      if (plein > place && courante.length > 0) {
        lignes.push(courante);
        courante = [];
        place = largeur;
      }
      const debut = courante.length === 0 ? mot.trimStart() : mot;
      const pose = plein > largeur ? ajuste(debut, b.police, taille, largeur) : debut;
      const avant = courante[courante.length - 1];
      if (avant && avant.police === b.police && avant.teinte === b.teinte) avant.t += pose;
      else courante.push({ t: pose, police: b.police, teinte: b.teinte });
      place -= b.police.widthOfTextAtSize(pose, taille);
    }
  }
  if (courante.length > 0) lignes.push(courante);
  return lignes;
}

function poserLignes(page: PDFPage, lignes: Bout[][], x: number, y: number, taille: number, pas: number) {
  lignes.forEach((l, i) => {
    let xx = x;
    for (const b of l) {
      page.drawText(b.t, { x: xx, y: y - i * pas, size: taille, font: b.police, color: b.teinte });
      xx += b.police.widthOfTextAtSize(b.t, taille);
    }
  });
}

/** Des bouts posés sur une ligne, finissant au bord droit. */
function poserADroite(page: PDFPage, bouts: Bout[], xDroit: number, y: number, taille: number) {
  const propres = bouts.map((b) => ({ ...b, t: papier(b.t) }));
  const largeur = propres.reduce((s, b) => s + b.police.widthOfTextAtSize(b.t, taille), 0);
  poserLignes(page, [propres], xDroit - largeur, y, taille, 0);
}

const signe = (l: LignePourLeDossier) => `${l.sens === "entree" ? "+" : "-"}${enEuros(l.montant)}`;
const centimes = (m: string) => Math.round(Number(m) * 100);
const somme = (lignes: LignePourLeDossier[], sens: LignePourLeDossier["sens"]) => lignes.filter((l) => l.sens === sens).reduce((s, l) => s + centimes(l.montant), 0);
const pluriel = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;
/** « impôts, cotisations » : le mot d'un motif au milieu d'une phrase. */
const enMinuscule = (t: string) => `${t.charAt(0).toLocaleLowerCase("fr-FR")}${t.slice(1)}`;

/** « du 1er janvier au 25 octobre » dans une même année ; l'année de chaque bout sinon. */
function entreLesDeux(du: string, au: string, anneeALaFin: boolean): string {
  if (du.slice(0, 4) !== au.slice(0, 4)) return `du ${jourComplet(du)} au ${jourComplet(au)}`;
  return `du ${jourEnMots(du)} au ${anneeALaFin ? jourComplet(au) : jourEnMots(au)}`;
}

/** « d'octobre », « de septembre » : « Suite d'octobre page 12 ». */
function duMois(cle: string): string {
  const nom = libellePeriode(cle).split(" ")[0].toLocaleLowerCase("fr-FR");
  return /^[aeioué]/.test(nom) ? `d'${nom}` : `de ${nom}`;
}

/** Un lien qui mène à une page, posé sur un rectangle d'une autre. */
type Lien = { page: PDFPage; x: number; y: number; l: number; h: number; vers: () => { page: PDFPage; y: number } };

function poserLiens(doc: PDFDocument, liens: Lien[]) {
  for (const k of liens) {
    const cible = k.vers();
    const annotation = doc.context.obj({
      Type: "Annot",
      Subtype: "Link",
      Rect: [k.x, k.y, k.x + k.l, k.y + k.h],
      Border: [0, 0, 0],
      Dest: [cible.page.ref, "XYZ", 0, cible.y, null],
    });
    k.page.node.addAnnot(doc.context.register(annotation));
  }
}

/** Ce que tout le dossier partage pendant qu'il se compose. */
type Composition = {
  doc: PDFDocument;
  p: Polices;
  liens: Lien[];
  /** Ce qui s'écrit une fois toutes les pages connues : les numéros de page. */
  apres: (() => void)[];
};

const numero = (c: Composition, page: PDFPage) => c.doc.getPages().indexOf(page) + 1;
const nouvellePage = (c: Composition) => c.doc.addPage([LARGEUR, HAUTEUR]);

/** Une petite étiquette en capitales, celle des titres de colonnes. */
function etiquette(page: PDFPage, p: Polices, texte: string, x: number, y: number, aDroite = false) {
  if (aDroite) ecrireADroite(page, texte.toUpperCase(), x, y, p.gras, 7.5, GRIS);
  else ecrire(page, texte.toUpperCase(), x, y, p.gras, 7.5, GRIS);
}

/** Le titre d'une page, ce qu'elle porte à droite, et le trait noir dessous. Rend le bas du trait. */
function enTete(page: PDFPage, p: Polices, titre: string, droite: Bout[], yHaut = HAUT): number {
  page.drawText(papier(titre), { x: MARGE, y: yHaut - 18, size: 22, font: p.serif, color: ENCRE });
  if (droite.length > 0) poserADroite(page, droite, LARGEUR - MARGE, yHaut - 18, 10);
  page.drawLine({ start: { x: MARGE, y: yHaut - 32 }, end: { x: LARGEUR - MARGE, y: yHaut - 32 }, thickness: 0.8, color: ENCRE });
  return yHaut - 32;
}

/** La coche de « tout est justifié », et l'appareil photo de « Voir la photo », dessinés à la main. */
function coche(page: PDFPage, x: number, yHaut: number, taille: number, teinte: Teinte) {
  page.drawSvgPath("M5 12.5l4.5 4.5L19 7.5", { x, y: yHaut, scale: taille / 24, borderColor: teinte, borderWidth: 2.2, borderLineCap: LineCapStyle.Round });
}
function appareil(page: PDFPage, x: number, yHaut: number, taille: number, teinte: Teinte) {
  const trace = { x, y: yHaut, scale: taille / 24, borderColor: teinte, borderWidth: 2 };
  page.drawSvgPath("M5.5 6.5h13a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2z", trace);
  page.drawSvgPath("M15.5 13a3.5 3.5 0 1 1-7 0a3.5 3.5 0 1 1 7 0z", trace);
}

// ─── La pièce réécrite ───────────────────────────────────────────────────────

/** L'interligne d'un ticket recopié : 7,6 points à 1,42, celui de la planche. */
const PAS_TICKET = 10.8;
/** Le blanc d'une case autour de sa pièce, en haut et en bas, puis sur les côtés. */
const BLANC_HAUT = 6;
const BLANC_COTE = 8;

/**
 * Une rangée d'une case de pièce. La case se mesure rangée par rangée : elle
 * prend la hauteur de ce qu'elle porte, et un long ticket se coupe entre deux
 * rangées, jamais au milieu d'une.
 */
type Rang =
  | { genre: "centre"; t: string; police: PDFFont; taille: number; h: number }
  | { genre: "titre"; t: string; police: PDFFont; taille: number; teinte: Teinte; h: number }
  | { genre: "deux"; g: string; d: string | null; police: PDFFont; taille: number; h: number; surligne: boolean; retrait: number }
  | { genre: "blanc"; h: number };

/**
 * Les lignes d'un ticket recopié, celle du total surlignée (`ligneDuTotal`).
 * Quand aucune ligne ne tombe juste sur le total, il s'ajoute à part, surligné :
 * jamais une ligne prise au hasard.
 */
function lignesDuTicket(piece: Extract<PieceDeLaLigne, { genre: "ticket" }>): { g: string; d: string | null; surligne: boolean }[] | null {
  if (!piece.lignes || piece.lignes.length === 0) return null;
  const total = ligneDuTotal(piece.lignes, piece.totalTtc ? Number(piece.totalTtc) : null);
  const lignes = piece.lignes.map((l, k) => ({ g: l.gauche, d: l.droite, surligne: k === total }));
  if (total < 0) lignes.push({ g: "TOTAL TTC", d: piece.totalTtc ? enEuros(piece.totalTtc) : "non lu", surligne: true });
  return lignes;
}

/** Ce qu'une case porte, rangée par rangée ; `null` pour une pièce qui se dit d'une phrase. */
function rangsDeLaPiece(piece: PieceDeLaLigne, p: Polices): Rang[] | null {
  const totalTtc = (t: string | null): Rang => ({ genre: "deux", g: "Total TTC", d: t ? enEuros(t) : "non lu", police: p.gras, taille: 8.5, h: 14, surligne: true, retrait: 4 });
  const nom = (t: string): Rang => ({ genre: "titre", t, police: p.serif, taille: 10.5, teinte: ENCRE, h: 12.6 });
  switch (piece.genre) {
    case "ticket": {
      const recopie = lignesDuTicket(piece);
      const rang = (g: string, d: string | null, surligne: boolean): Rang => ({ genre: "deux", g, d, police: surligne ? p.monoGras : p.mono, taille: 7.6, h: PAS_TICKET, surligne, retrait: 2 });
      if (recopie) return recopie.map((l) => rang(l.g, l.d, l.surligne));
      return [
        { genre: "centre", t: piece.fournisseur.toUpperCase(), police: p.monoGras, taille: 7.6, h: PAS_TICKET },
        { genre: "centre", t: jourComplet(piece.date), police: p.mono, taille: 7.6, h: PAS_TICKET },
        { genre: "blanc", h: 3 },
        rang("TOTAL TTC", piece.totalTtc ? enEuros(piece.totalTtc) : "non lu", true),
        ...(piece.tva ? [rang("dont TVA", enEuros(piece.tva), false)] : []),
      ];
    }
    case "facture":
      return [nom(piece.societe), { genre: "titre", t: piece.nom, police: p.sans, taille: 8, teinte: GRIS, h: 10.6 }, { genre: "blanc", h: 5 }, totalTtc(piece.totalTtc)];
    case "facture-hors-atlas":
      return [nom("Facture faite hors d'Atlas"), { genre: "blanc", h: 5 }, totalTtc(piece.totalTtc)];
    case "facture-emise":
      return null;
  }
}

const hauteurDesRangs = (rangs: readonly Rang[]) => rangs.reduce((s, r) => s + r.h, 0);
const hauteurDeCase = (rangs: readonly Rang[]) => 2 * BLANC_HAUT + hauteurDesRangs(rangs);

/** Un morceau de case, dans son cadre. Rend sa hauteur. */
function dessinerCase(page: PDFPage, rangs: readonly Rang[], yHaut: number): number {
  const h = hauteurDeCase(rangs);
  page.drawRectangle({ x: X_PIECE, y: yHaut - h, width: L_PIECE, height: h, color: FOND_PIECE, borderColor: FILET, borderWidth: 0.6 });
  const gauche = X_PIECE + BLANC_COTE;
  const droite = X_PIECE + L_PIECE - BLANC_COTE;
  let y = yHaut - BLANC_HAUT;
  for (const r of rangs) {
    if (r.genre !== "blanc") {
      const base = y - (r.h + 0.7 * r.taille) / 2;
      if (r.genre === "centre") {
        const t = ajuste(r.t, r.police, r.taille, droite - gauche);
        page.drawText(t, { x: X_PIECE + (L_PIECE - r.police.widthOfTextAtSize(t, r.taille)) / 2, y: base, size: r.taille, font: r.police, color: ENCRE });
      } else if (r.genre === "titre") {
        ecrire(page, r.t, gauche, base, r.police, r.taille, r.teinte, droite - gauche);
      } else {
        if (r.surligne) page.drawRectangle({ x: gauche, y: y - r.h, width: droite - gauche, height: r.h, color: SURLIGNE });
        const d = r.d ? papier(r.d) : "";
        const place = droite - gauche - 2 * r.retrait - (d ? r.police.widthOfTextAtSize(d, r.taille) + 6 : 0);
        if (r.g) ecrire(page, r.g, gauche + r.retrait, base, r.police, r.taille, ENCRE, place);
        if (d) ecrireADroite(page, d, droite - r.retrait, base, r.police, r.taille);
      }
    }
    y -= r.h;
  }
  return h;
}

// ─── Une ligne de banque, et ce qui la justifie ──────────────────────────────

/** Le nom de la pièce, que suit son écart : « Facture Motoculture Ouest de 1 386,40 €, pas le montant ». */
function nomDeLaPiece(piece: PieceDeLaLigne): string {
  switch (piece.genre) {
    case "ticket":
      return `Ticket ${piece.fournisseur}`;
    case "facture":
      return `Facture ${piece.societe}`;
    case "facture-hors-atlas":
      return "Facture faite hors d'Atlas";
    case "facture-emise":
      return `Facture ${piece.numero}`;
  }
}

/** Le fichier d'une pièce, posé au bout ; une facture prend une page, un ticket un sixième. */
function fichierDe(l: LignePourLeDossier): { fichier: Fichier; pleinePage: boolean } | null {
  const piece = l.piece;
  if (piece?.genre === "ticket") return piece.photo ? { fichier: piece.photo, pleinePage: false } : null;
  if (piece?.genre === "facture" || piece?.genre === "facture-hors-atlas") return piece.fichier ? { fichier: piece.fichier, pleinePage: true } : null;
  return null;
}

/** Une ligne, mesurée avant d'être posée : on sait ainsi si elle tient sur la page. */
type Plan = {
  l: LignePourLeDossier;
  libelle: Bout[][];
  /** La case de la pièce, ou la phrase qui la remplace (une facture d'Atlas, un motif, un ticket perdu). */
  rangs: Rang[] | null;
  phrase: Bout[][];
  /** Sous la case : son écart, puis « Voir la photo » ou « Voir la facture ». */
  ecart: Bout[][];
  voir: string | null;
};

function planifier(l: LignePourLeDossier, p: Polices): Plan {
  // Le libellé de la banque tient sur trois lignes ; au-delà, la troisième dit
  // qu'il continue (« ... ») plutôt que de le couper sans un signe.
  const coupe = enLignes([{ t: l.libelle, police: p.gras, teinte: ENCRE }], 9.5, L_LIBELLE);
  const libelle = coupe.length <= 3 ? coupe : [...coupe.slice(0, 2), [{ t: ajuste(coupe.slice(2).map((x) => x.map((b) => b.t).join("")).join(" "), p.gras, 9.5, L_LIBELLE), police: p.gras, teinte: ENCRE }]];
  const suite = suiteDeLaPiece(l.ecart, l.sens);
  const rangs = l.piece ? rangsDeLaPiece(l.piece, p) : null;
  let phrase: Bout[] = [];
  if (l.piece?.genre === "facture-emise") {
    phrase = [
      { t: nomDeLaPiece(l.piece), police: p.gras, teinte: ENCRE },
      ...(suite ? [{ t: suite, police: p.gras, teinte: ECART }] : []),
      { t: ", émise par Atlas", police: p.sans, teinte: DOUX },
    ];
  } else if (!l.piece && l.ticketPerdu) {
    phrase = [{ t: "Ticket perdu, mention validée. TVA non déduite.", police: p.oblique, teinte: SORTIE }];
  } else if (!l.piece && l.motif) {
    phrase = [
      { t: "Justifié par sa nature : ", police: p.sans, teinte: DOUX },
      { t: enMinuscule(libelleMotif(l.motif, l.sens)), police: p.gras, teinte: ENCRE },
    ];
  } else if (!l.piece) {
    phrase = [{ t: "Aucune pièce", police: p.sans, teinte: GRIS }];
  }
  const fichier = fichierDe(l);
  return {
    l,
    libelle,
    rangs,
    phrase: enLignes(phrase, 9, L_PIECE),
    ecart: rangs && suite && l.piece ? enLignes([{ t: `${nomDeLaPiece(l.piece)}${suite}`, police: p.gras, teinte: ECART }], 8, L_PIECE) : [],
    voir: fichier ? (fichier.pleinePage ? "Voir la facture" : "Voir la photo") : null,
  };
}

const hauteurGauche = (pl: Plan) => 34 + 12 * (pl.libelle.length - 1);
const hauteurDessous = (pl: Plan) => (pl.ecart.length > 0 ? 4 + 10 * pl.ecart.length : 0) + (pl.voir ? 16 : 0);
const hauteurDroite = (pl: Plan) => (pl.rangs ? 8 + hauteurDeCase(pl.rangs) + hauteurDessous(pl) : 20 + 12 * (pl.phrase.length - 1));
const hauteurDeLaLigne = (pl: Plan) => Math.max(hauteurGauche(pl), hauteurDroite(pl)) + 8;

/** Une page de mois qui se remplit, et ce qu'on sait d'elle. */
type PageDuReleve = { page: PDFPage; y: number; suite: boolean; lignes: number };

function pageDuReleve(c: Composition, m: string, suite: boolean, bilan: Bout[]): PageDuReleve {
  const page = nouvellePage(c);
  enTete(page, c.p, suite ? `${libellePeriode(m)}, suite` : libellePeriode(m), bilan);
  const y = HAUT - 50;
  etiquette(page, c.p, "Date", MARGE, y);
  etiquette(page, c.p, "Ligne de banque", X_LIBELLE, y);
  etiquette(page, c.p, "Montant", X_MONTANT, y, true);
  etiquette(page, c.p, "Justificatif", X_PIECE, y);
  page.drawLine({ start: { x: MARGE, y: HAUT - 60 }, end: { x: LARGEUR - MARGE, y: HAUT - 60 }, thickness: 0.8, color: ENCRE });
  return { page, y: Y_RANGEES, suite, lignes: 0 };
}

/** La page d'un mois se ferme : une page de suite dit combien de lignes elle porte. */
function fermer(c: Composition, pg: PageDuReleve) {
  if (pg.suite) poserADroite(pg.page, [{ t: pluriel(pg.lignes, "ligne", "lignes"), police: c.p.sans, teinte: ENCRE }], LARGEUR - MARGE, HAUT - 18, 10);
}

type Liaisons = {
  /** Là où mène « Retour à la ligne » : la page où se trouve « Voir la photo ». */
  retour: Map<LignePourLeDossier, { page: PDFPage; y: number }>;
  /** Là où mène « Voir la photo » : la photo, tout au bout. */
  photo: Map<LignePourLeDossier, { page: PDFPage; y: number }>;
};

/**
 * Un mois du relevé, la ligne la plus récente en haut. **Il commence toujours
 * sa page** (la planche du 26 octobre) : un mois se retrouve d'un coup d'œil,
 * au prix d'un blanc en bas de la page d'avant. Rend sa première page, que le
 * sommaire vise, et la dernière avec la place qui y reste, pour les tickets
 * perdus qui suivent.
 */
function moisDuReleve(c: Composition, m: string, lignes: LignePourLeDossier[], liaisons: Liaisons): { premiere: PDFPage; derniere: PageDuReleve } {
  const { p } = c;
  const bilan: Bout[] = [
    { t: "Sorties ", police: p.sans, teinte: ENCRE },
    { t: `-${enEuros(somme(lignes, "sortie") / 100)}`, police: p.gras, teinte: SORTIE },
    { t: "     Entrées ", police: p.sans, teinte: ENCRE },
    { t: `+${enEuros(somme(lignes, "entree") / 100)}`, police: p.gras, teinte: ENTREE },
    { t: `     ${pluriel(lignes.length, "ligne", "lignes")}`, police: p.sans, teinte: ENCRE },
  ];
  let pg = pageDuReleve(c, m, false, bilan);
  const premiere = pg.page;
  const changer = () => {
    const suivante = pageDuReleve(c, m, true, []);
    ecrireADroite(pg.page, `Suite ${duMois(m)} page ${numero(c, suivante.page)}`, LARGEUR - MARGE, pg.y - 14, p.sans, 8.5, GRIS);
    fermer(c, pg);
    pg = suivante;
  };
  for (const l of [...lignes].sort((a, b) => b.jour.localeCompare(a.jour))) {
    const plan = planifier(l, p);
    // Une ligne qui ne tient pas passe à la page suivante, entière. Seul un
    // long ticket recopié commence là où il reste une vraie place, et continue
    // ensuite : il n'est jamais réduit à un résumé.
    const tient = pg.y - hauteurDeLaLigne(plan) >= BAS_RANGEES;
    const commenceIci = (plan.rangs?.length ?? 0) > 1 && pg.y - BAS_RANGEES >= 220;
    if (!tient && !commenceIci && pg.lignes > 0) changer();
    poserLaLigne(c, plan, () => pg, changer, liaisons);
  }
  return { premiere, derniere: pg };
}

/** La ligne de banque à gauche, sa pièce à droite. */
function poserLaLigne(c: Composition, plan: Plan, courante: () => PageDuReleve, changer: () => void, liaisons: Liaisons) {
  const { p } = c;
  const { l } = plan;
  let pg = courante();
  let haut = pg.y;
  // La première ligne de base descend de seize points sous le trait du dessus :
  // la date d'un virement ne le touche plus.
  const yL = haut - 16;
  ecrire(pg.page, jourEnMots(l.jour), MARGE, yL, p.sans, 8.5, DOUX, 58);
  poserLignes(pg.page, plan.libelle, X_LIBELLE, yL, 9.5, 12);
  const yCat = yL - 12 * (plan.libelle.length - 1) - 14;
  pg.page.drawCircle({ x: X_LIBELLE + 3, y: yCat + 2.8, size: 3, color: COULEUR_CAT[l.categorie] });
  ecrire(pg.page, NOM_CATEGORIE[l.categorie], X_LIBELLE + 10, yCat, p.sans, 8.5, DOUX, L_LIBELLE - 10);
  ecrireADroite(pg.page, signe(l), X_MONTANT, yL, p.serif, 11.5, l.sens === "entree" ? ENTREE : SORTIE);
  pg.lignes += 1;
  let bas = haut - hauteurGauche(plan);

  if (!plan.rangs) {
    poserLignes(pg.page, plan.phrase, X_PIECE, yL, 9, 12);
    bas = Math.min(bas, haut - hauteurDroite(plan));
  } else {
    let reste = plan.rangs;
    let yCase = haut - 8;
    for (;;) {
      const libre = yCase - BAS_RANGEES - 8 - 2 * BLANC_HAUT;
      let n = 0;
      while (n < reste.length && hauteurDesRangs(reste.slice(0, n + 1)) <= libre) n += 1;
      // Le dernier morceau garde sous lui l'écart et « Voir la photo ».
      if (n === reste.length && hauteurDesRangs(reste) + hauteurDessous(plan) > libre && n > 1) n -= 1;
      n = Math.max(1, n);
      yCase -= dessinerCase(pg.page, reste.slice(0, n), yCase);
      reste = reste.slice(n);
      if (reste.length === 0) break;
      // « Suite d'octobre page 12 » s'écrit sous ce qui est déjà posé.
      pg.y = Math.min(bas, yCase) - 8;
      changer();
      pg = courante();
      haut = pg.y;
      ecrire(pg.page, l.libelle, X_LIBELLE, haut - 16, p.gras, 9.5, ENCRE, L_LIBELLE);
      ecrire(pg.page, `Suite du ticket du ${jourComplet(l.jour)}`, X_LIBELLE, haut - 30, p.sans, 8.5, DOUX, L_LIBELLE);
      pg.lignes += 1;
      bas = haut - 34;
      yCase = haut - 8;
    }
    if (plan.ecart.length > 0) {
      poserLignes(pg.page, plan.ecart, X_PIECE, yCase - 11, 8, 10);
      yCase -= 4 + 10 * plan.ecart.length;
    }
    if (plan.voir) {
      const yb = yCase - 16;
      appareil(pg.page, X_PIECE, yb + 12, 9, LIEN);
      ecrire(pg.page, plan.voir, X_PIECE + 13, yb + 4, p.gras, 8, LIEN, L_PIECE - 13);
      const page = pg.page;
      c.liens.push({ page, x: X_PIECE, y: yb, l: L_PIECE, h: 14, vers: () => liaisons.photo.get(l)! });
      liaisons.retour.set(l, { page, y: haut + 4 });
      yCase = yb;
    }
    bas = Math.min(bas, yCase);
  }
  bas -= 8;
  pg.page.drawLine({ start: { x: MARGE, y: bas }, end: { x: LARGEUR - MARGE, y: bas }, thickness: 0.6, color: SEPARATION });
  pg.y = bas;
}

// ─── La première page ────────────────────────────────────────────────────────

/** Une page qui se remplit de haut en bas, et en ouvre une autre quand elle est pleine. */
type Flux = { page: PDFPage; y: number };

function couverture(c: Composition, d: DonneesDossier, mois: string[], pageDuMois: Map<string, PDFPage>, pageDesPerdus: () => PDFPage | null) {
  const { p } = c;
  const page = nouvellePage(c);
  ecrire(page, "POUR MON COMPTABLE", MARGE, HAUTEUR - 52, p.gras, 7.5, GRIS);
  page.drawText(papier("Dossier justifié"), { x: MARGE, y: HAUTEUR - 99, size: 30, font: p.serif, color: ENCRE });
  ecrire(page, `Du ${jourComplet(d.du)} au ${jourComplet(d.au)}`, MARGE, HAUTEUR - 124, p.serif, 15, DOUX);
  page.drawLine({ start: { x: MARGE, y: HAUTEUR - 143 }, end: { x: LARGEUR - MARGE, y: HAUTEUR - 143 }, thickness: 0.6, color: FILET });

  // Qui, quel relevé, quand : trois colonnes, celle de l'entreprise plus large.
  const l1 = (UTILE - 28) * (1.2 / 3.2);
  const l2 = (UTILE - 28) / 3.2;
  const colonnes: [string, Bout[][], number][] = [
    [
      "Entreprise",
      [
        ...enLignes([{ t: d.entreprise.nom, police: p.gras, teinte: ENCRE }], 9.5, l1),
        ...(d.entreprise.adresse ? enLignes([{ t: d.entreprise.adresse, police: p.sans, teinte: ENCRE }], 9.5, l1) : []),
        ...(d.entreprise.siret ? enLignes([{ t: `SIRET ${d.entreprise.siret}`, police: p.sans, teinte: ENCRE }], 9.5, l1) : []),
      ],
      MARGE,
    ],
    [
      "Relevé lu",
      (d.banque ? [`${d.banque},`, "par Enable Banking"] : ["Relevé tenu à la main"]).flatMap((t) => enLignes([{ t, police: p.sans, teinte: ENCRE }], 9.5, l2)),
      MARGE + l1 + 14,
    ],
    [
      "Rangé",
      [`le ${jourComplet(d.rangeLe)},`, `gardé jusqu'au ${jourComplet(d.gardeJusquAu)}`].flatMap((t) => enLignes([{ t, police: p.sans, teinte: ENCRE }], 9.5, l2)),
      MARGE + l1 + l2 + 28,
    ],
  ];
  let y = HAUTEUR - 162;
  let basDesColonnes = y;
  for (const [titre, lignes, x] of colonnes) {
    etiquette(page, p, titre, x, y);
    poserLignes(page, lignes, x, y - 16, 9.5, 13.8);
    basDesColonnes = Math.min(basDesColonnes, y - 16 - 13.8 * (lignes.length - 1));
  }

  // Ce que le comptable vient vérifier, d'abord.
  y = Math.min(basDesColonnes - 20, HAUTEUR - 223);
  page.drawRectangle({ x: MARGE, y: y - 34, width: UTILE, height: 34, color: ATTESTE_FOND });
  coche(page, MARGE + 12, y - 9, 16, ATTESTE);
  ecrire(page, "Chaque ligne de la banque a son justificatif, ou sa mention de ticket perdu.", MARGE + 40, y - 21, p.gras, 11, ATTESTE, UTILE - 52);
  y -= 44;

  // Les quatre chiffres.
  const sorties = somme(d.lignes, "sortie");
  const perdus = d.lignes.filter((l) => l.ticketPerdu);
  const quatre: [string, string, Teinte][] = [
    ["Sorties", `-${enEuros(sorties / 100)}`, SORTIE],
    ["Entrées", `+${enEuros(somme(d.lignes, "entree") / 100)}`, ENTREE],
    ["Lignes de banque", String(d.lignes.length), ENCRE],
    ["Tickets perdus", String(perdus.length), ENCRE],
  ];
  const lc = UTILE / 4;
  page.drawLine({ start: { x: MARGE, y }, end: { x: LARGEUR - MARGE, y }, thickness: 0.6, color: FILET });
  page.drawLine({ start: { x: MARGE, y: y - 50 }, end: { x: LARGEUR - MARGE, y: y - 50 }, thickness: 0.6, color: FILET });
  quatre.forEach(([t, v, teinte], i) => {
    const x = MARGE + i * lc + (i > 0 ? 12 : 0);
    if (i > 0) page.drawLine({ start: { x: MARGE + i * lc, y }, end: { x: MARGE + i * lc, y: y - 50 }, thickness: 0.6, color: FILET });
    etiquette(page, p, t, x, y - 16);
    ecrire(page, v, x, y - 37, p.serif, 16, teinte, lc - 16);
  });
  y -= 50;

  // Ce que contient le dossier. La page des tickets perdus n'est connue qu'au
  // bout : la phrase se mesure avec le plus long numéro, et s'écrit à la fin.
  const n = (genres: PieceDeLaLigne["genre"][]) => d.lignes.filter((l) => l.piece && genres.includes(l.piece.genre)).length;
  const contient = (pagePerdus: number | null) =>
    [
      n(["ticket"]) && pluriel(n(["ticket"]), "ticket", "tickets"),
      n(["facture"]) && pluriel(n(["facture"]), "facture de fournisseur", "factures de fournisseur"),
      n(["facture-emise", "facture-hors-atlas"]) && pluriel(n(["facture-emise", "facture-hors-atlas"]), "virement reçu et sa facture", "virements reçus et leur facture"),
      perdus.length && `${pluriel(perdus.length, "ticket perdu déclaré", "tickets perdus déclarés")}${pagePerdus === null ? "" : ` (page ${pagePerdus})`}`,
    ]
      .filter((t): t is string => typeof t === "string")
      .join(", ");
  const enMots = (t: string) => enLignes([{ t: `${t}.`, police: p.sans, teinte: DOUX }], 9.5, UTILE);
  const mesure = contient(999);
  if (mesure) {
    const yContient = y - 18;
    c.apres.push(() => {
      const perdue = pageDesPerdus();
      poserLignes(page, enMots(contient(perdue && numero(c, perdue))), MARGE, yContient, 9.5, 13);
    });
    y = yContient - 13 * (enMots(mesure).length - 1);
  }

  // Les mois, puis les catégories : deux tableaux l'un sous l'autre, chacun
  // avec sa phrase (ses deux questions du 26 octobre : côte à côte, la première
  // catégorie se lisait comme le premier mois).
  const flux: Flux = { page, y: y - 15 };
  const suite = () => {
    flux.page = nouvellePage(c);
    flux.y = enTete(flux.page, p, "Dossier justifié, suite", []) - 14;
  };
  const xSorties = LARGEUR - MARGE - 191;
  const xEntrees = LARGEUR - MARGE - 53;
  tableau(c, flux, suite, "Mois par mois", [["Mois", MARGE, false], ["Sorties", xSorties, true], ["Entrées", xEntrees, true], ["Page", LARGEUR - MARGE, true]], mois, (m, pg, yb) => {
    const L = d.lignes.filter((l) => l.jour.startsWith(m));
    ecrire(pg, libellePeriode(m), MARGE, yb, p.sans, 9.5, ENCRE, 200);
    ecrireADroite(pg, `-${enEuros(somme(L, "sortie") / 100)}`, xSorties, yb, p.sans, 9.5, SORTIE);
    ecrireADroite(pg, `+${enEuros(somme(L, "entree") / 100)}`, xEntrees, yb, p.sans, 9.5, ENTREE);
    c.apres.push(() => ecrireADroite(pg, String(numero(c, pageDuMois.get(m)!)), LARGEUR - MARGE, yb, p.gras, 9.5, LIEN));
    c.liens.push({ page: pg, x: MARGE, y: yb - 6, l: UTILE, h: 18, vers: () => ({ page: pageDuMois.get(m)!, y: HAUTEUR }) });
  });

  const xMontant = LARGEUR - MARGE - 70;
  const parCategorie = ORDRE_CATEGORIES.map((cat) => ({ cat, total: d.lignes.filter((l) => l.sens === "sortie" && l.categorie === cat).reduce((s, l) => s + centimes(l.montant), 0) })).filter((x) => x.total > 0);
  flux.y -= 10;
  tableau(c, flux, suite, `Les dépenses ${entreLesDeux(d.du, d.au, false)}, par catégorie`, [["Catégorie", MARGE, false], ["Montant", xMontant, true], ["Part", LARGEUR - MARGE, true]], parCategorie, ({ cat, total }, pg, yb) => {
    pg.drawCircle({ x: MARGE + 3, y: yb + 3, size: 3, color: COULEUR_CAT[cat] });
    ecrire(pg, cat === "virement" ? "Virements envoyés" : NOM_CATEGORIE[cat], MARGE + 12, yb, p.sans, 9.5, ENCRE, 220);
    ecrireADroite(pg, enEuros(total / 100), xMontant, yb, p.sans, 9.5, ENCRE);
    // La part d'une petite catégorie ne s'arrondit pas à zéro : elle existe.
    const part = Math.round((total * 100) / sorties);
    ecrireADroite(pg, part === 0 ? "moins de 1\u00a0%" : `${part}\u00a0%`, LARGEUR - MARGE, yb, p.sans, 9.5, GRIS);
  });
}

/** Un tableau de la première page : sa phrase, ses titres, ses rangées de vingt points. Vide, il ne s'écrit pas. */
function tableau<T>(c: Composition, flux: Flux, suite: () => void, titre: string, colonnes: [string, number, boolean][], rangees: readonly T[], rangee: (r: T, page: PDFPage, ligneDeBase: number) => void) {
  if (rangees.length === 0) return;
  const titres = () => {
    for (const [t, x, aDroite] of colonnes) etiquette(flux.page, c.p, t, x, flux.y, aDroite);
    flux.page.drawLine({ start: { x: MARGE, y: flux.y - 7.7 }, end: { x: LARGEUR - MARGE, y: flux.y - 7.7 }, thickness: 0.8, color: ENCRE });
    flux.y -= 7.7;
  };
  // Un titre seul en bas de page, son tableau sur la suivante, ne se lirait pas.
  if (flux.y - 80 < BAS) suite();
  ecrire(flux.page, titre, MARGE, flux.y - 13, c.p.serif, 12.5, ENCRE, UTILE);
  flux.y -= 31;
  titres();
  for (const r of rangees) {
    if (flux.y - 20 < BAS) {
      suite();
      titres();
    }
    rangee(r, flux.page, flux.y - 13);
    flux.page.drawLine({ start: { x: MARGE, y: flux.y - 20 }, end: { x: LARGEUR - MARGE, y: flux.y - 20 }, thickness: 0.6, color: SEPARATION });
    flux.y -= 20;
  }
}

// ─── Les tickets perdus, après le dernier mois ───────────────────────────────

/**
 * Les tickets perdus, avec leur total, sous le dernier mois s'il reste la
 * place de les y poser en entier ; sur la page suivante sinon. Rend la page où
 * ils commencent, que la première page annonce.
 */
function ticketsPerdus(c: Composition, perdus: LignePourLeDossier[], apres: PageDuReleve | null): PDFPage | null {
  if (perdus.length === 0) return null;
  const { p } = c;
  const RANG = 22;
  const phrase = enLignes([{ t: "Ces dépenses restent dans le relevé, avec leur mention. Leur TVA n'a pas été déduite, faute de ticket.", police: p.sans, teinte: DOUX }], 9.5, UTILE);
  const hauteur = 26 + 32 + 10 + (perdus.length + 1) * RANG + 18 + 13 * phrase.length;
  const flux: Flux = apres && apres.y - hauteur >= BAS ? { page: apres.page, y: apres.y - 26 } : { page: nouvellePage(c), y: HAUT };
  const premiere = flux.page;
  flux.y = enTete(flux.page, p, "Les tickets perdus", [{ t: pluriel(perdus.length, "ligne", "lignes"), police: p.sans, teinte: ENCRE }], flux.y) - 10;
  const rang = (gauche: string, milieu: string, montant: string, police: PDFFont) => {
    if (flux.y - RANG < BAS) {
      flux.page = nouvellePage(c);
      flux.y = enTete(flux.page, p, "Les tickets perdus, suite", []) - 10;
    }
    const yb = flux.y - 14.5;
    ecrire(flux.page, gauche, MARGE, yb, p.sans, 9.5, ENCRE, 86);
    ecrire(flux.page, milieu, MARGE + 90, yb, police, 9.5, ENCRE, UTILE - 190);
    ecrireADroite(flux.page, montant, LARGEUR - MARGE, yb, police, 9.5, SORTIE);
    flux.page.drawLine({ start: { x: MARGE, y: flux.y - RANG }, end: { x: LARGEUR - MARGE, y: flux.y - RANG }, thickness: 0.6, color: SEPARATION });
    flux.y -= RANG;
  };
  for (const l of perdus) rang(jourComplet(l.jour), l.libelle, signe(l), p.sans);
  rang("", "Total", `-${enEuros(somme(perdus, "sortie") / 100)}`, p.gras);
  if (flux.y - 18 - 13 * phrase.length < BAS) {
    flux.page = nouvellePage(c);
    flux.y = enTete(flux.page, p, "Les tickets perdus, suite", []) - 10;
  }
  poserLignes(flux.page, phrase, MARGE, flux.y - 18, 9.5, 13);
  return premiere;
}

// ─── Les vraies photos, tout au bout ─────────────────────────────────────────

type Embarque = { genre: "image"; objet: PDFImage } | { genre: "page"; objet: PDFEmbeddedPage };

/** Une image, ou la première page d'un PDF, prête à poser. */
async function embarquer(doc: PDFDocument, f: Fichier): Promise<Embarque | null> {
  try {
    if (f.nature === "pdf") {
      // **La page s'éprouve d'abord sur un PDF de brouillon.** pdf-lib remet
      // l'embarquement à l'enregistrement, et garde dans sa liste une page qui
      // a échoué : une facture vide ou abîmée passait ici sans bruit, puis
      // faisait tomber le dossier ENTIER au moment de l'écrire. Un seul mauvais
      // fichier aurait empêché d'arrêter l'année. Elle n'entre dans le vrai
      // dossier qu'une fois qu'elle a prouvé qu'elle se pose.
      const brouillon = await PDFDocument.create();
      const [essai] = await brouillon.embedPdf(f.octets, [0]);
      if (!essai) return null;
      await essai.embed();
      const [objet] = await doc.embedPdf(f.octets, [0]);
      return { genre: "page", objet };
    }
    const png = f.octets[0] === 0x89 && f.octets[1] === 0x50;
    return { genre: "image", objet: png ? await doc.embedPng(f.octets) : await doc.embedJpg(f.octets) };
  } catch (err) {
    // Un fichier que pdf-lib ne sait pas lire n'empêche pas le dossier de
    // sortir : sa place le dit sur le PDF, et le journal dit pourquoi.
    logger.warn("Une pièce du dossier du comptable n'a pas pu être posée dans le PDF", {
      nature: f.nature,
      erreur: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/** Une photo dans son cadre, sa ligne de banque en légende, et son retour dessous. */
async function poserLaPhoto(c: Composition, page: PDFPage, l: LignePourLeDossier, f: Fichier, x: number, yHaut: number, lw: number, lh: number, fond: Teinte, liaisons: Liaisons) {
  const { p } = c;
  ecrire(page, l.libelle, x, yHaut - 9, p.gras, 8.5, ENCRE, lw);
  poserLignes(page, [[{ t: papier(`${jourComplet(l.jour)}, `), police: p.sans, teinte: ENCRE }, { t: papier(signe(l)), police: p.sans, teinte: l.sens === "entree" ? ENTREE : SORTIE }]], x, yHaut - 21, 8.5, 0);
  const cadre = { x, y: yHaut - lh + 19, w: lw, h: lh - 45 };
  page.drawRectangle({ x: cadre.x, y: cadre.y, width: cadre.w, height: cadre.h, color: fond });
  const pose = await embarquer(c.doc, f);
  if (pose) {
    const echelle = Math.min(cadre.w / pose.objet.width, cadre.h / pose.objet.height);
    const w = pose.objet.width * echelle;
    const hh = pose.objet.height * echelle;
    const pos = { x: cadre.x + (cadre.w - w) / 2, y: cadre.y + (cadre.h - hh) / 2, width: w, height: hh };
    if (pose.genre === "image") page.drawImage(pose.objet, pos);
    else page.drawPage(pose.objet, pos);
  } else {
    ecrire(page, "Photo non lisible ici, gardée dans Atlas", cadre.x + 8, cadre.y + cadre.h / 2, p.sans, 8, GRIS, cadre.w - 16);
  }
  liaisons.photo.set(l, { page, y: yHaut + 10 });
  const yb = yHaut - lh;
  page.drawRectangle({ x, y: yb, width: lw, height: 15, borderColor: FILET, borderWidth: 0.6 });
  ecrire(page, `Retour à la ligne du ${jourEnMots(l.jour)}`, x + 7, yb + 4.5, p.gras, 8, LIEN, lw - 14);
  c.liens.push({ page, x, y: yb, l: lw, h: 15, vers: () => liaisons.retour.get(l)! });
}

/**
 * Les tickets d'abord, six par page ; les factures ensuite, une page chacune
 * pour rester lisibles. Mêlés, un ticket après une facture rouvrirait une page
 * pour lui seul.
 */
async function photos(c: Composition, d: DonneesDossier, liaisons: Liaisons) {
  const { p } = c;
  const avec = d.lignes.flatMap((l) => {
    const f = fichierDe(l);
    return f ? [{ l, ...f }] : [];
  });
  const tickets = avec.filter((x) => !x.pleinePage);
  const titre = "Les photos des justificatifs";
  for (let k = 0; k < tickets.length; k += 6) {
    const lot = tickets.slice(k, k + 6);
    const page = nouvellePage(c);
    const haut = enTete(page, p, titre, [{ t: pluriel(lot.length, "ticket", "tickets"), police: p.sans, teinte: ENCRE }]) - 14;
    const lw = (UTILE - 24) / 3;
    const lh = (haut - BAS - 16) / 2;
    for (const [i, x] of lot.entries()) {
      await poserLaPhoto(c, page, x.l, x.fichier, MARGE + (i % 3) * (lw + 12), haut - Math.floor(i / 3) * (lh + 16), lw, lh, CLICHE, liaisons);
    }
  }
  for (const x of avec.filter((a) => a.pleinePage)) {
    const page = nouvellePage(c);
    const haut = enTete(page, p, titre, [{ t: "Facture", police: p.sans, teinte: ENCRE }]) - 14;
    await poserLaPhoto(c, page, x.l, x.fichier, MARGE, haut, UTILE, haut - BAS, PAPIER, liaisons);
  }
}

export async function composerDossierComptable(d: DonneesDossier): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(texteDuPapier(`Dossier justifié du ${jourComplet(d.du)} au ${jourComplet(d.au)}`));
  doc.setAuthor(texteDuPapier(d.entreprise.nom));
  doc.setCreator("Atlas");
  const c: Composition = {
    doc,
    p: {
      sans: await doc.embedFont(StandardFonts.Helvetica),
      gras: await doc.embedFont(StandardFonts.HelveticaBold),
      oblique: await doc.embedFont(StandardFonts.HelveticaOblique),
      serif: await doc.embedFont(StandardFonts.TimesRoman),
      mono: await doc.embedFont(StandardFonts.Courier),
      monoGras: await doc.embedFont(StandardFonts.CourierBold),
    },
    liens: [],
    apres: [],
  };
  const liaisons: Liaisons = { retour: new Map(), photo: new Map() };
  const mois = [...new Set(d.lignes.map((l) => l.jour.slice(0, 7)))].sort();
  // Les pages des mois et des tickets perdus ne sont connues qu'après : la
  // première page les lit au moment d'écrire leurs numéros.
  const pageDuMois = new Map<string, PDFPage>();
  let pageDesPerdus: PDFPage | null = null;

  couverture(c, d, mois, pageDuMois, () => pageDesPerdus);
  let derniere: PageDuReleve | null = null;
  for (const m of mois) {
    const lu = moisDuReleve(c, m, d.lignes.filter((l) => l.jour.startsWith(m)), liaisons);
    pageDuMois.set(m, lu.premiere);
    fermer(c, lu.derniere);
    derniere = lu.derniere;
  }
  pageDesPerdus = ticketsPerdus(c, d.lignes.filter((l) => l.ticketPerdu), derniere);
  await photos(c, d, liaisons);

  // ─── Les pieds de page, les numéros, puis les liens (toutes les pages existent)
  const pages = doc.getPages();
  const pied = ["Dossier justifié", d.entreprise.nom, entreLesDeux(d.du, d.au, true)].filter(Boolean).join(", ");
  pages.forEach((pg, i) => {
    ecrire(pg, pied, MARGE, 22, c.p.sans, 7.5, GRIS, 380);
    ecrireADroite(pg, `Page ${i + 1} sur ${pages.length}`, LARGEUR - MARGE, 22, c.p.sans, 7.5, GRIS);
  });
  for (const f of c.apres) f();
  poserLiens(doc, c.liens);
  return doc.save();
}
