/**
 * LE PDF D'UN PLAN D'ARROSAGE ENREGISTRÉ — sa planche du 21 novembre 2026
 * (`appli/arrosage-dossiers.html`, « Le PDF »), et ses quatre demandes du soir :
 *
 *   · *« voir les réseaux en grand »* : un réseau par page, à la fois en
 *     couleur et avec ses pièces, *« qu'on voie la photo des pièces »* ;
 *   · *« mets des grandes pages pour toutes »* : A4 droit partout ;
 *   · *« ce qui n'est pas calculé, tu me l'enlèves »* : aucune réserve, et la
 *     phrase « Nous ne garantissons pas… » retirée aussi ;
 *   · *« supprime les petites phrases en gris »* : aucun pied de page.
 *
 * Et le lendemain : *« agrandis le plan d'arrosage où il n'y a pas la photo des
 * pièces »*, voir `disposerLeMilieu` ; et *« il manque la nourrice »*, voir
 * `pageDeLaNourrice`.
 *
 * Page 1 : l'entreprise, le dossier, la date, le résumé, la légende. Page 2 :
 * la nourrice, d'où tout part, son éclaté vu du dessus et ses pièces (pas de
 * page au nez de robinet, qui n'en a pas). Puis un réseau par page : son nom, son matériel et son tuyau en haut ; le réseau en
 * couleur sur la largeur de la page, puis le dessin de ses pièces, partageant
 * ce qu'il reste ; une tête de bas en haut en bas. Puis la liste des pièces.
 *
 * **Archivé à l'enregistrement, jamais reconstruit** (comme la facture) : ce
 * fichier ne tourne qu'une fois par version. Il ne porte pas les prix d'achat
 * de l'artisan : il est fait pour être envoyé.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, popGraphicsState, pushGraphicsState, setCharacterSpacing, type PDFFont, type PDFImage, type PDFPage, type RGB } from "pdf-lib";
import { colors, couleursDocument } from "@/lib/design-tokens";
import type { LigneDuReseau } from "@/lib/arrosage/lignes-du-reseau";
import type { Maillon, PlanDesPieces, Poste } from "@/lib/arrosage/postes";
import { pourLePapier } from "@/lib/texte-pdf";
import { couleurPourLePapier, tracerSvg, type NoeudSvg } from "./svg-vers-pdf";
import { FICHIER_DES_PLACES, type PlaceSurLaPhoto } from "@/lib/arrosage/nourrice-en-photo";

export type SegmentDeTexte = { gras: boolean; texte: string };

/** Une ligne de pièces numérotée : son numéro est posé sur chaque photo de la même page. */
export type LigneNumerotee = { numero: number; ref: string; quantite: string | null; nom: string; retiree?: boolean; photo?: string | null };

export type ReseauDuPdf = {
  titre: string;
  couleur: string;
  /** « Pelouse arrière, 12 m sur 12 m », une par zone arrosée. */
  zones: string[];
  lignes: LigneDuReseau[];
  /** Le réseau en couleur, tel que `PlanDessine` le dessine ; `null` sans dessin. */
  plan: NoeudSvg | null;
  tuyau: { poste: Poste; texte: string };
  pieces: PlanDesPieces | null;
  rail: Poste[];
  ajoutees: Poste[];
  chaine: Maillon[] | null;
  /** Ses pièces, numérotées comme son groupe de la liste ; `numeros` : la référence vers son numéro. */
  liste: LigneNumerotee[];
  numeros: Record<string, number>;
};

export type DonneesPdfDuPlan = {
  entreprise: string;
  dossier: string;
  /** « 21 novembre 2026 » */
  date: string;
  resume: string;
  legende: { symbole: NoeudSvg; texte: SegmentDeTexte[] }[];
  /**
   * La page de la nourrice, ou `null` au nez de robinet. `photo` : son éclaté vu
   * du dessus, sous `public/` ; `places` : sa clé dans `places.json`.
   * `numerotees` : ce que la photo montre, numéroté ; `avec` : le reste.
   */
  nourrice: { titre: string; phrase: string; photo: string; places: string; numerotees: LigneNumerotee[]; avec: { quantite: string; nom: string }[] } | null;
  reseaux: ReseauDuPdf[];
  groupes: { titre: string; lignes: { quantite: string; nom: string }[] }[];
};

const A4 = { largeur: 595.28, hauteur: 841.89 };
const MARGE = 42;
const UTILE = A4.largeur - 2 * MARGE;
const BAS = MARGE;

/** Les teintes du papier : celles des documents, et la valeur de repli de l'écran pour le reste. */
function teinte(valeur: string): { couleur: RGB; opacite: number } {
  const t = couleurPourLePapier(valeur);
  if (!t) throw new Error(`Teinte illisible pour le papier : ${valeur}`);
  return t;
}
const ENCRE = teinte(couleursDocument.encre).couleur;
const ETIQUETTE = teinte(couleursDocument.etiquette).couleur;
const OR = teinte(couleursDocument.accent).couleur;
const PAPIER = teinte(couleursDocument.papier).couleur;
const OR_TEXTE = teinte(colors.orTexte).couleur;
const FILET = teinte(colors.line);

type Polices = { texte: PDFFont; gras: PDFFont; titres: PDFFont };

const papier = (s: string) => pourLePapier(s).texte;

/** Coupe un texte en lignes qui tiennent dans `largeur`. Un mot plus long que la ligne y reste seul. */
function couper(texte: string, police: PDFFont, taille: number, largeur: number): string[] {
  const lignes: string[] = [];
  let courante = "";
  for (const mot of papier(texte).split(/\s+/).filter(Boolean)) {
    const essai = courante ? `${courante} ${mot}` : mot;
    if (courante && police.widthOfTextAtSize(essai, taille) > largeur) {
      lignes.push(courante);
      courante = mot;
    } else courante = essai;
  }
  if (courante) lignes.push(courante);
  return lignes;
}

/** Un surtitre en capitales espacées, dans l'or : « LES PIÈCES ». */
function rubrique(page: PDFPage, texte: string, x: number, y: number, p: Polices): number {
  // D'un seul tenant, l'espacement réglé dans le PDF : tracé lettre à lettre, le
  // mot ne se cherchait plus et un lecteur d'écran l'épelait.
  page.pushOperators(pushGraphicsState(), setCharacterSpacing(1.3));
  page.drawText(papier(texte.toUpperCase()), { x, y, size: 7.5, font: p.gras, color: OR });
  page.pushOperators(popGraphicsState());
  return y - 14;
}

/** Les photos des pièces, lues une fois par document dans `public/`, comme l'écran les sert. */
class Photos {
  private cache = new Map<string, Promise<PDFImage | null>>();
  constructor(private doc: PDFDocument) {}
  lire(chemin: string | null): Promise<PDFImage | null> {
    if (!chemin) return Promise.resolve(null);
    let p = this.cache.get(chemin);
    if (!p) {
      p = (async () => {
        const nom = path.normalize(chemin).replace(/^([/\\])+/, "");
        // Une photo de pièce vit sous `public/arrosage-photos/`, et nulle part ailleurs.
        if (!nom.startsWith(`arrosage-photos${path.sep}`)) return null;
        const octets = await readFile(path.join(process.cwd(), "public", nom));
        return /\.png$/i.test(nom) ? this.doc.embedPng(octets) : this.doc.embedJpg(octets);
      })();
      this.cache.set(chemin, p);
    }
    return p;
  }
}

/** Une vignette : la case claire de l'écran, la photo dedans, la buse au pied d'une tuyère. */
async function vignette(page: PDFPage, photos: Photos, poste: { photo: string | null; pied: string | null; retiree?: boolean }, x: number, yHaut: number, taille: number, cerne: RGB | null) {
  const opacite = poste.retiree ? 0.35 : 1;
  page.drawRectangle({
    x, y: yHaut - taille, width: taille, height: taille,
    color: PAPIER, opacity: opacite,
    ...(cerne ? { borderColor: cerne, borderOpacity: 1, borderWidth: 1.4 } : { borderColor: ENCRE, borderOpacity: 0.14, borderWidth: 0.5 }),
  });
  const image = await photos.lire(poste.photo);
  if (image) {
    const m = taille * 0.08;
    const echelle = Math.min((taille - 2 * m) / image.width, (taille - 2 * m) / image.height);
    const w = image.width * echelle, h = image.height * echelle;
    page.drawImage(image, { x: x + (taille - w) / 2, y: yHaut - taille + (taille - h) / 2, width: w, height: h, opacity: opacite });
  }
  const pied = await photos.lire(poste.pied);
  if (pied) {
    const t = taille * 0.55;
    const echelle = Math.min(t / pied.width, t / pied.height);
    page.drawImage(pied, { x: x + taille - t * 0.85, y: yHaut - taille - t * 0.15, width: pied.width * echelle, height: pied.height * echelle, opacity: opacite });
  }
}

/** Un libellé centré sous une vignette, sur plusieurs lignes s'il le faut. Rend sa hauteur. */
function legendeSous(page: PDFPage, texte: string, centre: number, y: number, largeur: number, p: Polices, taille = 7.5): number {
  const lignes = couper(texte, p.texte, taille, largeur);
  lignes.forEach((l, i) => {
    const w = p.texte.widthOfTextAtSize(l, taille);
    page.drawText(l, { x: centre - w / 2, y: y - (i + 1) * taille * 1.25, size: taille, font: p.texte, color: ETIQUETTE });
  });
  return lignes.length * taille * 1.25;
}

async function pageDeGarde(doc: PDFDocument, d: DonneesPdfDuPlan, p: Polices) {
  const page = doc.addPage([A4.largeur, A4.hauteur]);
  let y = A4.hauteur - MARGE;
  page.drawText(papier(d.entreprise), { x: MARGE, y: y - 11, size: 11, font: p.gras, color: ENCRE });
  page.drawText(papier(d.dossier), { x: MARGE, y: y - 26, size: 9.5, font: p.texte, color: ETIQUETTE });
  const titre = papier("Plan d’arrosage");
  page.drawText(titre, { x: A4.largeur - MARGE - p.titres.widthOfTextAtSize(titre, 24), y: y - 20, size: 24, font: p.titres, color: ENCRE });
  const date = papier(d.date);
  page.drawText(date, { x: A4.largeur - MARGE - p.texte.widthOfTextAtSize(date, 9.5), y: y - 36, size: 9.5, font: p.texte, color: ETIQUETTE });
  y -= 48;
  page.drawLine({ start: { x: MARGE, y }, end: { x: A4.largeur - MARGE, y }, thickness: 0.6, color: FILET.couleur, opacity: FILET.opacite });
  y -= 22;
  page.drawText(papier(d.resume), { x: MARGE, y, size: 10.5, font: p.texte, color: ENCRE });
  y -= 30;
  y = rubrique(page, "Lire les plans", MARGE, y, p);
  for (const l of d.legende) {
    tracerSvg(page, l.symbole, { gauche: MARGE + 2, haut: y + 9, largeur: 10, hauteur: 10 }, p);
    let x = MARGE + 20;
    for (const s of l.texte) {
      const t = papier(s.texte);
      const police = s.gras ? p.gras : p.texte;
      page.drawText(t, { x, y, size: 9.5, font: police, color: ENCRE });
      x += police.widthOfTextAtSize(t, 9.5);
    }
    y -= 18;
  }
}

/**
 * LES NUMÉROS — sa demande du 22 novembre 2026 : *« quand je suis sur la
 * nourrice, la liste des pièces en dessous, tout de suite je sais à quoi ça
 * correspond ; pareil pour le réseau 1, 2, 3 et 4 »*. Chaque page porte la liste
 * de SES pièces, numérotée, et le même numéro sur chaque photo de la page : la
 * pastille d'encre, le chiffre en blanc, celle de la légende de l'écran.
 */
function pastille(page: PDFPage, numero: number, cx: number, cy: number, rayon: number, p: Polices): void {
  page.drawCircle({ x: cx, y: cy, size: rayon, color: ENCRE });
  const texte = String(numero), taille = rayon * (texte.length > 1 ? 1.05 : 1.2);
  page.drawText(texte, { x: cx - p.gras.widthOfTextAtSize(texte, taille) / 2, y: cy - taille * 0.36, size: taille, font: p.gras, color: PAPIER });
}

/** Les numéros d'une photo, dans son coin haut droit, côte à côte, le premier à gauche. */
function pastillesDuCoin(page: PDFPage, numeros: number[], xDroite: number, yHaut: number, taille: number, p: Polices): void {
  const rayon = Math.max(4.2, Math.min(5.5, taille * 0.14));
  numeros.forEach((n, k) => pastille(page, n, xDroite - rayon * 0.55 - (numeros.length - 1 - k) * (2 * rayon + 1), yHaut - rayon * 0.55, rayon, p));
}

/**
 * Une ligne de liste : son numéro s'il en a un, sa photo si elle en porte une
 * (`photo` présent, même nul : la case reste), sa quantité en or, ce qu'elle
 * désigne. Sur une page de réseau, chaque ligne montre sa pièce : sa demande du
 * 22 novembre 2026, *« il faudrait mettre les pièces, les numéroter pour qu'on
 * les voie tout de suite »*.
 */
type LigneListe = { numero?: number; quantite: string | null; nom: string; retiree?: boolean; photo?: string | null };
const RETRAIT = 15;
const PHOTO_DE_LIGNE = 22;
const QUANTITE = 34;
const INTERLIGNE = 12.5;
const ECART_COLONNES = 18;

const retraitDe = (l: LigneListe) => (l.photo !== undefined ? RETRAIT + PHOTO_DE_LIGNE + 7 : RETRAIT);
const hauteurDeLaLigne = (l: LigneListe, largeur: number, p: Polices) => {
  const texte = couper(l.nom, p.texte, 9.5, largeur - retraitDe(l) - QUANTITE).length * INTERLIGNE + 2;
  return l.photo !== undefined ? Math.max(texte, PHOTO_DE_LIGNE + 5) : texte;
};
function hauteurDeLaListe(lignes: LigneListe[], largeur: number, p: Polices): number {
  return lignes.reduce((h, l) => h + hauteurDeLaLigne(l, largeur, p), 0);
}
async function ecrireLaListe(page: PDFPage, photos: Photos, lignes: LigneListe[], x: number, y: number, largeur: number, p: Polices): Promise<void> {
  for (const l of lignes) {
    const suivante = y - hauteurDeLaLigne(l, largeur, p);
    const avecPhoto = l.photo !== undefined;
    // Le numéro, et la photo, centrés sur la première ligne de texte.
    const milieu = y + 3.2;
    if (l.numero !== undefined) pastille(page, l.numero, x + 5, milieu, 5, p);
    if (avecPhoto) await vignette(page, photos, { photo: l.photo ?? null, pied: null, retiree: l.retiree }, x + RETRAIT - 2, milieu + PHOTO_DE_LIGNE / 2, PHOTO_DE_LIGNE, null);
    const xq = x + retraitDe(l);
    if (l.quantite) page.drawText(papier(l.quantite), { x: xq, y, size: 9.5, font: p.gras, color: OR_TEXTE });
    for (const morceau of couper(l.nom, p.texte, 9.5, largeur - retraitDe(l) - QUANTITE)) {
      const xn = xq + QUANTITE;
      page.drawText(morceau, { x: xn, y, size: 9.5, font: p.texte, color: l.retiree ? ETIQUETTE : ENCRE });
      // Une pièce qu'il a supprimée reste, barrée, comme à l'écran : son numéro est encore sur la photo.
      if (l.retiree) page.drawLine({ start: { x: xn, y: y + 3.2 }, end: { x: xn + p.texte.widthOfTextAtSize(morceau, 9.5), y: y + 3.2 }, thickness: 0.7, color: ETIQUETTE });
      y -= INTERLIGNE;
    }
    y = suivante;
  }
}

/** Des listes sous leur surtitre, chacune sur `colonnes` colonnes. */
type Section = { titre: string; lignes: LigneListe[] };
const enColonnes = (lignes: LigneListe[], n: number) => {
  const parColonne = Math.ceil(lignes.length / n);
  return Array.from({ length: n }, (_, k) => lignes.slice(k * parColonne, (k + 1) * parColonne));
};
function hauteurDesSections(sections: Section[], largeur: number, colonnes: number, p: Polices): number {
  const large = (largeur - (colonnes - 1) * ECART_COLONNES) / colonnes;
  return sections.reduce((h, s) => h + RUBRIQUE + (s.lignes.some((l) => l.photo !== undefined) ? 6 : 0) + Math.max(...enColonnes(s.lignes, colonnes).map((c) => hauteurDeLaListe(c, large, p))) + 8, 0);
}
async function ecrireLesSections(page: PDFPage, photos: Photos, sections: Section[], x: number, y: number, largeur: number, colonnes: number, p: Polices): Promise<void> {
  const large = (largeur - (colonnes - 1) * ECART_COLONNES) / colonnes;
  for (const s of sections) {
    const yListe = rubrique(page, s.titre, x, y, p) - (s.lignes.some((l) => l.photo !== undefined) ? 6 : 0);
    const parts = enColonnes(s.lignes, colonnes);
    for (const [k, c] of parts.entries()) await ecrireLaListe(page, photos, c, x + k * (large + ECART_COLONNES), yListe, large, p);
    y = yListe - Math.max(...parts.map((c) => hauteurDeLaListe(c, large, p))) - 8;
  }
}

/** Les places des pièces sur les photos de la nourrice, relevées par le script qui les prend. */
async function placesDeLaNourrice(cle: string): Promise<PlaceSurLaPhoto[]> {
  const toutes = JSON.parse(await readFile(path.join(process.cwd(), "public", FICHIER_DES_PLACES), "utf8")) as Record<string, PlaceSurLaPhoto[]>;
  const places = toutes[cle];
  if (!places) throw new Error(`Aucune place relevée pour la nourrice ${cle} : rejouer scripts/rendre-nourrice-eclatee.mts`);
  return places;
}

/**
 * Le numéro de chaque pièce posé sur la photo, à côté d'elle : à droite, sinon à
 * gauche, au-dessus, au-dessous, là où il ne couvre ni une autre pièce ni un
 * autre numéro. Les pièces du haut se touchent presque ; une pastille posée à
 * leur droite tomberait sur la voisine.
 *
 * **Et jamais à mi-chemin de deux pièces** : vu sur la première page, un « 8 »
 * posé entre deux électrovannes serrées se lisait aussi bien pour l'une que pour
 * l'autre. Une place n'est donc retenue que si la pastille est nettement plus
 * près de SA pièce que de toute autre ; sinon elle se pose dans le coin haut de
 * sa pièce, sur elle.
 */
function numeroterLaPhoto(page: PDFPage, places: PlaceSurLaPhoto[], numeros: Map<string, number>, cadre: { x: number; haut: number; largeur: number; hauteur: number }, p: Polices): void {
  const rayon = 6, air = 1.5;
  type Boite = { x0: number; x1: number; y0: number; y1: number };
  const boites = places.map((q) => ({ q, x0: cadre.x + q.x0 * cadre.largeur, x1: cadre.x + q.x1 * cadre.largeur, y1: cadre.haut - q.y0 * cadre.hauteur, y0: cadre.haut - q.y1 * cadre.hauteur }));
  const distance = (cx: number, cy: number, b: Boite) => Math.hypot(Math.max(b.x0 - cx, 0, cx - b.x1), Math.max(b.y0 - cy, 0, cy - b.y1));
  const posees: { x: number; y: number }[] = [];
  const dansLaPhoto = (cx: number, cy: number) => cx - rayon >= cadre.x && cx + rayon <= cadre.x + cadre.largeur && cy + rayon <= cadre.haut && cy - rayon >= cadre.haut - cadre.hauteur;
  const loinDesAutres = (cx: number, cy: number) => posees.every((o) => Math.hypot(o.x - cx, o.y - cy) >= 2 * rayon + 1);
  // À côté : hors de toute pièce, et au moins deux fois plus près de la sienne que de la plus proche des autres.
  const aCote = (cx: number, cy: number, sienne: Boite) =>
    dansLaPhoto(cx, cy) && loinDesAutres(cx, cy) &&
    boites.every((b) => b === sienne || distance(cx, cy, b) >= Math.max(rayon + 2, 2 * distance(cx, cy, sienne) + rayon));
  for (const b of boites) {
    const n = numeros.get(b.q.ref);
    if (n === undefined) continue;
    const mx = (b.x0 + b.x1) / 2, my = (b.y0 + b.y1) / 2;
    const essais = [[b.x1 + rayon + air, my], [b.x0 - rayon - air, my], [mx, b.y1 + rayon + air], [mx, b.y0 - rayon - air]];
    const coin = [Math.max(b.x0 + rayon, b.x1 - rayon), Math.min(b.y1 - rayon, Math.max(b.y0 + rayon, my))];
    const [cx, cy] = essais.find(([x, y]) => aCote(x, y, b)) ?? coin;
    posees.push({ x: cx, y: cy });
    pastille(page, n, cx, cy, rayon, p);
  }
}

/**
 * LA PAGE DE LA NOURRICE — sa demande du 22 novembre 2026 : *« ton plan
 * d'arrosage ne comprend pas la nourrice [...] prends la vue éclatée »*.
 *
 * L'éclaté est celui de la nourrice en 3D (`appli/nourrice-3d/`), photographié
 * du dessus pour chaque nourrice possible (`scripts/rendre-nourrice-eclatee.mts`) :
 * le serveur n'a pas de quoi dessiner de la 3D. Du dessus, chaque pièce est
 * séparée des autres, dans l'ordre du montage. Puis ses pièces, numérotées
 * comme sur la photo, et ce qui l'accompagne sans y figurer.
 *
 * La photo et la liste se posent côte à côte, ou la liste sous la photo, selon
 * ce qui donne la PLUS GRANDE photo : une nourrice d'une voie est haute et
 * étroite, une de six est presque carrée.
 */
async function pageDeLaNourrice(doc: PDFDocument, n: NonNullable<DonneesPdfDuPlan["nourrice"]>, p: Polices, photos: Photos) {
  const page = doc.addPage([A4.largeur, A4.hauteur]);
  let y = rubrique(page, "La nourrice", MARGE, A4.hauteur - MARGE - 8, p);
  page.drawText(papier(n.titre), { x: MARGE, y: y - 12, size: 20, font: p.titres, color: ENCRE });
  y -= 30;
  for (const l of couper(n.phrase, p.texte, 10, UTILE)) {
    page.drawText(l, { x: MARGE, y, size: 10, font: p.texte, color: ETIQUETTE });
    y -= 13;
  }
  y -= 10;

  const image = await photos.lire(n.photo);
  if (!image) throw new Error(`La photo de la nourrice n'est pas sous public/arrosage-photos : ${n.photo}`);
  const sections: Section[] = [{ titre: "Ses pièces", lignes: n.numerotees }];
  if (n.avec.length) sections.push({ titre: "Avec la nourrice", lignes: n.avec });
  const haut = y, dispo = y - BAS, COLONNE = 200;
  const echelle = (w: number, h: number) => Math.min(w / image.width, h / image.height);
  // Côte à côte : la liste dans sa colonne, la photo dans le reste.
  const cote = echelle(UTILE - COLONNE - ECART_COLONNES, dispo);
  // L'une sous l'autre : la liste sur deux colonnes, sous la photo.
  const dessous = echelle(UTILE, dispo - hauteurDesSections(sections, UTILE, 2, p) - ECART_COLONNES);

  const s = Math.max(cote, dessous);
  const w = image.width * s, h = image.height * s;
  const x = cote >= dessous ? MARGE : MARGE + (UTILE - w) / 2;
  page.drawImage(image, { x, y: haut - h, width: w, height: h });
  numeroterLaPhoto(page, await placesDeLaNourrice(n.places), new Map(n.numerotees.map((l) => [l.ref, l.numero])), { x, haut, largeur: w, hauteur: h }, p);
  if (cote >= dessous) await ecrireLesSections(page, photos, sections, MARGE + UTILE - COLONNE, haut - 8, COLONNE, 1, p);
  else await ecrireLesSections(page, photos, sections, MARGE, haut - h - ECART_COLONNES, UTILE, 2, p);
}

/** Les vignettes du dessin des pièces gardent la proportion de l'écran : 32 points pour un dessin de 322. */
const tailleDesVignettes = (largeur: number) => Math.max(16, Math.min(34, (32 / 322) * largeur));

/**
 * Ce que le dessin des pièces occupe à cette largeur, mesuré sur ce qu'il MONTRE :
 * ses zones et ses tuyaux (coupés au cadre, comme le traceur les coupe) et ses
 * vignettes. Posées sur un coin, les vignettes dépassent du dessin, et c'est ce
 * dépassement qui toucherait le plan du dessus ou la tête du dessous quand la
 * page se resserre. À l'inverse, le dessin garde 1,60 m de vide autour des têtes :
 * le compter prenait au plan une place où rien ne se dessine.
 *
 * Les écarts rendus sont comptés depuis le cadre du dessin : positifs quand ce qui
 * se voit en sort, négatifs quand il s'arrête avant.
 */
function encombrementDesPieces(pl: PlanDesPieces, largeur: number) {
  const hauteur = largeur * (pl.hauteur / pl.largeur);
  const taille = tailleDesVignettes(largeur);
  const k = largeur / pl.largeur;
  let gauche = Infinity, droite = -Infinity, dessus = Infinity, dessous = -Infinity;
  const englober = (x0: number, x1: number, y0: number, y1: number) => {
    gauche = Math.min(gauche, x0); droite = Math.max(droite, x1);
    dessus = Math.min(dessus, y0); dessous = Math.max(dessous, y1);
  };
  const dansLeCadre = (x: number, y: number) => {
    const cx = Math.min(largeur, Math.max(0, x * k)), cy = Math.min(hauteur, Math.max(0, y * k));
    englober(cx, cx, cy, cy);
  };
  for (const c of pl.contours) {
    for (const q of c.trim().split(/\s+/)) {
      const [x, y] = q.split(",").map(Number);
      dansLeCadre(x, y);
    }
  }
  for (const t of [...pl.traits, ...pl.antennes]) {
    dansLeCadre(t.x1, t.y1);
    dansLeCadre(t.x2, t.y2);
  }
  // La buse posée au pied d'une tuyère sort un peu de sa case.
  const pied = taille * 0.1;
  for (const pose of pl.poses) {
    const cx = (pose.gauche / 100) * largeur, cy = (pose.haut / 100) * hauteur;
    if (pose.egal) englober(cx - taille / 2, cx + taille / 2 + pied, cy - taille / 2, cy + taille / 2 + pied);
    if (pose.pieces.length) {
      const rangee = pose.pieces.length * taille + (pose.pieces.length - 1) * 2;
      const haut = cy - taille / 2 + (pose.egal ? taille * 1.12 : 0);
      englober(cx - rangee / 2, cx + rangee / 2 + pied, haut, haut + taille + pied);
    }
  }
  // Un dessin sans rien dedans garde son cadre.
  if (gauche > droite) englober(0, largeur, 0, hauteur);
  return { hauteur, taille, dessus: -dessus, dessous: dessous - hauteur, gauche: -gauche, droite: droite - largeur };
}

/** La plus grande largeur de dessin dont les vignettes tiennent entre les marges. */
function largeurMaxDesPieces(pl: PlanDesPieces): number {
  let bas = 0, haut = UTILE;
  for (let i = 0; i < 40; i++) {
    const w = (bas + haut) / 2;
    const e = encombrementDesPieces(pl, w);
    if (w + e.gauche + e.droite <= UTILE) bas = w;
    else haut = w;
  }
  return bas;
}

export type Boite = { gauche: number; haut: number; largeur: number; hauteur: number };

/** Le rail d'un goutte-à-goutte : des vignettes nommées, en rangées. */
const RAIL = { taille: 46, pas: 18, rangee: 40 };
const rangeesDuRail = (n: number) => Math.ceil(n / Math.max(1, Math.floor((UTILE - 20) / (RAIL.taille + RAIL.pas))));

/** Sous le plan en couleur : la place du surtitre « Les pièces », et de l'air au-dessus. */
const AVANT_LES_PIECES = 22;
const RUBRIQUE = 14;
/**
 * Quand la page manque de place, le plan en couleur rétrécit moins vite que le
 * dessin des pièces. À parts égales, il ne gagnait que deux tiers de sa taille
 * sur une pelouse carrée ; à 1,3, il la double (200 points avant, 411 sur le
 * jardin d'essai), et les photos des pièces gardent près de trente points.
 */
const PRIORITE_DU_PLAN = 1.3;

/**
 * LE MILIEU D'UNE PAGE DE RÉSEAU — sa demande du 22 novembre 2026 : *« les pages
 * où tu as la place, agrandis le plan d'arrosage où il n'y a pas la photo des
 * pièces. Et même sur celle où il n'y a pas vraiment la place, agrandis-le quand
 * même, parce que là il est tout petit. »*
 *
 * Le plan en couleur ne loge plus dans un coin de 200 points à côté du texte :
 * il prend la largeur de la page sous l'en-tête. Quand le dessin des pièces
 * laisse la place (un couloir, un goutte-à-goutte), il la garde entière ; quand
 * les deux ne tiennent pas, ils rétrécissent ensemble, le plan moins que les
 * pièces (`PRIORITE_DU_PLAN`) : il a demandé aussi à voir les photos des pièces.
 *
 * Pure, et c'est ce que `test-pdf-du-plan-arrosage.ts` éprouve : aucune boîte ne
 * sort de la zone, aucune ne touche la suivante. `occupe` est ce que le dessin
 * des pièces couvre vraiment, vignettes comprises.
 */
export function disposerLeMilieu(d: {
  /** Hauteur sur largeur du plan en couleur, lue sur sa `viewBox` ; `null` sans dessin. */
  proportionDuPlan: number | null;
  pieces: PlanDesPieces | null;
  /** Nombre de vignettes du rail d'un goutte-à-goutte, quand il n'y a pas de dessin des pièces. */
  rail: number;
  haut: number;
  bas: number;
}): { plan: Boite | null; rubrique: number; pieces: (Boite & { taille: number; occupe: Boite }) | null; rail: Boite | null } {
  const disponible = d.haut - d.bas - AVANT_LES_PIECES - RUBRIQUE;
  const largeurPieces = d.pieces ? largeurMaxDesPieces(d.pieces) : 0;
  const hauteurRail = !d.pieces && d.rail ? rangeesDuRail(d.rail) * (RAIL.taille + RAIL.rangee) : 0;
  const facteurDuPlan = (f: number) => Math.min(1, f * PRIORITE_DU_PLAN);
  const hauteurPlan = (f: number) => (d.proportionDuPlan === null ? 0 : facteurDuPlan(f) * UTILE * d.proportionDuPlan);
  const hauteurPieces = (f: number) => {
    if (!d.pieces) return hauteurRail;
    const e = encombrementDesPieces(d.pieces, f * largeurPieces);
    return e.dessus + e.hauteur + e.dessous;
  };
  // Le plus grand facteur qui loge les deux. Le rail ne rétrécit pas : ses
  // vignettes portent leur nom dessous, et il reste de la place sur sa page.
  let f = 1;
  if (hauteurPlan(1) + hauteurPieces(1) > disponible) {
    let bas = 0, haut = 1;
    for (let i = 0; i < 40; i++) {
      const m = (bas + haut) / 2;
      if (hauteurPlan(m) + hauteurPieces(m) <= disponible) bas = m;
      else haut = m;
    }
    f = bas;
  }

  let y = d.haut;
  let plan: Boite | null = null;
  if (d.proportionDuPlan !== null) {
    const largeur = facteurDuPlan(f) * UTILE;
    plan = { gauche: MARGE + (UTILE - largeur) / 2, haut: y, largeur, hauteur: hauteurPlan(f) };
    y -= plan.hauteur;
  }
  const rubrique = y - AVANT_LES_PIECES;
  y = rubrique - RUBRIQUE;

  let pieces: (Boite & { taille: number; occupe: Boite }) | null = null;
  let rail: Boite | null = null;
  if (d.pieces) {
    const largeur = f * largeurPieces;
    const e = encombrementDesPieces(d.pieces, largeur);
    const total = e.gauche + largeur + e.droite;
    const occupe = { gauche: MARGE + (UTILE - total) / 2, haut: y, largeur: total, hauteur: e.dessus + e.hauteur + e.dessous };
    pieces = { gauche: occupe.gauche + e.gauche, haut: y - e.dessus, largeur, hauteur: e.hauteur, taille: e.taille, occupe };
  } else if (hauteurRail) {
    rail = { gauche: MARGE, haut: y, largeur: UTILE, hauteur: hauteurRail };
  }
  return { plan, rubrique, pieces, rail };
}

/** Hauteur sur largeur d'un dessin, lue sur sa `viewBox`. */
function proportionDe(n: NoeudSvg): number {
  const [, , w, h] = String(n.props.viewBox ?? "0 0 100 100").split(/[\s,]+/).map(Number);
  return h / w;
}

/** Le numéro de la ligne qu'une photo montre : celle de la pièce qu'il a mise à la place, s'il l'a changée. */
function numerosDuPoste(r: ReseauDuPdf, poste: Poste): number[] {
  const n = r.numeros[poste.changee?.ref ?? poste.ref];
  return n === undefined ? [] : [n];
}

async function pageDuReseau(doc: PDFDocument, r: ReseauDuPdf, p: Polices, photos: Photos) {
  const page = doc.addPage([A4.largeur, A4.hauteur]);
  const couleur = couleurPourLePapier(r.couleur)?.couleur ?? ENCRE;
  const haut = A4.hauteur - MARGE;

  // En haut : le nom, la zone, le matériel, le tuyau, sur toute la largeur.
  const largeurTexte = UTILE;
  let y = haut;
  page.drawRectangle({ x: MARGE, y: y - 15, width: 9, height: 9, color: couleur });
  page.drawText(papier(r.titre), { x: MARGE + 15, y: y - 17, size: 20, font: p.titres, color: ENCRE });
  y -= 32;
  for (const zone of r.zones) {
    for (const l of couper(zone, p.texte, 10, largeurTexte)) {
      page.drawText(l, { x: MARGE, y, size: 10, font: p.texte, color: ETIQUETTE });
      y -= 13;
    }
  }
  y -= 4;
  for (const l of r.lignes) {
    const xTexte = MARGE + (l.quantite ? 34 : 0);
    if (l.quantite) page.drawText(papier(l.quantite), { x: MARGE, y, size: 9.5, font: p.gras, color: OR_TEXTE });
    for (const morceau of couper(l.texte, p.texte, 9.5, largeurTexte - (xTexte - MARGE))) {
      page.drawText(morceau, { x: xTexte, y, size: 9.5, font: p.texte, color: ENCRE });
      y -= 12.5;
    }
    y -= 2;
  }
  y -= 4;
  await vignette(page, photos, r.tuyau.poste, MARGE, y + 6, 22, null);
  pastillesDuCoin(page, numerosDuPoste(r, r.tuyau.poste), MARGE + 22, y + 6, 22, p);
  page.drawText(papier(r.tuyau.texte), { x: MARGE + 28, y: y - 9, size: 9, font: p.texte, color: ETIQUETTE });
  y -= 22;

  // En bas : une tête, de bas en haut. Posée d'abord, pour savoir ce qu'il reste au milieu.
  let basDesPieces = BAS;
  if (r.chaine) {
    const taille = 40;
    const pas = UTILE / r.chaine.length;
    // La place des libellés qu'elle porte vraiment : en réserver cinq lignes
    // prenait au plan trois lignes vides sur chaque page.
    const lignes = Math.max(...r.chaine.map((m) => couper(m.libelle, p.texte, 7.5, pas - 8).length));
    const hauteurChaine = 14 + taille + lignes * 7.5 * 1.25 + 4;
    const yChaine = BAS + hauteurChaine;
    rubrique(page, "Une tête, de bas en haut", MARGE, yChaine, p);
    // « + » là où ça se visse, la double flèche là où le PEBD s'emboîte (`PiecesDuReseau`).
    const liens: ("visse" | "emboite")[] = ["visse", "emboite", "emboite", "visse"];
    for (const [i, m] of r.chaine.entries()) {
      const centre = MARGE + pas * i + pas / 2;
      await vignette(page, photos, { photo: m.photo, pied: m.pied, retiree: m.etat === "retiree" }, centre - taille / 2, yChaine - 14, taille, null);
      pastillesDuCoin(page, m.refs.map((ref) => r.numeros[ref]).filter((n): n is number => n !== undefined), centre + taille / 2, yChaine - 14, taille, p);
      legendeSous(page, m.libelle, centre, yChaine - 16 - taille, pas - 8, p);
      if (i < liens.length) {
        const xl = MARGE + pas * (i + 1);
        const yl = yChaine - 14 - taille / 2;
        if (liens[i] === "visse") page.drawText("+", { x: xl - 3, y: yl - 4, size: 12, font: p.gras, color: ETIQUETTE });
        else page.drawSvgPath("M1 6H15M1 6l4-4M1 6l4 4M15 6l-4-4M15 6l-4 4", { x: xl - 8, y: yl + 6, scale: 1, borderColor: ETIQUETTE, borderWidth: 1.2 });
      }
    }
    basDesPieces = yChaine + 18;
  }

  // SES pièces, numérotées comme sur les photos de la page : leur place est
  // réservée au-dessus de la tête, et elles se posent juste sous le dessin des
  // pièces. Collées en bas, elles restaient loin du rail d'un goutte-à-goutte.
  const sections: Section[] = r.liste.length ? [{ titre: "Ses pièces", lignes: r.liste }] : [];
  const hauteurDeLaListe = sections.length ? hauteurDesSections(sections, UTILE, 2, p) + 20 : 0;
  const hautDeLaReserve = basDesPieces + hauteurDeLaListe;

  // Au milieu : le réseau dans le jardin, puis le dessin de ses pièces, ses photos posées à leur place.
  const pieces = [...r.rail, ...r.ajoutees];
  const milieu = disposerLeMilieu({
    proportionDuPlan: r.plan ? proportionDe(r.plan) : null,
    pieces: r.pieces,
    rail: pieces.length,
    haut: y - 8,
    bas: hautDeLaReserve,
  });
  if (r.plan && milieu.plan) tracerSvg(page, r.plan, milieu.plan, p);
  rubrique(page, "Les pièces", MARGE, milieu.rubrique, p);
  if (r.pieces && milieu.pieces) {
    const pl = r.pieces;
    const { gauche: ox, haut: oy, largeur: w, hauteur: h, taille } = milieu.pieces;
    const dessin: NoeudSvg = {
      type: "svg",
      props: { viewBox: `0 0 ${pl.largeur} ${pl.hauteur}` },
      enfants: [
        // Les traits de `PiecesDuReseau`, pour les mêmes données.
        ...pl.contours.map((pts) => ({ type: "polygon", props: { points: pts, fill: colors.plein, fillOpacity: 0.14, stroke: colors.ink, strokeOpacity: 0.4, strokeWidth: 0.45 }, enfants: [] })),
        ...pl.traits.map((t) => ({ type: "line", props: { ...t, stroke: r.couleur, strokeWidth: 1.2, strokeLinecap: "round" }, enfants: [] })),
        ...pl.antennes.map((a) => ({ type: "line", props: { ...a, stroke: r.couleur, strokeWidth: 0.6 }, enfants: [] })),
      ],
    };
    tracerSvg(page, dessin, { gauche: ox, haut: oy, largeur: w, hauteur: h }, p);
    for (const pose of pl.poses) {
      const cx = ox + (pose.gauche / 100) * w;
      const cy = oy - (pose.haut / 100) * h;
      if (pose.egal) {
        await vignette(page, photos, pose.egal, cx - taille / 2, cy + taille / 2, taille, OR);
        pastillesDuCoin(page, numerosDuPoste(r, pose.egal), cx + taille / 2, cy + taille / 2, taille, p);
      }
      if (pose.pieces.length) {
        const rangee = pose.pieces.length * taille + (pose.pieces.length - 1) * 2;
        const yh = cy + taille / 2 - (pose.egal ? taille * 1.12 : 0);
        for (const [k, x] of pose.pieces.entries()) {
          const gauche = cx - rangee / 2 + k * (taille + 2);
          await vignette(page, photos, x, gauche, yh, taille, null);
          pastillesDuCoin(page, numerosDuPoste(r, x), gauche + taille, yh, taille, p);
        }
      }
    }
  } else if (milieu.rail) {
    // Le goutte-à-goutte : son rail, une barre à sa couleur et ses pièces, chacune nommée.
    const { taille, pas, rangee } = RAIL;
    const hautDuRail = milieu.rail.haut;
    const parRangee = Math.max(1, Math.floor((UTILE - 20) / (taille + pas)));
    page.drawRectangle({ x: MARGE + 2, y: hautDuRail - milieu.rail.hauteur, width: 4, height: milieu.rail.hauteur - 6, color: couleur });
    for (const [k, x] of pieces.entries()) {
      const col = k % parRangee, ran = Math.floor(k / parRangee);
      const gx = MARGE + 20 + col * (taille + pas);
      const gy = hautDuRail - 4 - ran * (taille + rangee);
      await vignette(page, photos, x, gx, gy, taille, null);
      pastillesDuCoin(page, numerosDuPoste(r, x), gx + taille, gy, taille, p);
      legendeSous(page, x.detail || x.nom, gx + taille / 2, gy - taille - 2, taille + 14, p);
    }
  }
  if (sections.length) {
    const finDuDessin = milieu.pieces ? milieu.pieces.occupe.haut - milieu.pieces.occupe.hauteur : milieu.rail ? milieu.rail.haut - milieu.rail.hauteur : milieu.rubrique - RUBRIQUE;
    await ecrireLesSections(page, photos, sections, MARGE, Math.max(hautDeLaReserve - 16, finDuDessin - 18), UTILE, 2, p);
  }
}

function pagesDeLaListe(doc: PDFDocument, d: DonneesPdfDuPlan, p: Polices) {
  let page = doc.addPage([A4.largeur, A4.hauteur]);
  let y = rubrique(page, "La liste des pièces", MARGE, A4.hauteur - MARGE - 8, p);
  const suite = (titreDuGroupe: string | null) => {
    page = doc.addPage([A4.largeur, A4.hauteur]);
    y = rubrique(page, "La liste des pièces, suite", MARGE, A4.hauteur - MARGE - 8, p);
    if (titreDuGroupe) titreGroupe(`${titreDuGroupe}, suite`);
  };
  const titreGroupe = (t: string) => {
    y -= 6;
    page.drawText(papier(t), { x: MARGE, y, size: 13, font: p.titres, color: ENCRE });
    y -= 10;
  };
  for (const g of d.groupes) {
    if (y - 40 < BAS) suite(null);
    titreGroupe(g.titre);
    for (const l of g.lignes) {
      const morceaux = couper(l.nom, p.texte, 10, UTILE - 70);
      const hauteur = morceaux.length * 13 + 7;
      if (y - hauteur < BAS) suite(g.titre);
      page.drawLine({ start: { x: MARGE, y }, end: { x: A4.largeur - MARGE, y }, thickness: 0.5, color: FILET.couleur, opacity: FILET.opacite });
      y -= 13;
      page.drawText(papier(l.quantite), { x: MARGE, y, size: 10, font: p.gras, color: OR_TEXTE });
      morceaux.forEach((m, i) => page.drawText(m, { x: MARGE + 70, y: y - i * 13, size: 10, font: p.texte, color: ENCRE }));
      y -= (morceaux.length - 1) * 13 + 7;
    }
    y -= 8;
  }
}

async function polices(doc: PDFDocument): Promise<Polices> {
  doc.registerFontkit(fontkit);
  const dossier = path.join(process.cwd(), "src/server/pdf/polices");
  const [texte, gras, titres] = await Promise.all(
    ["inter-400.ttf", "inter-700.ttf", "atlas-archive-serif-400.ttf"].map((f) => readFile(path.join(dossier, f)))
  );
  return {
    texte: await doc.embedFont(texte, { subset: true }),
    gras: await doc.embedFont(gras, { subset: true }),
    titres: await doc.embedFont(titres, { subset: true }),
  };
}

export async function composerLePdfDuPlan(d: DonneesPdfDuPlan): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(papier(`Plan d’arrosage, ${d.dossier}`));
  doc.setProducer("Cause");
  const p = await polices(doc);
  const photos = new Photos(doc);
  await pageDeGarde(doc, d, p);
  if (d.nourrice) await pageDeLaNourrice(doc, d.nourrice, p, photos);
  for (const r of d.reseaux) await pageDuReseau(doc, r, p, photos);
  pagesDeLaListe(doc, d, p);
  return doc.save();
}

