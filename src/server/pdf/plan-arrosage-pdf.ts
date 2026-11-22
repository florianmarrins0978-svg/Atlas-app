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
 * pièces »*, voir `disposerLeMilieu`.
 *
 * Page 1 : l'entreprise, le dossier, la date, le résumé, la légende. Puis un
 * réseau par page : son nom, son matériel et son tuyau en haut ; le réseau en
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

export type SegmentDeTexte = { gras: boolean; texte: string };

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
};

export type DonneesPdfDuPlan = {
  entreprise: string;
  dossier: string;
  /** « 21 novembre 2026 » */
  date: string;
  resume: string;
  legende: { symbole: NoeudSvg; texte: SegmentDeTexte[] }[];
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

  // Au milieu : le réseau dans le jardin, puis le dessin de ses pièces, ses photos posées à leur place.
  const pieces = [...r.rail, ...r.ajoutees];
  const milieu = disposerLeMilieu({
    proportionDuPlan: r.plan ? proportionDe(r.plan) : null,
    pieces: r.pieces,
    rail: pieces.length,
    haut: y - 8,
    bas: basDesPieces,
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
      if (pose.egal) await vignette(page, photos, pose.egal, cx - taille / 2, cy + taille / 2, taille, OR);
      if (pose.pieces.length) {
        const rangee = pose.pieces.length * taille + (pose.pieces.length - 1) * 2;
        const yh = cy + taille / 2 - (pose.egal ? taille * 1.12 : 0);
        for (const [k, x] of pose.pieces.entries()) await vignette(page, photos, x, cx - rangee / 2 + k * (taille + 2), yh, taille, null);
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
      legendeSous(page, x.detail || x.nom, gx + taille / 2, gy - taille - 2, taille + 14, p);
    }
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
  for (const r of d.reseaux) await pageDuReseau(doc, r, p, photos);
  pagesDeLaListe(doc, d, p);
  return doc.save();
}

