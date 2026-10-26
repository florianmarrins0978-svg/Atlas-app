import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage, type PDFEmbeddedPage } from "pdf-lib";
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
  type Categorie,
  type Motif,
} from "@/lib/pour-mon-comptable";

/**
 * LE DOSSIER DU COMPTABLE, EN PDF — lot 3 de « Pour mon comptable ».
 *
 * Ses choix du 24 octobre 2026 (`TODO.md`) : **côte à côte**, la ligne de
 * banque à gauche et sa pièce réécrite à droite, le total de la pièce
 * surligné en bleu gris ; un bouton « Voir la photo » vers les vraies photos
 * rangées TOUT AU BOUT, chacune avec « Retour à la ligne » ; les sorties en
 * rouge et les entrées en vert (son choix B). Modèle : `docs/maquettes/
 * dossier-justifie/modele.html`, imprimé en `appli/dossier-justifie-exemple-
 * cote-a-cote.pdf`.
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
  | { genre: "facture-emise"; numero: string };

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
const ORIGINE = charte("origine").jetons;

function couleur(hex: string) {
  const n = hex.replace("#", "");
  return rgb(parseInt(n.slice(0, 2), 16) / 255, parseInt(n.slice(2, 4), 16) / 255, parseInt(n.slice(4, 6), 16) / 255);
}

const ENCRE = couleur("#1c1c1a");
const DOUX = couleur("#4a4a44");
const GRIS = couleur("#8a8578");
const FILET = couleur("#e4e0d6");
const PAPIER = couleur("#f3f1eb");
const OR = couleur("#B98B47");
const SURLIGNE = couleur(couleursDocument.surligne);
const SORTIE = couleur(ORIGINE.montantSortie);
const ENTREE = couleur(ORIGINE.montantEntree);
const COULEUR_CAT: Record<Categorie, ReturnType<typeof rgb>> = {
  carburant: couleur(ORIGINE.catCarburant),
  repas: couleur(ORIGINE.catRepas),
  materiel: couleur(ORIGINE.catMateriel),
  hotel: couleur(ORIGINE.catHotel),
  transport: couleur(ORIGINE.catTransport),
  autre: couleur(ORIGINE.catAutre),
  virement: couleur(ORIGINE.catVirement),
  recu: couleur(ORIGINE.catRecu),
};

type Polices = { sans: PDFFont; gras: PDFFont; serif: PDFFont; mono: PDFFont; monoGras: PDFFont };

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

const signe = (l: LignePourLeDossier) => `${l.sens === "entree" ? "+" : "-"}${enEuros(l.montant)}`;
const centimes = (m: string) => Math.round(Number(m) * 100);

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

function enTete(page: PDFPage, p: Polices, titre: string, sousTitre: string) {
  page.drawText(papier(titre), { x: MARGE, y: HAUTEUR - MARGE - 22, size: 22, font: p.serif, color: ENCRE });
  ecrireADroite(page, sousTitre.toUpperCase(), LARGEUR - MARGE, HAUTEUR - MARGE - 18, p.gras, 7.5, OR);
  page.drawLine({ start: { x: MARGE, y: HAUTEUR - MARGE - 32 }, end: { x: LARGEUR - MARGE, y: HAUTEUR - MARGE - 32 }, thickness: 0.6, color: FILET });
}

/** La pièce réécrite, dans son cadre, le total surligné en bleu gris. Rend la hauteur prise. */
function dessinerPiece(page: PDFPage, p: Polices, piece: PieceDeLaLigne, x: number, yHaut: number, largeur: number): number {
  const h = 118;
  page.drawRectangle({ x, y: yHaut - h, width: largeur, height: h, color: rgb(1, 1, 1), borderColor: FILET, borderWidth: 0.6 });
  const centre = (t: string, y: number, police: PDFFont, taille: number) => {
    const s = ajuste(t, police, taille, largeur - 16);
    page.drawText(s, { x: x + (largeur - police.widthOfTextAtSize(s, taille)) / 2, y, size: taille, font: police, color: ENCRE });
  };
  const ligne = (g: string, d: string, y: number, police = p.mono, taille = 7.5) => {
    ecrire(page, g, x + 9, y, police, taille, ENCRE, largeur - 80);
    ecrireADroite(page, d, x + largeur - 9, y, police, taille);
  };
  let y = yHaut - 16;
  if (piece.genre === "ticket") {
    centre(piece.fournisseur.toUpperCase(), y, p.monoGras, 8.5);
    y -= 12;
    centre(jourComplet(piece.date), y, p.mono, 7.5);
    y -= 22;
    page.drawRectangle({ x: x + 5, y: y - 4, width: largeur - 10, height: 14, color: SURLIGNE });
    ligne("TOTAL TTC", piece.totalTtc ? enEuros(piece.totalTtc) : "non lu", y, p.monoGras, 8.5);
    y -= 14;
    if (piece.tva) ligne("dont TVA", enEuros(piece.tva), y);
  } else if (piece.genre === "facture") {
    ecrire(page, piece.societe, x + 9, y, p.serif, 10, ENCRE, largeur - 18);
    y -= 13;
    ecrire(page, piece.nom, x + 9, y, p.sans, 7.5, DOUX, largeur - 18);
    y -= 26;
    page.drawRectangle({ x: x + 5, y: y - 4, width: largeur - 10, height: 14, color: SURLIGNE });
    ligne("Total TTC", piece.totalTtc ? enEuros(piece.totalTtc) : "non lu", y, p.gras, 8.5);
  } else {
    centre("Facture émise par Atlas", y, p.gras, 8.5);
    y -= 14;
    centre(piece.numero, y, p.mono, 8);
  }
  return h;
}

/** L'interligne d'un ticket recopié : celui d'un ticket de caisse, serré mais lisible. */
const PAS_TICKET = 9.5;
/** Le bas utile d'une page du relevé. */
const BAS = MARGE + 20;
/** Le haut d'une page du relevé, sous son en-tête. */
const HAUT = HAUTEUR - MARGE - 52;

type LigneDePiece = { g: string; d: string | null; surligne: boolean };

/**
 * Les lignes d'un ticket recopié, celle du total surlignée (`ligneDuTotal`).
 * Quand aucune ligne ne tombe juste sur le total, il s'ajoute à part, surligné :
 * jamais une ligne prise au hasard.
 */
function lignesDuTicket(piece: Extract<PieceDeLaLigne, { genre: "ticket" }>): LigneDePiece[] | null {
  if (!piece.lignes || piece.lignes.length === 0) return null;
  const total = ligneDuTotal(piece.lignes, piece.totalTtc ? Number(piece.totalTtc) : null);
  const lignes = piece.lignes.map((l, k) => ({ g: l.gauche, d: l.droite, surligne: k === total }));
  if (total < 0) lignes.push({ g: "TOTAL TTC", d: piece.totalTtc ? enEuros(piece.totalTtc) : "non lu", surligne: true });
  return lignes;
}

const hauteurRecopie = (n: number) => 20 + n * PAS_TICKET;

/** Un morceau de ticket recopié, dans son cadre. Rend la hauteur prise. */
function dessinerTicketRecopie(page: PDFPage, p: Polices, lignes: LigneDePiece[], x: number, yHaut: number, largeur: number): number {
  const h = hauteurRecopie(lignes.length);
  page.drawRectangle({ x, y: yHaut - h, width: largeur, height: h, color: rgb(1, 1, 1), borderColor: FILET, borderWidth: 0.6 });
  let y = yHaut - 14;
  for (const l of lignes) {
    const police = l.surligne ? p.monoGras : p.mono;
    if (l.surligne) page.drawRectangle({ x: x + 5, y: y - 3, width: largeur - 10, height: PAS_TICKET + 1, color: SURLIGNE });
    const droite = l.d ? papier(l.d) : "";
    const place = largeur - 18 - (droite ? police.widthOfTextAtSize(droite, 7) + 6 : 0);
    if (l.g) ecrire(page, l.g, x + 9, y, police, 7, ENCRE, place);
    if (droite) ecrireADroite(page, droite, x + largeur - 9, y, police, 7);
    y -= PAS_TICKET;
  }
  return h;
}

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

export async function composerDossierComptable(d: DonneesDossier): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(texteDuPapier(`Dossier justifié du ${jourComplet(d.du)} au ${jourComplet(d.au)}`));
  doc.setAuthor(texteDuPapier(d.entreprise.nom));
  doc.setCreator("Atlas");
  const p: Polices = {
    sans: await doc.embedFont(StandardFonts.Helvetica),
    gras: await doc.embedFont(StandardFonts.HelveticaBold),
    serif: await doc.embedFont(StandardFonts.TimesRoman),
    mono: await doc.embedFont(StandardFonts.Courier),
    monoGras: await doc.embedFont(StandardFonts.CourierBold),
  };
  const liens: Lien[] = [];
  const sorties = d.lignes.filter((l) => l.sens === "sortie").reduce((s, l) => s + centimes(l.montant), 0);
  const entrees = d.lignes.filter((l) => l.sens === "entree").reduce((s, l) => s + centimes(l.montant), 0);
  const perdus = d.lignes.filter((l) => l.ticketPerdu);
  // Les tickets d'abord, six par page ; les factures ensuite, une page chacune.
  // Mêlés, un ticket après une facture rouvrirait une page pour lui seul.
  const aUnFichier = (l: LignePourLeDossier) => (l.piece?.genre === "ticket" && l.piece.photo) || (l.piece?.genre === "facture" && l.piece.fichier);
  const avecFichier = [...d.lignes.filter((l) => l.piece?.genre === "ticket" && aUnFichier(l)), ...d.lignes.filter((l) => l.piece?.genre === "facture" && aUnFichier(l))];

  // ─── 1. La couverture ─────────────────────────────────────────────────────
  const couv = doc.addPage([LARGEUR, HAUTEUR]);
  ecrire(couv, "POUR MON COMPTABLE", MARGE, HAUTEUR - 90, p.gras, 8, OR);
  couv.drawText("Dossier justifié", { x: MARGE, y: HAUTEUR - 140, size: 38, font: p.serif, color: ENCRE });
  ecrire(couv, `Du ${jourComplet(d.du)} au ${jourComplet(d.au)}`, MARGE, HAUTEUR - 172, p.serif, 18, DOUX);
  couv.drawLine({ start: { x: MARGE, y: HAUTEUR - 196 }, end: { x: LARGEUR - MARGE, y: HAUTEUR - 196 }, thickness: 1.2, color: OR });
  let y = HAUTEUR - 236;
  const bloc = (titre: string, lignes: string[], x: number) => {
    ecrire(couv, titre.toUpperCase(), x, y, p.gras, 7, GRIS);
    lignes.forEach((t, i) => ecrire(couv, t, x, y - 18 - i * 15, p.sans, 10.5, ENCRE, 230));
  };
  bloc("Entreprise", [d.entreprise.nom, d.entreprise.adresse ?? "", d.entreprise.siret ? `SIRET ${d.entreprise.siret}` : ""].filter(Boolean), MARGE);
  bloc("Relevé lu", [d.banque ? `${d.banque}, par Enable Banking` : "Relevé tenu à la main"], LARGEUR / 2 + 10);
  y -= 110;
  bloc(
    "Ce que contient ce dossier",
    [
      `${d.lignes.length} lignes de banque`,
      `${d.lignes.filter((l) => l.piece?.genre === "ticket").length} tickets, ${d.lignes.filter((l) => l.piece?.genre === "facture").length} factures de fournisseur`,
      `${d.lignes.filter((l) => l.piece?.genre === "facture-emise").length} virements reçus et leur facture`,
      `${perdus.length} tickets perdus, déclarés`,
    ],
    MARGE
  );
  couv.drawRectangle({ x: MARGE, y: 120, width: LARGEUR - 2 * MARGE, height: 64, color: PAPIER, borderColor: FILET, borderWidth: 0.6 });
  ecrire(couv, "Chaque ligne de la banque a son justificatif, ou sa mention de ticket perdu.", MARGE + 18, 158, p.sans, 10.5);
  ecrire(couv, `Rangé le ${jourComplet(d.rangeLe)}. Gardé jusqu'au ${jourComplet(d.gardeJusquAu)}.`, MARGE + 18, 138, p.sans, 8.5, GRIS);

  // ─── 2. L'année en un coup d'œil ──────────────────────────────────────────
  const resume = doc.addPage([LARGEUR, HAUTEUR]);
  enTete(resume, p, "En un coup d'œil", `${jourComplet(d.du)} au ${jourComplet(d.au)}`);
  y = HAUTEUR - MARGE - 70;
  const cases: [string, string, ReturnType<typeof rgb>][] = [
    ["Sorties", `-${enEuros(sorties / 100)}`, SORTIE],
    ["Entrées", `+${enEuros(entrees / 100)}`, ENTREE],
    ["Lignes de banque", String(d.lignes.length), ENCRE],
    ["Tickets perdus", String(perdus.length), SORTIE],
  ];
  const lc = (LARGEUR - 2 * MARGE - 30) / 4;
  cases.forEach(([t, v, c], i) => {
    const x = MARGE + i * (lc + 10);
    resume.drawRectangle({ x, y: y - 22, width: lc, height: 44, color: PAPIER });
    ecrire(resume, t.toUpperCase(), x + 8, y + 9, p.gras, 6.5, c === ENCRE ? GRIS : c, lc - 16);
    ecrire(resume, v, x + 8, y - 11, p.serif, 13, c, lc - 16);
  });
  y -= 60;
  ecrire(resume, "CATÉGORIE", MARGE, y, p.gras, 6.8, GRIS);
  ecrireADroite(resume, "MONTANT", LARGEUR - MARGE, y, p.gras, 6.8, GRIS);
  y -= 6;
  resume.drawLine({ start: { x: MARGE, y }, end: { x: LARGEUR - MARGE, y }, thickness: 0.8, color: ENCRE });
  for (const c of ORDRE_CATEGORIES) {
    const total = d.lignes.filter((l) => l.sens === "sortie" && l.categorie === c).reduce((s, l) => s + centimes(l.montant), 0);
    if (!total) continue;
    y -= 17;
    resume.drawCircle({ x: MARGE + 4, y: y + 3, size: 3.2, color: COULEUR_CAT[c] });
    ecrire(resume, c === "virement" ? "Virements envoyés" : NOM_CATEGORIE[c], MARGE + 14, y, p.sans, 9.5);
    ecrireADroite(resume, enEuros(total / 100), LARGEUR - MARGE, y, p.sans, 9.5, SORTIE);
  }

  // Les mois, avec la page de chacun : ces pages ne sont connues qu'après.
  const mois = [...new Set(d.lignes.map((l) => l.jour.slice(0, 7)))].sort();
  const pageDuMois = new Map<string, PDFPage>();
  y -= 34;
  ecrire(resume, "MOIS PAR MOIS", MARGE, y, p.gras, 6.8, GRIS);
  ecrireADroite(resume, "SORTIES", LARGEUR - MARGE - 190, y, p.gras, 6.8, SORTIE);
  ecrireADroite(resume, "ENTRÉES", LARGEUR - MARGE - 90, y, p.gras, 6.8, ENTREE);
  ecrireADroite(resume, "PAGE", LARGEUR - MARGE, y, p.gras, 6.8, GRIS);
  y -= 6;
  resume.drawLine({ start: { x: MARGE, y }, end: { x: LARGEUR - MARGE, y }, thickness: 0.8, color: ENCRE });
  const lignesDuSommaire: { m: string; y: number }[] = [];
  for (const m of mois) {
    y -= 17;
    const L = d.lignes.filter((l) => l.jour.startsWith(m));
    ecrire(resume, libellePeriode(m), MARGE, y, p.sans, 9.5);
    ecrireADroite(resume, `-${enEuros(L.filter((l) => l.sens === "sortie").reduce((s, l) => s + centimes(l.montant), 0) / 100)}`, LARGEUR - MARGE - 190, y, p.sans, 9.5, SORTIE);
    ecrireADroite(resume, `+${enEuros(L.filter((l) => l.sens === "entree").reduce((s, l) => s + centimes(l.montant), 0) / 100)}`, LARGEUR - MARGE - 90, y, p.sans, 9.5, ENTREE);
    lignesDuSommaire.push({ m, y });
    liens.push({ page: resume, x: MARGE, y: y - 4, l: LARGEUR - 2 * MARGE, h: 16, vers: () => ({ page: pageDuMois.get(m)!, y: HAUTEUR }) });
  }

  // ─── 3. Chaque mois, côte à côte ──────────────────────────────────────────
  const xPiece = LARGEUR - MARGE - 190;
  const lignePhoto = new Map<LignePourLeDossier, { page: PDFPage; y: number }>();
  const photoDeLaLigne = new Map<LignePourLeDossier, { page: PDFPage; y: number }>();
  for (const m of mois) {
    let page = doc.addPage([LARGEUR, HAUTEUR]);
    pageDuMois.set(m, page);
    enTete(page, p, libellePeriode(m), "Relevé et justificatifs");
    const L = d.lignes.filter((l) => l.jour.startsWith(m));
    y = HAUT;
    ecrire(page, `Sorties ${"-" + enEuros(L.filter((l) => l.sens === "sortie").reduce((s, l) => s + centimes(l.montant), 0) / 100)}`, MARGE, y, p.sans, 9, SORTIE);
    ecrire(page, `Entrées ${"+" + enEuros(L.filter((l) => l.sens === "entree").reduce((s, l) => s + centimes(l.montant), 0) / 100)}`, MARGE + 170, y, p.sans, 9, ENTREE);
    ecrire(page, `${L.length} lignes`, MARGE + 340, y, p.sans, 9, DOUX);
    y -= 16;
    for (const l of [...L].sort((a, b) => b.jour.localeCompare(a.jour))) {
      const haute = l.piece?.genre === "ticket" || l.piece?.genre === "facture";
      const recopie = l.piece?.genre === "ticket" ? lignesDuTicket(l.piece) : null;
      const fichier = l.piece?.genre === "ticket" ? l.piece.photo : l.piece?.genre === "facture" ? l.piece.fichier : null;
      const sousLaPiece = fichier ? 22 : 0;
      const hPiece = recopie ? hauteurRecopie(recopie.length) : 118;
      const h = haute ? Math.max(136, 6 + hPiece + sousLaPiece + 8) : 34;
      // Un long ticket commence là où il reste une vraie place, et continue
      // sur la page suivante : il n'est jamais coupé, ni réduit à un résumé.
      if (y - h < BAS && !(recopie && y - BAS >= 220)) {
        page = doc.addPage([LARGEUR, HAUTEUR]);
        enTete(page, p, libellePeriode(m), "Relevé et justificatifs, suite");
        y = HAUT;
      }
      const haut = y;
      const pageDeLaLigne = page;
      const yt = haute ? haut - 42 : haut - 16;
      ecrire(page, jourComplet(l.jour), MARGE + 12, yt + 13, p.sans, 8, DOUX, 200);
      ecrire(page, l.libelle, MARGE + 12, yt, p.mono, 8.2, ENCRE, haute ? xPiece - MARGE - 110 : 260);
      ecrire(page, NOM_CATEGORIE[l.categorie], MARGE + 12, yt - 12, p.sans, 8, COULEUR_CAT[l.categorie], 150);
      const mention = l.ticketPerdu
        ? "Ticket perdu, mention validée. TVA non déduite."
        : l.motif
          ? libelleMotif(l.motif, l.sens)
          : l.piece?.genre === "facture-emise"
            ? `Facture ${l.piece.numero}`
            : null;
      if (mention) ecrire(page, mention, MARGE + 170, yt - 12, p.sans, 8, l.ticketPerdu ? SORTIE : DOUX, 230);
      ecrireADroite(page, signe(l), haute ? xPiece - 12 : LARGEUR - MARGE, yt, p.serif, haute ? 13 : 11, l.sens === "entree" ? ENTREE : SORTIE);

      let bas = haut - h;
      if (haute && l.piece) {
        lignePhoto.set(l, { page, y: haut });
        let yPiece = haut - 6;
        if (recopie) {
          let reste = recopie;
          while (reste.length > 0) {
            const tiennent = Math.max(1, Math.floor((yPiece - BAS - sousLaPiece - 8 - 20) / PAS_TICKET));
            const morceau = reste.slice(0, tiennent);
            reste = reste.slice(tiennent);
            yPiece -= dessinerTicketRecopie(page, p, morceau, xPiece, yPiece, 190);
            if (reste.length > 0) {
              page = doc.addPage([LARGEUR, HAUTEUR]);
              enTete(page, p, libellePeriode(m), "Relevé et justificatifs, suite");
              ecrire(page, `Suite du ticket du ${jourComplet(l.jour)}`, MARGE + 12, HAUT - 16, p.sans, 8, DOUX, 200);
              ecrire(page, l.libelle, MARGE + 12, HAUT - 29, p.mono, 8.2, ENCRE, xPiece - MARGE - 30);
              yPiece = HAUT - 6;
            }
          }
        } else {
          yPiece -= dessinerPiece(page, p, l.piece, xPiece, yPiece, 190);
        }
        if (fichier) {
          const yb = yPiece - 14;
          ecrire(page, "Voir la photo", xPiece + 62, yb + 3, p.gras, 8, couleur("#2f3b2f"));
          page.drawRectangle({ x: xPiece, y: yb - 2, width: 190, height: 14, borderColor: FILET, borderWidth: 0.6 });
          liens.push({ page, x: xPiece, y: yb - 2, l: 190, h: 14, vers: () => photoDeLaLigne.get(l)! });
        }
        const basPiece = yPiece - sousLaPiece - 8;
        bas = page === pageDeLaLigne ? Math.min(haut - h, basPiece) : basPiece;
      }
      if (page === pageDeLaLigne) page.drawRectangle({ x: MARGE, y: bas + 8, width: 3, height: haut - bas - 16, color: COULEUR_CAT[l.categorie] });
      page.drawLine({ start: { x: MARGE, y: bas }, end: { x: LARGEUR - MARGE, y: bas }, thickness: 0.5, color: FILET });
      y = bas;
    }
  }

  // ─── 4. Les tickets perdus ────────────────────────────────────────────────
  if (perdus.length) {
    const page = doc.addPage([LARGEUR, HAUTEUR]);
    enTete(page, p, "Les tickets perdus", `${perdus.length} ligne${perdus.length > 1 ? "s" : ""}`);
    y = HAUTEUR - MARGE - 60;
    for (const l of perdus) {
      ecrire(page, jourComplet(l.jour), MARGE, y, p.sans, 9, DOUX, 110);
      ecrire(page, l.libelle, MARGE + 115, y, p.mono, 8.2, ENCRE, 260);
      ecrireADroite(page, signe(l), LARGEUR - MARGE, y, p.serif, 11, SORTIE);
      y -= 18;
    }
    y -= 10;
    ecrire(page, "Ces dépenses restent dans le relevé, avec leur mention. Leur TVA n'a pas été déduite, faute de ticket.", MARGE, y, p.sans, 9, DOUX);
  }

  // ─── 5. Les vraies photos, tout au bout ───────────────────────────────────
  // Six tickets par page ; une facture, une page entière pour rester lisible.
  let pagePhotos: PDFPage | null = null;
  let rang = 0;
  for (const l of avecFichier) {
    const fichier = l.piece?.genre === "ticket" ? l.piece.photo! : l.piece?.genre === "facture" ? l.piece.fichier! : null;
    if (!fichier) continue;
    const pleinePage = l.piece?.genre === "facture";
    if (pleinePage || !pagePhotos || rang === 6) {
      pagePhotos = doc.addPage([LARGEUR, HAUTEUR]);
      enTete(pagePhotos, p, "Les photos des justificatifs", pleinePage ? "Facture" : "Tickets");
      rang = 0;
    }
    const col = pleinePage ? 0 : rang % 3;
    const rangee = pleinePage ? 0 : Math.floor(rang / 3);
    const lw = pleinePage ? LARGEUR - 2 * MARGE : (LARGEUR - 2 * MARGE - 24) / 3;
    const lh = pleinePage ? HAUTEUR - 2 * MARGE - 110 : 300;
    const x = MARGE + col * (lw + 12);
    const yHaut = HAUTEUR - MARGE - 50 - rangee * (lh + 40);
    ecrire(pagePhotos, `${jourComplet(l.jour)}, ${signe(l)}`, x, yHaut - 10, p.gras, 8, ENCRE, lw);
    const cadre = { x, y: yHaut - 20 - lh + 24, w: lw, h: lh - 24 };
    pagePhotos.drawRectangle({ x: cadre.x, y: cadre.y, width: cadre.w, height: cadre.h, color: PAPIER });
    const pose = await embarquer(doc, fichier);
    if (pose) {
      const echelle = Math.min(cadre.w / pose.objet.width, cadre.h / pose.objet.height);
      const w = pose.objet.width * echelle;
      const hh = pose.objet.height * echelle;
      const pos = { x: cadre.x + (cadre.w - w) / 2, y: cadre.y + (cadre.h - hh) / 2, width: w, height: hh };
      if (pose.genre === "image") pagePhotos.drawImage(pose.objet, pos);
      else pagePhotos.drawPage(pose.objet, pos);
    } else {
      ecrire(pagePhotos, "Photo non lisible ici, gardée dans Atlas", cadre.x + 8, cadre.y + cadre.h / 2, p.sans, 8, GRIS, cadre.w - 16);
    }
    photoDeLaLigne.set(l, { page: pagePhotos, y: yHaut + 10 });
    const yb = cadre.y - 18;
    pagePhotos.drawRectangle({ x, y: yb, width: lw, height: 14, borderColor: FILET, borderWidth: 0.6 });
    ecrire(pagePhotos, `Retour à la ligne du ${jourEnMots(l.jour)}`, x + 8, yb + 4, p.gras, 7.5, couleur("#2f3b2f"), lw - 16);
    const page = pagePhotos;
    liens.push({ page, x, y: yb, l: lw, h: 14, vers: () => lignePhoto.get(l)! });
    rang += 1;
    if (pleinePage) pagePhotos = null;
  }

  // ─── Les numéros de page, puis les liens (toutes les pages existent) ──────
  const pages = doc.getPages();
  pages.forEach((pg, i) => {
    ecrire(pg, `Dossier justifié, ${d.entreprise.nom}`, MARGE, 22, p.sans, 7, GRIS, 300);
    ecrireADroite(pg, `Page ${i + 1} sur ${pages.length}`, LARGEUR - MARGE, 22, p.sans, 7, GRIS);
  });
  for (const { m, y: yl } of lignesDuSommaire) {
    ecrireADroite(resume, String(pages.indexOf(pageDuMois.get(m)!) + 1), LARGEUR - MARGE, yl, p.sans, 9.5, GRIS);
  }
  poserLiens(doc, liens);
  return doc.save();
}
