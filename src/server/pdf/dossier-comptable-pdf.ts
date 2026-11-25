import { LineCapStyle, PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage, type PDFEmbeddedPage } from "pdf-lib";
import { charte } from "@/lib/chartes";
import { couleursDocument } from "@/lib/design-tokens";
import { logger } from "../logger";
import { enEuros } from "@/lib/euros";
import { texteDuPapier } from "@/lib/texte-pdf";
import { ligneDuTotal, type LigneImprimee } from "@/lib/ticket-imprime";
import { couleurDe, nomCategorie, type CleCompta } from "@/lib/categories-comptables";
import { ordreDesCategories, tauxDuRegistre, tauxEnMots, tvaAuTaux, type LigneComptable, type RangDuRegistre } from "@/lib/dossier-du-comptable";
import { mentionFranchise } from "@/lib/franchise-tva";
import { libelleMotif, jourComplet, jourEnMots, suiteDeLaPiece, ecartSignale, totalSigne, type Categorie, type Ecart, type Motif } from "@/lib/pour-mon-comptable";

/**
 * LE DOSSIER DU COMPTABLE, EN PDF : rangé par catégorie, avec son registre des
 * ventes et le numéro de chaque pièce.
 *
 * **Ses choix du 24 novembre 2026** (`appli/soignee/comptable-trois-fichiers.html`,
 * `TODO.md`) : le registre des ventes d'abord ; puis les dépenses catégorie
 * par catégorie, chacune sur sa page, sous son numéro de compte, ligne par
 * ligne dans l'ordre des dates ; **le côte à côte reste** : la ligne de banque
 * à gauche, sa pièce réécrite à droite, le total surligné en bleu gris ; chaque
 * pièce porte son numéro (A 041), le même dans l'Excel et le FEC.
 *
 * **Le ticket est sa planche B** (`appli/soignee/ticket-lisible.html`) : réécrit
 * dans une écriture droite et pleine, plus grande que l'ancien Courier, avec
 * dessous la photo recadrée et nettoyée au téléphone. La vraie photo reste au
 * bout du dossier, « Voir la photo en grand ».
 *
 * **Ce qui n'a pas changé depuis le 24 octobre** : les vraies photos TOUT AU
 * BOUT, chacune avec son « Retour à la ligne » ; les sorties en rouge et les
 * entrées en vert ; **les liens visent une PAGE, jamais un nom** (les lecteurs
 * de téléphone suivent mal les destinations nommées, sa remarque du
 * 23 octobre) ; une pièce illisible n'empêche pas le dossier de sortir.
 *
 * **Ce qui n'y est pas, et ne s'invente pas** : le solde de la banque au début
 * et à la fin de la période (Enable Banking ne le rapporte pas encore,
 * `TODO.md`).
 */

export type Fichier = { octets: Uint8Array; nature: "image" | "pdf" };

export type PieceDeLaLigne =
  | {
      genre: "ticket";
      fournisseur: string;
      date: string;
      totalTtc: string | null;
      tva: string | null;
      photo: Fichier | null;
      /** La photo recadrée et nettoyée au téléphone (migration 0198), posée sous le ticket réécrit. */
      photoNette: Fichier | null;
      /** Le ticket recopié ligne par ligne (lot 5), ou `null` pour un ticket d'avant : il garde alors son résumé. */
      lignes: LigneImprimee[] | null;
    }
  | { genre: "facture"; societe: string; nom: string; totalTtc: string | null; fichier: Fichier | null }
  | { genre: "facture-emise"; numero: string }
  /** Une facture faite hors de Cause (migration 0150) : son total lu, ou tapé, et son fichier. */
  | { genre: "facture-hors-atlas"; sortie?: boolean; totalTtc: string | null; fichier: Fichier | null };

/** Une ligne de banque : ce que les trois fichiers en lisent, plus ce que seul le PDF montre. */
export type LignePourLeDossier = LigneComptable & {
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
  /** Les lignes du relevé, dans son ordre. */
  lignes: LignePourLeDossier[];
  /** Le registre (`registreDesVentes`) : les ventes de la période, et celles d'avant payées pendant. */
  ventes: { periode: RangDuRegistre[]; avant: RangDuRegistre[] };
  /** Les numéros que le registre et les phrases citent, tels que Réglages les donne. */
  comptes: Record<"ventes" | "clients" | "tvaCollectee" | "tvaEnAttente" | "tvaDeductible" | "tvaImmobilisations", string>;
  exigibilite: "encaissements" | "debits";
  franchise: boolean;
};

/** Le PDF, et la page où commence chaque catégorie : l'onglet Achats de l'Excel la cite. */
export type DossierCompose = { pdf: Uint8Array; pageDe: Partial<Record<CleCompta, number>> };

const LARGEUR = 595.28;
const HAUTEUR = 841.89;
const MARGE = 42;
/** Le haut et le bas du contenu, ceux de la planche ; le pied de page vit dessous. */
const HAUT = HAUTEUR - 40;
const BAS = 50;
const UTILE = LARGEUR - 2 * MARGE;
const ORIGINE = charte("origine").jetons;

// Les cinq colonnes d'une catégorie, celles de la planche : Pièce, Date, Ligne
// de banque, TTC, Justificatif.
const L_REF = 54;
const X_DATE = MARGE + L_REF + 6;
const X_LIBELLE = X_DATE + 30 + 8;
const L_PIECE = 186;
const X_PIECE = LARGEUR - MARGE - L_PIECE;
/** Le bord droit des montants. */
const X_MONTANT = X_PIECE - 12;
const L_LIBELLE = X_MONTANT - 72 - 10 - X_LIBELLE;
/** Le bas des rangées : sous la dernière, la place de « Suite page 12 ». */
const BAS_RANGEES = BAS + 20;

function couleur(hex: string) {
  const n = hex.replace("#", "");
  return rgb(parseInt(n.slice(0, 2), 16) / 255, parseInt(n.slice(2, 4), 16) / 255, parseInt(n.slice(4, 6), 16) / 255);
}
type Teinte = ReturnType<typeof rgb>;

/**
 * Une seule encre pour le texte, et aucun gris : sa demande du 24 novembre
 * 2026, « vu que c'est des documents comptables, il faut que ça soit lisible
 * facilement ; tout ce qui est gris clair, tu le mets en noir ; ce que tu veux
 * faire ressortir, soit tu modifies la police, soit tu mets en gras ». Ce qui
 * se distingue le fait par le gras ou la serif ; les seules couleurs du texte
 * disent un sens (sortie, entrée, lien, écart). `test-dossier-comptable-pdf.ts`
 * relit la couleur de chaque texte écrit et refuse un gris.
 */
const ENCRE = couleur("#1c1c1a");
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

type Polices = { sans: PDFFont; gras: PDFFont; oblique: PDFFont; serif: PDFFont };

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

/** Le plus grand corps, entre deux bornes, auquel un texte tient dans sa largeur. */
function corpsQuiTient(texte: string, police: PDFFont, plusGrand: number, plusPetit: number, largeur: number): number {
  const t = papier(texte);
  for (let c = plusGrand; c > plusPetit; c -= 0.5) if (police.widthOfTextAtSize(t, c) <= largeur) return c;
  return plusPetit;
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

/** Des bouts posés sur une ligne, finissant au bord droit. Rend leur largeur. */
function poserADroite(page: PDFPage, bouts: Bout[], xDroit: number, y: number, taille: number): number {
  const propres = bouts.map((b) => ({ ...b, t: papier(b.t) }));
  const largeur = largeurDe(propres, taille);
  poserLignes(page, [propres], xDroit - largeur, y, taille, 0);
  return largeur;
}
const largeurDe = (bouts: Bout[], taille: number) => bouts.reduce((s, b) => s + b.police.widthOfTextAtSize(papier(b.t), taille), 0);

const euros = (centimes: number) => enEuros(centimes / 100);
const signe = (l: LignePourLeDossier) => `${l.sens === "entree" ? "+" : "-"}${euros(l.ttc)}`;
const somme = <X>(xs: readonly X[], f: (x: X) => number) => xs.reduce((s, x) => s + f(x), 0);
/** Un total avec son signe, la règle des écrans (`totalSigne`), le trait d'union en plus. */
const signeDuTotal = (c: number, sens: LignePourLeDossier["sens"]) => totalSigne(c, sens, "-");
const pluriel = (n: number, un: string, plusieurs: string) => `${n} ${n > 1 ? plusieurs : un}`;
/** « impôts, cotisations » : le mot d'un motif au milieu d'une phrase. */
const enMinuscule = (t: string) => `${t.charAt(0).toLocaleLowerCase("fr-FR")}${t.slice(1)}`;
/** « 22/10 » : la date d'une rangée ; l'année est celle du dossier, écrite en tête. */
const jjmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const jjmmaaaa = (iso: string) => `${jjmm(iso)}/${iso.slice(0, 4)}`;

/** « du 1er janvier au 25 octobre » dans une même année ; l'année de chaque bout sinon. */
function entreLesDeux(du: string, au: string, anneeALaFin: boolean): string {
  if (du.slice(0, 4) !== au.slice(0, 4)) return `du ${jourComplet(du)} au ${jourComplet(au)}`;
  return `du ${jourEnMots(du)} au ${anneeALaFin ? jourComplet(au) : jourEnMots(au)}`;
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

type Embarque = { genre: "image"; objet: PDFImage } | { genre: "page"; objet: PDFEmbeddedPage };

/** Ce que tout le dossier partage pendant qu'il se compose. */
type Composition = {
  doc: PDFDocument;
  p: Polices;
  liens: Lien[];
  /** Ce qui s'écrit une fois toutes les pages connues : les numéros de page. */
  apres: (() => void)[];
  /** Un fichier ne s'embarque qu'une fois, même posé deux fois (la vignette et la photo du bout). */
  embarques: Map<Fichier, Promise<Embarque | null>>;
};

const numero = (c: Composition, page: PDFPage) => c.doc.getPages().indexOf(page) + 1;
const nouvellePage = (c: Composition) => c.doc.addPage([LARGEUR, HAUTEUR]);

/** Une petite étiquette en capitales, celle des titres de colonnes. */
function etiquette(page: PDFPage, p: Polices, texte: string, x: number, y: number, aDroite = false) {
  if (aDroite) ecrireADroite(page, texte.toUpperCase(), x, y, p.gras, 7.5, ENCRE);
  else ecrire(page, texte.toUpperCase(), x, y, p.gras, 7.5, ENCRE);
}

/**
 * Le titre d'une page, son numéro de compte en gras à sa suite, ce qu'elle
 * porte à droite, et le trait noir dessous. Un long nom de catégorie se
 * resserre plutôt que de se couper. Rend le bas du trait.
 */
function enTete(page: PDFPage, p: Polices, titre: string, droite: Bout[], options: { compte?: string; pastille?: Teinte; yHaut?: number } = {}): number {
  const yHaut = options.yHaut ?? HAUT;
  const yb = yHaut - 18;
  const aDroite = droite.length > 0 ? largeurDe(droite, 10) + 16 : 0;
  const compte = options.compte ? papier(options.compte) : "";
  const lCompte = compte ? p.gras.widthOfTextAtSize(compte, 12) + 8 : 0;
  let x = MARGE;
  if (options.pastille) {
    page.drawCircle({ x: x + 4, y: yb + 5, size: 4, color: options.pastille });
    x += 14;
  }
  const place = LARGEUR - MARGE - aDroite - lCompte - x;
  const corps = corpsQuiTient(titre, p.serif, 22, 14, place);
  const t = ajuste(titre, p.serif, corps, place);
  page.drawText(t, { x, y: yb, size: corps, font: p.serif, color: ENCRE });
  if (compte) page.drawText(compte, { x: x + p.serif.widthOfTextAtSize(t, corps) + 8, y: yb, size: 12, font: p.gras, color: ENCRE });
  if (droite.length > 0) poserADroite(page, droite, LARGEUR - MARGE, yb, 10);
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

// ─── Les fichiers posés : la vignette sous le ticket, les photos du bout ─────

/** Une image, ou la première page d'un PDF, prête à poser. */
function embarquer(c: Composition, f: Fichier): Promise<Embarque | null> {
  const deja = c.embarques.get(f);
  if (deja) return deja;
  const promesse = (async (): Promise<Embarque | null> => {
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
        const [objet] = await c.doc.embedPdf(f.octets, [0]);
        return { genre: "page", objet };
      }
      const png = f.octets[0] === 0x89 && f.octets[1] === 0x50;
      return { genre: "image", objet: png ? await c.doc.embedPng(f.octets) : await c.doc.embedJpg(f.octets) };
    } catch (err) {
      // Un fichier que pdf-lib ne sait pas lire n'empêche pas le dossier de
      // sortir : sa place le dit sur le PDF, et le journal dit pourquoi.
      logger.warn("Une pièce du dossier du comptable n'a pas pu être posée dans le PDF", {
        nature: f.nature,
        erreur: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  })();
  c.embarques.set(f, promesse);
  return promesse;
}

/** Le fichier posé au bout pour une ligne : une facture prend une page, un ticket un sixième. */
function fichierDe(l: LignePourLeDossier): { fichier: Fichier; pleinePage: boolean } | null {
  const piece = l.piece;
  // Au bout, le ticket nettoyé quand il existe : c'est lui qui se lit. La
  // photo d'origine reste dans Cause, telle quelle.
  if (piece?.genre === "ticket") {
    const f = piece.photoNette ?? piece.photo;
    return f ? { fichier: f, pleinePage: false } : null;
  }
  if (piece?.genre === "facture" || piece?.genre === "facture-hors-atlas") return piece.fichier ? { fichier: piece.fichier, pleinePage: true } : null;
  return null;
}

// ─── La pièce réécrite ───────────────────────────────────────────────────────

/** Le blanc d'une case autour de sa pièce, en haut et en bas, puis sur les côtés. */
const BLANC_HAUT = 6;
const BLANC_COTE = 8;
/** La vignette du ticket nettoyé, sous sa case : la largeur de la planche, et une hauteur bornée. */
const L_VIGNETTE = 96;
const H_VIGNETTE_MAX = 150;

/**
 * Une rangée d'une case de pièce. La case se mesure rangée par rangée : elle
 * prend la hauteur de ce qu'elle porte, et un long ticket se coupe entre deux
 * rangées, jamais au milieu d'une.
 */
type Rang =
  | { genre: "titre"; t: string; police: PDFFont; taille: number; h: number }
  | { genre: "deux"; g: string; d: string | null; police: PDFFont; taille: number; h: number; surligne: boolean; retrait: number }
  | { genre: "blanc"; h: number };

/** « REAL THAI LAIT COCO » se lit « Real thai lait coco » : les capitales d'un ticket se lisent mal (planche B). */
function enPhrase(t: string): string {
  const bas = t.toLocaleLowerCase("fr-FR");
  return t === t.toLocaleUpperCase("fr-FR") ? `${bas.charAt(0).toLocaleUpperCase("fr-FR")}${bas.slice(1)}` : t;
}

/**
 * Les lignes d'un ticket recopié, celle du total surlignée (`ligneDuTotal`).
 * Quand aucune ligne ne tombe juste sur le total, il s'ajoute à part, surligné :
 * jamais une ligne prise au hasard.
 */
function lignesDuTicket(piece: Extract<PieceDeLaLigne, { genre: "ticket" }>): { g: string; d: string | null; surligne: boolean }[] | null {
  if (!piece.lignes || piece.lignes.length === 0) return null;
  const total = ligneDuTotal(piece.lignes, piece.totalTtc ? Number(piece.totalTtc) : null);
  const lignes = piece.lignes.map((l, k) => ({ g: enPhrase(l.gauche), d: l.droite, surligne: k === total }));
  if (total < 0) lignes.push({ g: "Total TTC", d: piece.totalTtc ? enEuros(piece.totalTtc) : "non lu", surligne: true });
  return lignes;
}

/**
 * Ce qu'une case porte, rangée par rangée ; `null` pour une pièce qui se dit
 * d'une phrase. Le ticket s'écrit dans la police droite du document, à 8,8
 * points au lieu des 7,6 du Courier d'avant, et son total plus grand encore
 * (planche B du 24 novembre 2026).
 */
function rangsDeLaPiece(piece: PieceDeLaLigne, p: Polices): Rang[] | null {
  const totalTtc = (t: string | null): Rang => ({ genre: "deux", g: "Total TTC", d: t ? enEuros(t) : "non lu", police: p.gras, taille: 9.5, h: 15, surligne: true, retrait: 3 });
  const nom = (t: string): Rang => ({ genre: "titre", t, police: p.serif, taille: 10.5, h: 12.6 });
  switch (piece.genre) {
    case "ticket": {
      const recopie = lignesDuTicket(piece);
      const rang = (g: string, d: string | null, surligne: boolean): Rang =>
        surligne ? { genre: "deux", g, d, police: p.gras, taille: 9.8, h: 15, surligne, retrait: 3 } : { genre: "deux", g, d, police: p.sans, taille: 8.8, h: 12.4, surligne, retrait: 2 };
      const tete: Rang[] = [
        { genre: "titre", t: piece.fournisseur, police: p.gras, taille: 10.5, h: 13.5 },
        { genre: "titre", t: jourComplet(piece.date), police: p.sans, taille: 8.8, h: 12.4 },
        { genre: "blanc", h: 3 },
      ];
      if (recopie) return [...tete, ...recopie.map((l) => rang(l.g, l.d, l.surligne))];
      return [...tete, rang("Total TTC", piece.totalTtc ? enEuros(piece.totalTtc) : "non lu", true), ...(piece.tva ? [rang("dont TVA", enEuros(piece.tva), false)] : [])];
    }
    case "facture":
      return [nom(piece.societe), { genre: "titre", t: piece.nom, police: p.sans, taille: 8.5, h: 11 }, { genre: "blanc", h: 5 }, totalTtc(piece.totalTtc)];
    case "facture-hors-atlas":
      return [nom(piece.sortie ? "Facture du fournisseur" : "Facture faite hors de Cause"), { genre: "blanc", h: 5 }, totalTtc(piece.totalTtc)];
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
      if (r.genre === "titre") {
        ecrire(page, r.t, gauche, base, r.police, r.taille, ENCRE, droite - gauche);
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
      return piece.sortie ? "Facture du fournisseur" : "Facture faite hors de Cause";
    case "facture-emise":
      return `Facture ${piece.numero}`;
  }
}

/** Une ligne, mesurée avant d'être posée : on sait ainsi si elle tient sur la page. */
type Plan = {
  l: LignePourLeDossier;
  libelle: Bout[][];
  /** Sous le libellé : son hors taxe et sa TVA, ou ce qu'il reste à lire. */
  sous: string | null;
  /** La case de la pièce, ou la phrase qui la remplace (une facture de Cause, un motif, un ticket perdu). */
  rangs: Rang[] | null;
  phrase: Bout[][];
  /** Sous la case : son écart, la vignette du ticket nettoyé, puis « Voir la photo en grand ». */
  ecart: Bout[][];
  vignette: { pose: Embarque; l: number; h: number } | null;
  voir: string | null;
};

function planifier(l: LignePourLeDossier, p: Polices, vignette: Embarque | null): Plan {
  // Le libellé de la banque tient sur trois lignes ; au-delà, la troisième dit
  // qu'il continue (« ... ») plutôt que de le couper sans un signe.
  const coupe = enLignes([{ t: l.libelle, police: p.gras, teinte: ENCRE }], 9.5, L_LIBELLE);
  const libelle = coupe.length <= 3 ? coupe : [...coupe.slice(0, 2), [{ t: ajuste(coupe.slice(2).map((x) => x.map((b) => b.t).join("")).join(" "), p.gras, 9.5, L_LIBELLE), police: p.gras, teinte: ENCRE }]];
  const suite = suiteDeLaPiece(l.ecart, l.sens);
  // Payée en partie se dit sans alerte : seul un vrai écart prend l'ambre.
  const teinteDeLaSuite = ecartSignale(l.ecart, l.sens) ? ECART : ENCRE;
  const rangs = l.piece ? rangsDeLaPiece(l.piece, p) : null;
  let phrase: Bout[] = [];
  if (l.piece?.genre === "facture-emise") {
    phrase = [
      { t: nomDeLaPiece(l.piece), police: p.gras, teinte: ENCRE },
      ...(suite ? [{ t: suite, police: p.gras, teinte: teinteDeLaSuite }] : []),
      { t: ", émise par Cause", police: p.sans, teinte: ENCRE },
    ];
  } else if (!l.piece && l.ticketPerdu) {
    phrase = [{ t: "Ticket perdu, mention validée. TVA non déduite.", police: p.oblique, teinte: SORTIE }];
  } else if (!l.piece && l.motif) {
    phrase = [
      { t: "Justifié par sa nature : ", police: p.sans, teinte: ENCRE },
      { t: enMinuscule(libelleMotif(l.motif, l.sens)), police: p.gras, teinte: ENCRE },
    ];
  } else if (!l.piece) {
    phrase = [{ t: "Aucune pièce", police: p.sans, teinte: ENCRE }];
  }
  const fichier = fichierDe(l);
  const posee =
    vignette && rangs
      ? (() => {
          const echelle = Math.min(L_VIGNETTE / vignette.objet.width, H_VIGNETTE_MAX / vignette.objet.height);
          return { pose: vignette, l: vignette.objet.width * echelle, h: vignette.objet.height * echelle };
        })()
      : null;
  return {
    l,
    libelle,
    sous: l.tvaNonLue ? "TVA à lire sur la pièce" : l.tva > 0 ? `HT ${euros(l.ht)}, TVA ${euros(l.tva)}` : null,
    rangs,
    phrase: enLignes(phrase, 9, L_PIECE),
    ecart: rangs && suite && l.piece ? enLignes([{ t: `${nomDeLaPiece(l.piece)}${suite}`, police: p.gras, teinte: teinteDeLaSuite }], 8, L_PIECE) : [],
    vignette: posee,
    voir: fichier ? (fichier.pleinePage ? "Voir la facture" : posee ? "Voir la photo en grand" : "Voir la photo") : null,
  };
}

const hauteurGauche = (pl: Plan) => 30 + 12 * (pl.libelle.length - 1) + (pl.sous ? 12 : 0);
const hauteurDessous = (pl: Plan) => (pl.ecart.length > 0 ? 4 + 10 * pl.ecart.length : 0) + (pl.vignette ? 6 + pl.vignette.h : 0) + (pl.voir ? 16 : 0);
const hauteurDroite = (pl: Plan) => (pl.rangs ? 8 + hauteurDeCase(pl.rangs) + hauteurDessous(pl) : 20 + 12 * (pl.phrase.length - 1));
const hauteurDeLaLigne = (pl: Plan) => Math.max(hauteurGauche(pl), hauteurDroite(pl)) + 8;

/** Une page de catégorie qui se remplit, et ce qu'on sait d'elle. */
type PageDuReleve = { page: PDFPage; y: number; suite: boolean; lignes: number };

type Liaisons = {
  /** Là où mène « Retour à la ligne » : la page où se trouve « Voir la photo ». */
  retour: Map<LignePourLeDossier, { page: PDFPage; y: number }>;
  /** Là où mène « Voir la photo » : la photo, tout au bout. */
  photo: Map<LignePourLeDossier, { page: PDFPage; y: number }>;
};

/** Ce qu'une catégorie dit sous son titre : où va sa TVA, ou ce qu'elle est. */
function motDeLaCategorie(k: CleCompta, lignes: readonly LignePourLeDossier[], d: DonneesDossier): string | null {
  if (k === "salaires") return "Le virement de chaque salaire. Le salaire lui-même est passé par votre cabinet depuis la fiche de paie.";
  if (k === "clients") return "Chaque paiement porte le numéro de sa facture, celui du registre des ventes.";
  if (k === "aClasser") return "Les lignes que Cause n'a pas su ranger, à votre comptable de les classer.";
  const comptesTva = [...new Set(lignes.filter((l) => l.tva > 0 && l.compteTva).map((l) => l.compteTva!))];
  if (comptesTva.length > 0) return `TVA déduite au ${comptesTva.join(" et au ")}.`;
  if (d.franchise && lignes.some((l) => l.sens === "sortie")) return "Entreprise en franchise de TVA : rien ne se déduit.";
  return null;
}

/** L'en-tête d'une page de catégorie : son nom, son compte, ses totaux, ses colonnes. */
function pageDeCategorie(c: Composition, k: CleCompta, compte: string, suite: boolean, bilan: Bout[], mot: string | null): PageDuReleve {
  const page = nouvellePage(c);
  const titre = k === "clients" ? "Les paiements des clients" : nomCategorie(k);
  let y = enTete(page, c.p, suite ? `${titre}, suite` : titre, bilan, { compte, pastille: COULEUR_CAT[couleurDe(k)] });
  if (mot && !suite) {
    const lignes = enLignes([{ t: mot, police: c.p.sans, teinte: ENCRE }], 9, UTILE);
    poserLignes(page, lignes, MARGE, y - 14, 9, 12);
    y -= 8 + 12 * lignes.length;
  }
  y -= 18;
  etiquette(page, c.p, "Pièce", MARGE, y);
  etiquette(page, c.p, "Date", X_DATE, y);
  etiquette(page, c.p, "Ligne de banque", X_LIBELLE, y);
  etiquette(page, c.p, "TTC", X_MONTANT, y, true);
  etiquette(page, c.p, "Justificatif", X_PIECE, y);
  page.drawLine({ start: { x: MARGE, y: y - 10 }, end: { x: LARGEUR - MARGE, y: y - 10 }, thickness: 0.8, color: ENCRE });
  return { page, y: y - 11, suite, lignes: 0 };
}

/** La page d'une catégorie se ferme : une page de suite dit combien de lignes elle porte. */
function fermer(c: Composition, pg: PageDuReleve) {
  if (pg.suite) poserADroite(pg.page, [{ t: pluriel(pg.lignes, "ligne", "lignes"), police: c.p.sans, teinte: ENCRE }], LARGEUR - MARGE, HAUT - 18, 10);
}

/**
 * Une catégorie, la ligne la plus ancienne en haut. **Elle commence toujours
 * sa page** : une catégorie se retrouve d'un coup d'œil, au prix d'un blanc en
 * bas de la page d'avant. Rend sa première page, que le sommaire vise, et la
 * dernière avec la place qui y reste, pour les tickets perdus qui suivent.
 */
function categorie(c: Composition, d: DonneesDossier, k: CleCompta, lignes: LignePourLeDossier[], liaisons: Liaisons, vignettes: Map<LignePourLeDossier, Embarque | null>): { premiere: PDFPage; derniere: PageDuReleve } {
  const { p } = c;
  const sens = lignes[0]!.sens;
  const ttc = somme(lignes, (l) => l.ttc);
  const tva = somme(lignes, (l) => l.tva);
  const bilan: Bout[] = [
    ...(tva > 0
      ? [
          { t: "HT ", police: p.sans, teinte: ENCRE },
          { t: euros(ttc - tva), police: p.gras, teinte: ENCRE },
          { t: ", TVA ", police: p.sans, teinte: ENCRE },
          { t: euros(tva), police: p.gras, teinte: ENCRE },
          { t: ", ", police: p.sans, teinte: ENCRE },
        ]
      : []),
    { t: "TTC ", police: p.sans, teinte: ENCRE },
    { t: signeDuTotal(ttc, sens), police: p.gras, teinte: sens === "entree" ? ENTREE : SORTIE },
  ];
  const compte = lignes[0]!.compte;
  let pg = pageDeCategorie(c, k, compte, false, bilan, motDeLaCategorie(k, lignes, d));
  const premiere = pg.page;
  const changer = () => {
    const suivante = pageDeCategorie(c, k, compte, true, [], null);
    ecrireADroite(pg.page, `Suite page ${numero(c, suivante.page)}`, LARGEUR - MARGE, pg.y - 14, p.sans, 8.5, ENCRE);
    fermer(c, pg);
    pg = suivante;
  };
  const dansLOrdre = lignes.map((l, i) => ({ l, i })).sort((a, b) => a.l.jour.localeCompare(b.l.jour) || a.i - b.i);
  for (const { l } of dansLOrdre) {
    const plan = planifier(l, p, vignettes.get(l) ?? null);
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
  const corpsRef = corpsQuiTient(l.ref, p.gras, 8.5, 6, L_REF);
  ecrire(pg.page, l.ref, MARGE, yL, p.gras, corpsRef, ENCRE, L_REF);
  ecrire(pg.page, jjmm(l.jour), X_DATE, yL, p.sans, 8.5, ENCRE, 30);
  poserLignes(pg.page, plan.libelle, X_LIBELLE, yL, 9.5, 12);
  if (plan.sous) ecrire(pg.page, plan.sous, X_LIBELLE, yL - 12 * plan.libelle.length - 1, l.tvaNonLue ? p.oblique : p.sans, 8.5, l.tvaNonLue ? ECART : ENCRE, L_LIBELLE);
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
      // Le dernier morceau garde sous lui l'écart, la vignette et « Voir la photo ».
      if (n === reste.length && hauteurDesRangs(reste) + hauteurDessous(plan) > libre && n > 1) n -= 1;
      n = Math.max(1, n);
      yCase -= dessinerCase(pg.page, reste.slice(0, n), yCase);
      reste = reste.slice(n);
      if (reste.length === 0) break;
      // « Suite page 12 » s'écrit sous ce qui est déjà posé.
      pg.y = Math.min(bas, yCase) - 8;
      changer();
      pg = courante();
      haut = pg.y;
      ecrire(pg.page, l.ref, MARGE, haut - 16, p.gras, corpsRef, ENCRE, L_REF);
      ecrire(pg.page, l.libelle, X_LIBELLE, haut - 16, p.gras, 9.5, ENCRE, L_LIBELLE);
      ecrire(pg.page, `Suite du ticket du ${jourComplet(l.jour)}`, X_LIBELLE, haut - 30, p.sans, 8.5, ENCRE, L_LIBELLE);
      pg.lignes += 1;
      bas = haut - 34;
      yCase = haut - 8;
    }
    if (plan.ecart.length > 0) {
      poserLignes(pg.page, plan.ecart, X_PIECE, yCase - 11, 8, 10);
      yCase -= 4 + 10 * plan.ecart.length;
    }
    if (plan.vignette) {
      const v = plan.vignette;
      const pos = { x: X_PIECE, y: yCase - 6 - v.h, width: v.l, height: v.h };
      if (v.pose.genre === "image") pg.page.drawImage(v.pose.objet, pos);
      else pg.page.drawPage(v.pose.objet, pos);
      pg.page.drawRectangle({ ...pos, borderColor: FILET, borderWidth: 0.6 });
      yCase -= 6 + v.h;
    }
    if (plan.voir) {
      const yb = yCase - 16;
      appareil(pg.page, X_PIECE, yb + 12, 9, LIEN);
      const page = pg.page;
      // Le numéro de la page de la photo n'est connu qu'au bout.
      c.apres.push(() => {
        const cible = liaisons.photo.get(l);
        ecrire(page, cible ? `${plan.voir}, page ${numero(c, cible.page)}` : plan.voir!, X_PIECE + 13, yb + 4, p.gras, 8, LIEN, L_PIECE - 13);
      });
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

// ─── Les tableaux : le sommaire et le registre ───────────────────────────────

/** Une page qui se remplit de haut en bas, et en ouvre une autre quand elle est pleine. */
type Flux = { page: PDFPage; y: number };

/** Une colonne d'un tableau : son titre, son bord (gauche, ou droit pour un montant). */
type Colonne = { titre: string; x: number; aDroite: boolean };

/**
 * Un tableau : sa phrase, ses titres, ses rangées de la hauteur qu'elles
 * demandent. Vide, il ne s'écrit pas. Une page qui se remplit en ouvre une
 * autre, qui reprend les titres.
 */
function tableau<T>(c: Composition, flux: Flux, suite: () => void, titre: string | null, colonnes: Colonne[], rangees: readonly T[], hauteur: (r: T) => number, rangee: (r: T, page: PDFPage, ligneDeBase: number) => void) {
  if (rangees.length === 0) return;
  const titres = () => {
    for (const k of colonnes) etiquette(flux.page, c.p, k.titre, k.x, flux.y, k.aDroite);
    flux.page.drawLine({ start: { x: MARGE, y: flux.y - 7.7 }, end: { x: LARGEUR - MARGE, y: flux.y - 7.7 }, thickness: 0.8, color: ENCRE });
    flux.y -= 7.7;
  };
  // Un titre seul en bas de page, son tableau sur la suivante, ne se lirait pas.
  if (flux.y - 80 < BAS) suite();
  if (titre) {
    ecrire(flux.page, titre, MARGE, flux.y - 13, c.p.serif, 12.5, ENCRE, UTILE);
    flux.y -= 31;
  } else {
    flux.y -= 12;
  }
  titres();
  for (const r of rangees) {
    const h = hauteur(r);
    if (flux.y - h < BAS) {
      suite();
      titres();
    }
    rangee(r, flux.page, flux.y - 13);
    flux.page.drawLine({ start: { x: MARGE, y: flux.y - h }, end: { x: LARGEUR - MARGE, y: flux.y - h }, thickness: 0.6, color: SEPARATION });
    flux.y -= h;
  }
}

/** Les sections du dossier, dans son ordre, telles que la première page les annonce. */
type Section = { cle: CleCompta | "perdus" | "photos"; compte: string; nom: string; pastille: Teinte | null; pieces: string; total: string; teinte: Teinte };

function couverture(c: Composition, d: DonneesDossier, sections: Section[], pageDe: Map<Section["cle"], PDFPage>) {
  const { p } = c;
  const page = nouvellePage(c);
  ecrire(page, "POUR MON COMPTABLE", MARGE, HAUTEUR - 52, p.gras, 7.5, ENCRE);
  page.drawText(papier("Dossier justifié"), { x: MARGE, y: HAUTEUR - 99, size: 30, font: p.serif, color: ENCRE });
  ecrire(page, `Du ${jourComplet(d.du)} au ${jourComplet(d.au)}`, MARGE, HAUTEUR - 124, p.serif, 15, ENCRE);
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
      [`le ${jourComplet(d.rangeLe)},`, `gardé jusqu'au ${jourComplet(d.gardeJusquAu)},`, "avec son Excel et son FEC"].flatMap((t) => enLignes([{ t, police: p.sans, teinte: ENCRE }], 9.5, l2)),
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
  y = Math.min(basDesColonnes - 20, HAUTEUR - 237);
  page.drawRectangle({ x: MARGE, y: y - 34, width: UTILE, height: 34, color: ATTESTE_FOND });
  coche(page, MARGE + 12, y - 9, 16, ATTESTE);
  ecrire(page, "Chaque ligne de la banque a son justificatif, ou sa mention de ticket perdu.", MARGE + 40, y - 21, p.gras, 11, ATTESTE, UTILE - 52);
  y -= 44;

  // Les quatre chiffres, ceux de la planche.
  const ventes = d.ventes.periode;
  const quatre: [string, string, Teinte][] = [
    ["Facturé hors taxe", euros(somme(ventes, (v) => v.ht)), ENCRE],
    ["Encaissé", signeDuTotal(somme(d.lignes.filter((l) => l.cle === "clients"), (l) => l.ttc), "entree"), ENTREE],
    ["Reste dû", euros(somme(ventes, (v) => v.reste)), ENCRE],
    ["Dépenses", signeDuTotal(somme(d.lignes.filter((l) => l.sens === "sortie"), (l) => l.ttc), "sortie"), SORTIE],
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

  // Ce que range le dossier : chaque section sous son compte, et sa page.
  const flux: Flux = { page, y: y - 6 };
  const suite = () => {
    flux.page = nouvellePage(c);
    flux.y = enTete(flux.page, p, "Dossier justifié, suite", []) - 14;
  };
  const xNom = MARGE + 50;
  const xPieces = LARGEUR - MARGE - 168;
  const xTtc = LARGEUR - MARGE - 46;
  tableau(
    c,
    flux,
    suite,
    "Ce que range le dossier",
    [
      { titre: "Compte", x: MARGE, aDroite: false },
      { titre: "Catégorie", x: xNom, aDroite: false },
      { titre: "Pièces", x: xPieces, aDroite: true },
      { titre: "TTC", x: xTtc, aDroite: true },
      { titre: "Page", x: LARGEUR - MARGE, aDroite: true },
    ],
    sections,
    () => 20,
    (s, pg, yb) => {
      ecrire(pg, s.compte, MARGE, yb, p.gras, 9.5, ENCRE, 46);
      if (s.pastille) pg.drawCircle({ x: xNom + 3, y: yb + 3, size: 3, color: s.pastille });
      ecrire(pg, s.nom, xNom + (s.pastille ? 12 : 0), yb, s.cle === "ventes" ? p.gras : p.sans, 9.5, ENCRE, xPieces - xNom - 70);
      ecrireADroite(pg, s.pieces, xPieces, yb, p.sans, 9.5, ENCRE);
      ecrireADroite(pg, s.total, xTtc, yb, p.sans, 9.5, s.teinte);
      c.apres.push(() => {
        const cible = pageDe.get(s.cle);
        if (cible) ecrireADroite(pg, String(numero(c, cible)), LARGEUR - MARGE, yb, p.gras, 9.5, LIEN);
      });
      c.liens.push({ page: pg, x: MARGE, y: yb - 6, l: UTILE, h: 18, vers: () => ({ page: pageDe.get(s.cle) ?? pg, y: HAUTEUR }) });
    }
  );
  const fin = enLignes([{ t: "Le fichier au format FEC joint remplit votre logiciel. Le FEC de l'exercice reste celui que votre logiciel produit à la clôture.", police: p.sans, teinte: ENCRE }], 9.5, UTILE);
  if (flux.y - 18 - 13 * fin.length < BAS) suite();
  poserLignes(flux.page, fin, MARGE, flux.y - 18, 9.5, 13);
}

/** Le registre des ventes (son choix 1) : une ligne par facture de la période, puis celles d'avant payées pendant. */
function registre(c: Composition, d: DonneesDossier): PDFPage {
  const { p } = c;
  const { periode, avant } = d.ventes;
  const taux = d.franchise ? [] : tauxDuRegistre(periode);
  const factures = periode.filter((r) => r.genre === "facture");
  const page = nouvellePage(c);
  const bilan: Bout[] = [
    { t: `${pluriel(factures.length, "facture", "factures")}, HT `, police: p.sans, teinte: ENCRE },
    { t: euros(somme(periode, (r) => r.ht)), police: p.gras, teinte: ENCRE },
  ];
  let y = enTete(page, p, "Registre des ventes", bilan, { compte: d.comptes.ventes });
  const mot = d.franchise
    ? `Une ligne par facture de la période. Clients au ${d.comptes.clients}. ${mentionFranchise(d.au)}`
    : d.exigibilite === "encaissements"
      ? `Une ligne par facture de la période. Clients au ${d.comptes.clients}, TVA en attente du paiement au ${d.comptes.tvaEnAttente}, due au ${d.comptes.tvaCollectee} quand le client paie.`
      : `Une ligne par facture de la période. Clients au ${d.comptes.clients}, TVA due au ${d.comptes.tvaCollectee} dès la facture.`;
  const lignesDuMot = enLignes([{ t: mot, police: p.sans, teinte: ENCRE }], 9, UTILE);
  poserLignes(page, lignesDuMot, MARGE, y - 14, 9, 12);
  y -= 8 + 12 * lignesDuMot.length;
  const flux: Flux = { page, y };
  const suite = () => {
    flux.page = nouvellePage(c);
    flux.y = enTete(flux.page, p, "Registre des ventes, suite", [], { compte: d.comptes.ventes }) - 6;
  };

  // Les montants de droite à gauche : reste dû, payée le, TTC, les taux, HT.
  const L_MONTANT = 54;
  const xReste = LARGEUR - MARGE;
  const xPayee = xReste - L_MONTANT - 8;
  const xTtc = xPayee - 50;
  const xTaux = taux.map((_, i) => xTtc - L_MONTANT - 4 - (taux.length - 1 - i) * (L_MONTANT - 6));
  const xHt = (xTaux[0] ?? xTtc) - L_MONTANT - 4;
  const xDate = MARGE + 66;
  const xClient = xDate + 34;
  const lClient = xHt - L_MONTANT - xClient;
  const un = (r: RangDuRegistre) => (r.genre === "avoir" ? `Avoir sur ${r.facture}` : (r.chantier ?? ""));

  tableau(
    c,
    flux,
    suite,
    null,
    [
      { titre: "N°", x: MARGE, aDroite: false },
      { titre: "Date", x: xDate, aDroite: false },
      { titre: "Client, chantier", x: xClient, aDroite: false },
      { titre: "HT", x: xHt, aDroite: true },
      ...taux.map((t, i) => ({ titre: `TVA ${tauxEnMots(t)}`, x: xTaux[i]!, aDroite: true })),
      { titre: "TTC", x: xTtc, aDroite: true },
      { titre: "Payée le", x: xPayee, aDroite: true },
      { titre: "Reste dû", x: xReste, aDroite: true },
    ],
    [...periode, null],
    (r) => (r === null ? 22 : 28),
    (r, pg, yb) => {
      if (r === null) {
        ecrire(pg, "Total", xClient, yb, p.gras, 8.5, ENCRE, lClient);
        ecrireADroite(pg, euros(somme(periode, (x) => x.ht)), xHt, yb, p.gras, 8.5);
        taux.forEach((t, i) => ecrireADroite(pg, euros(somme(periode, (x) => tvaAuTaux(x, t))), xTaux[i]!, yb, p.gras, 8.5));
        ecrireADroite(pg, euros(somme(periode, (x) => x.ttc)), xTtc, yb, p.gras, 8.5);
        ecrireADroite(pg, euros(somme(periode, (x) => x.reste)), xReste, yb, p.gras, 8.5, SORTIE);
        return;
      }
      ecrire(pg, r.numero, MARGE, yb, p.gras, corpsQuiTient(r.numero, p.gras, 8.5, 6, 64), ENCRE, 64);
      ecrire(pg, jjmm(r.date), xDate, yb, p.sans, 8.5, ENCRE, 32);
      ecrire(pg, r.client, xClient, yb, p.gras, 8.5, ENCRE, lClient);
      ecrire(pg, un(r), xClient, yb - 11, p.sans, 8, ENCRE, lClient);
      ecrireADroite(pg, euros(r.ht), xHt, yb, p.sans, 8.5);
      taux.forEach((t, i) => ecrireADroite(pg, euros(tvaAuTaux(r, t)), xTaux[i]!, yb, p.sans, 8.5));
      ecrireADroite(pg, euros(r.ttc), xTtc, yb, p.sans, 8.5);
      if (r.genre === "facture") {
        ecrireADroite(pg, r.payeeLe ? jjmm(r.payeeLe) : "pas encore", xPayee, yb, p.sans, 8.5);
        if (r.enPartie) ecrireADroite(pg, "en partie", xPayee, yb - 11, p.sans, 8);
        ecrireADroite(pg, euros(r.reste), xReste, yb, r.reste > 0 ? p.gras : p.sans, 8.5, r.reste > 0 ? SORTIE : ENCRE);
      }
    }
  );

  flux.y -= 6;
  const xAvantTtc = xPayee - 70;
  tableau(
    c,
    flux,
    suite,
    `Payées ${entreLesDeux(d.du, d.au, false)}, facturées avant`,
    [
      { titre: "N°", x: MARGE, aDroite: false },
      { titre: "Facturée le", x: xDate, aDroite: false },
      { titre: "Client, chantier", x: xClient + 34, aDroite: false },
      { titre: "TTC", x: xAvantTtc, aDroite: true },
      { titre: "Payée le", x: xPayee, aDroite: true },
      { titre: "Reste dû", x: xReste, aDroite: true },
    ],
    avant,
    () => 22,
    (r, pg, yb) => {
      ecrire(pg, r.numero, MARGE, yb, p.gras, corpsQuiTient(r.numero, p.gras, 8.5, 6, 64), ENCRE, 64);
      ecrire(pg, jjmmaaaa(r.date), xDate, yb, p.sans, 8.5, ENCRE, 54);
      ecrire(pg, [r.client, r.chantier].filter(Boolean).join(", "), xClient + 34, yb, p.sans, 8.5, ENCRE, xAvantTtc - 64 - xClient - 34);
      ecrireADroite(pg, euros(r.ttc), xAvantTtc, yb, p.sans, 8.5);
      ecrireADroite(pg, r.payeeLe ? jjmm(r.payeeLe) : "", xPayee, yb, p.sans, 8.5);
      ecrireADroite(pg, euros(r.reste), xReste, yb, p.sans, 8.5, r.reste > 0 ? SORTIE : ENCRE);
    }
  );
  const fin = enLignes([{ t: "Chaque facture se retrouve sous son numéro dans l'onglet Ventes de l'Excel et dans le FEC.", police: p.sans, teinte: ENCRE }], 9, UTILE);
  if (flux.y - 18 - 12 * fin.length < BAS) suite();
  poserLignes(flux.page, fin, MARGE, flux.y - 18, 9, 12);
  return page;
}

// ─── Les tickets perdus, après la dernière catégorie ─────────────────────────

/**
 * Les tickets perdus, avec leur total, sous la dernière catégorie s'il reste
 * la place de les y poser en entier ; sur la page suivante sinon. Chacun reste
 * aussi dans sa catégorie, avec sa mention : cette page les réunit pour la TVA
 * qui n'a pas été déduite. Rend la page où ils commencent.
 */
function ticketsPerdus(c: Composition, perdus: LignePourLeDossier[], apres: PageDuReleve | null): PDFPage | null {
  if (perdus.length === 0) return null;
  const { p } = c;
  const RANG = 22;
  const phrase = enLignes([{ t: "Ces dépenses restent dans leur catégorie, avec leur mention. Leur TVA n'a pas été déduite, faute de ticket.", police: p.sans, teinte: ENCRE }], 9.5, UTILE);
  const hauteur = 26 + 32 + 10 + (perdus.length + 1) * RANG + 18 + 13 * phrase.length;
  const flux: Flux = apres && apres.y - hauteur >= BAS ? { page: apres.page, y: apres.y - 26 } : { page: nouvellePage(c), y: HAUT };
  const premiere = flux.page;
  flux.y = enTete(flux.page, p, "Les tickets perdus", [{ t: pluriel(perdus.length, "ligne", "lignes"), police: p.sans, teinte: ENCRE }], { yHaut: flux.y }) - 10;
  const rang = (ref: string, jour: string, milieu: string, montant: string, police: PDFFont) => {
    if (flux.y - RANG < BAS) {
      flux.page = nouvellePage(c);
      flux.y = enTete(flux.page, p, "Les tickets perdus, suite", []) - 10;
    }
    const yb = flux.y - 14.5;
    ecrire(flux.page, ref, MARGE, yb, p.gras, 9.5, ENCRE, 50);
    ecrire(flux.page, jour, MARGE + 54, yb, p.sans, 9.5, ENCRE, 86);
    ecrire(flux.page, milieu, MARGE + 144, yb, police, 9.5, ENCRE, UTILE - 244);
    ecrireADroite(flux.page, montant, LARGEUR - MARGE, yb, police, 9.5, SORTIE);
    flux.page.drawLine({ start: { x: MARGE, y: flux.y - RANG }, end: { x: LARGEUR - MARGE, y: flux.y - RANG }, thickness: 0.6, color: SEPARATION });
    flux.y -= RANG;
  };
  for (const l of perdus) rang(l.ref, jourComplet(l.jour), l.libelle, signe(l), p.sans);
  rang("", "", "Total", signeDuTotal(somme(perdus, (l) => l.ttc), "sortie"), p.gras);
  if (flux.y - 18 - 13 * phrase.length < BAS) {
    flux.page = nouvellePage(c);
    flux.y = enTete(flux.page, p, "Les tickets perdus, suite", []) - 10;
  }
  poserLignes(flux.page, phrase, MARGE, flux.y - 18, 9.5, 13);
  return premiere;
}

// ─── Les vraies photos, tout au bout ─────────────────────────────────────────

/** Une photo dans son cadre, sa pièce et sa ligne de banque en légende, et son retour dessous. */
async function poserLaPhoto(c: Composition, page: PDFPage, l: LignePourLeDossier, f: Fichier, x: number, yHaut: number, lw: number, lh: number, fond: Teinte, liaisons: Liaisons) {
  const { p } = c;
  ecrire(page, `${l.ref} ${l.libelle}`, x, yHaut - 9, p.gras, 8.5, ENCRE, lw);
  poserLignes(page, [[{ t: papier(`${jourComplet(l.jour)}, `), police: p.sans, teinte: ENCRE }, { t: papier(signe(l)), police: p.sans, teinte: l.sens === "entree" ? ENTREE : SORTIE }]], x, yHaut - 21, 8.5, 0);
  const cadre = { x, y: yHaut - lh + 19, w: lw, h: lh - 45 };
  page.drawRectangle({ x: cadre.x, y: cadre.y, width: cadre.w, height: cadre.h, color: fond });
  const pose = await embarquer(c, f);
  if (pose) {
    const echelle = Math.min(cadre.w / pose.objet.width, cadre.h / pose.objet.height);
    const w = pose.objet.width * echelle;
    const hh = pose.objet.height * echelle;
    const pos = { x: cadre.x + (cadre.w - w) / 2, y: cadre.y + (cadre.h - hh) / 2, width: w, height: hh };
    if (pose.genre === "image") page.drawImage(pose.objet, pos);
    else page.drawPage(pose.objet, pos);
  } else {
    ecrire(page, "Photo non lisible ici, gardée dans Cause", cadre.x + 8, cadre.y + cadre.h / 2, p.sans, 8, ENCRE, cadre.w - 16);
  }
  liaisons.photo.set(l, { page, y: yHaut + 10 });
  const yb = yHaut - lh;
  page.drawRectangle({ x, y: yb, width: lw, height: 15, borderColor: FILET, borderWidth: 0.6 });
  c.apres.push(() => {
    const retour = liaisons.retour.get(l);
    ecrire(page, retour ? `Retour à la ligne, page ${numero(c, retour.page)}` : "Retour à la ligne", x + 7, yb + 4.5, p.gras, 8, LIEN, lw - 14);
  });
  c.liens.push({ page, x, y: yb, l: lw, h: 15, vers: () => liaisons.retour.get(l)! });
}

/**
 * Les tickets d'abord, six par page ; les factures ensuite, une page chacune
 * pour rester lisibles. Mêlés, un ticket après une facture rouvrirait une page
 * pour lui seul. Ils suivent l'ordre du dossier : catégorie, puis date.
 */
async function photos(c: Composition, lignesDansLOrdre: LignePourLeDossier[], liaisons: Liaisons): Promise<PDFPage | null> {
  const { p } = c;
  const avec = lignesDansLOrdre.flatMap((l) => {
    const f = fichierDe(l);
    return f ? [{ l, ...f }] : [];
  });
  let premiere: PDFPage | null = null;
  const tickets = avec.filter((x) => !x.pleinePage);
  const titre = "Les photos des justificatifs";
  for (let k = 0; k < tickets.length; k += 6) {
    const lot = tickets.slice(k, k + 6);
    const page = nouvellePage(c);
    premiere ??= page;
    const haut = enTete(page, p, titre, [{ t: pluriel(lot.length, "ticket", "tickets"), police: p.sans, teinte: ENCRE }]) - 14;
    const lw = (UTILE - 24) / 3;
    const lh = (haut - BAS - 16) / 2;
    for (const [i, x] of lot.entries()) {
      await poserLaPhoto(c, page, x.l, x.fichier, MARGE + (i % 3) * (lw + 12), haut - Math.floor(i / 3) * (lh + 16), lw, lh, CLICHE, liaisons);
    }
  }
  for (const x of avec.filter((a) => a.pleinePage)) {
    const page = nouvellePage(c);
    premiere ??= page;
    const haut = enTete(page, p, titre, [{ t: "Facture", police: p.sans, teinte: ENCRE }]) - 14;
    await poserLaPhoto(c, page, x.l, x.fichier, MARGE, haut, UTILE, haut - BAS, PAPIER, liaisons);
  }
  return premiere;
}

export async function composerDossierComptable(d: DonneesDossier): Promise<DossierCompose> {
  const doc = await PDFDocument.create();
  doc.setTitle(texteDuPapier(`Dossier justifié du ${jourComplet(d.du)} au ${jourComplet(d.au)}`));
  doc.setAuthor(texteDuPapier(d.entreprise.nom));
  doc.setCreator("Cause");
  const c: Composition = {
    doc,
    p: {
      sans: await doc.embedFont(StandardFonts.Helvetica),
      gras: await doc.embedFont(StandardFonts.HelveticaBold),
      oblique: await doc.embedFont(StandardFonts.HelveticaOblique),
      serif: await doc.embedFont(StandardFonts.TimesRoman),
    },
    liens: [],
    apres: [],
    embarques: new Map(),
  };
  const liaisons: Liaisons = { retour: new Map(), photo: new Map() };

  // Les vignettes des tickets nettoyés s'embarquent avant la mise en page : leur
  // hauteur décide de celle de la ligne.
  const vignettes = new Map<LignePourLeDossier, Embarque | null>();
  for (const l of d.lignes) if (l.piece?.genre === "ticket" && l.piece.photoNette) vignettes.set(l, await embarquer(c, l.piece.photoNette));

  const cles = ordreDesCategories().filter((k) => d.lignes.some((l) => l.cle === k));
  const lignesDe = (k: CleCompta) => d.lignes.filter((l) => l.cle === k);
  const perdus = d.lignes.filter((l) => l.ticketPerdu);
  const avecUnFichier = d.lignes.filter((l) => fichierDe(l)).length;
  const aUnRegistre = d.ventes.periode.length + d.ventes.avant.length > 0;
  const sections: Section[] = [
    ...(aUnRegistre
      ? [{ cle: "ventes" as const, compte: d.comptes.ventes, nom: "Registre des ventes", pastille: null, pieces: pluriel(d.ventes.periode.filter((r) => r.genre === "facture").length, "facture", "factures"), total: signeDuTotal(somme(d.ventes.periode, (r) => r.ttc), "entree"), teinte: ENTREE }]
      : []),
    ...cles.map((k): Section => {
      const L = lignesDe(k);
      const sens = L[0]!.sens;
      return { cle: k, compte: L[0]!.compte, nom: k === "clients" ? "Les paiements des clients" : nomCategorie(k), pastille: COULEUR_CAT[couleurDe(k)], pieces: String(L.length), total: signeDuTotal(somme(L, (l) => l.ttc), sens), teinte: sens === "entree" ? ENTREE : SORTIE };
    }),
    ...(perdus.length > 0 ? [{ cle: "perdus" as const, compte: "", nom: "Les tickets perdus", pastille: null, pieces: String(perdus.length), total: signeDuTotal(somme(perdus, (l) => l.ttc), "sortie"), teinte: SORTIE }] : []),
    ...(avecUnFichier > 0 ? [{ cle: "photos" as const, compte: "", nom: "Les photos et les factures", pastille: null, pieces: String(avecUnFichier), total: "", teinte: ENCRE }] : []),
  ];
  // Les pages des sections ne sont connues qu'après : la première page les lit
  // au moment d'écrire leurs numéros.
  const pageDe = new Map<Section["cle"], PDFPage>();
  couverture(c, d, sections, pageDe);
  if (aUnRegistre) pageDe.set("ventes", registre(c, d));
  let derniere: PageDuReleve | null = null;
  for (const k of cles) {
    const lu = categorie(c, d, k, lignesDe(k), liaisons, vignettes);
    pageDe.set(k, lu.premiere);
    fermer(c, lu.derniere);
    derniere = lu.derniere;
  }
  const pagePerdus = ticketsPerdus(c, perdus, derniere);
  if (pagePerdus) pageDe.set("perdus", pagePerdus);
  const premierePhoto = await photos(c, cles.flatMap(lignesDe), liaisons);
  if (premierePhoto) pageDe.set("photos", premierePhoto);

  // ─── Les pieds de page, les numéros, puis les liens (toutes les pages existent)
  const pages = doc.getPages();
  const pied = ["Dossier justifié", d.entreprise.nom, entreLesDeux(d.du, d.au, true)].filter(Boolean).join(", ");
  pages.forEach((pg, i) => {
    ecrire(pg, pied, MARGE, 22, c.p.sans, 7.5, ENCRE, 380);
    ecrireADroite(pg, `Page ${i + 1} sur ${pages.length}`, LARGEUR - MARGE, 22, c.p.sans, 7.5, ENCRE);
  });
  for (const f of c.apres) f();
  poserLiens(doc, c.liens);
  const pageDeLaCategorie: Partial<Record<CleCompta, number>> = {};
  for (const k of cles) pageDeLaCategorie[k] = numero(c, pageDe.get(k)!);
  if (aUnRegistre) pageDeLaCategorie.ventes = numero(c, pageDe.get("ventes")!);
  return { pdf: await doc.save(), pageDe: pageDeLaCategorie };
}
