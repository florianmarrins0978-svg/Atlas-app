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
 * Page 1 : l'entreprise, le dossier, la date, le résumé, la légende. Puis un
 * réseau par page : son nom, son matériel, son tuyau et le réseau en couleur
 * en haut ; le dessin de ses pièces au milieu, aussi grand que la page le
 * permet ; une tête de bas en haut en bas. Puis la liste des pièces.
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

async function pageDuReseau(doc: PDFDocument, r: ReseauDuPdf, p: Polices, photos: Photos) {
  const page = doc.addPage([A4.largeur, A4.hauteur]);
  const couleur = couleurPourLePapier(r.couleur)?.couleur ?? ENCRE;
  const haut = A4.hauteur - MARGE;

  // En haut, à gauche : le nom, la zone, le matériel, le tuyau. À droite : le réseau dans le jardin.
  const largeurPlan = r.plan ? 200 : 0;
  const largeurTexte = UTILE - largeurPlan - (r.plan ? 16 : 0);
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
  let basDuBandeau = y;
  if (r.plan) {
    const t = tracerSvg(page, r.plan, { gauche: A4.largeur - MARGE - largeurPlan, haut, largeur: largeurPlan, hauteur: 150 }, p);
    basDuBandeau = Math.min(basDuBandeau, haut - (150 + t.hauteur) / 2);
  }
  y = basDuBandeau - 18;
  y = rubrique(page, "Les pièces", MARGE, y, p);

  // En bas : une tête, de bas en haut. Posée d'abord, pour savoir ce qu'il reste au dessin.
  let basDesPieces = BAS;
  if (r.chaine) {
    const taille = 40;
    const pas = UTILE / r.chaine.length;
    const hauteurChaine = 14 + taille + 5 * 7.5 * 1.25;
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

  // Au milieu : le dessin des pièces, ses photos posées à leur place.
  const hauteurDispo = y - basDesPieces;
  if (r.pieces) {
    const pl = r.pieces;
    const echelle = Math.min(UTILE / pl.largeur, hauteurDispo / pl.hauteur) * 0.92;
    const w = pl.largeur * echelle, h = pl.hauteur * echelle;
    const ox = MARGE + (UTILE - w) / 2;
    const oy = y - (hauteurDispo - h) / 2;
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
    // Les vignettes gardent la proportion de l'écran : 32 points pour un dessin de 322.
    const taille = Math.max(16, Math.min(34, (32 / 322) * w));
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
  } else if (r.rail.length || r.ajoutees.length) {
    // Le goutte-à-goutte : son rail, une barre à sa couleur et ses pièces, chacune nommée.
    const taille = 46;
    const pieces = [...r.rail, ...r.ajoutees];
    const parRangee = Math.max(1, Math.floor((UTILE - 20) / (taille + 18)));
    page.drawRectangle({ x: MARGE + 2, y: y - Math.ceil(pieces.length / parRangee) * (taille + 40), width: 4, height: Math.ceil(pieces.length / parRangee) * (taille + 40) - 6, color: couleur });
    for (const [k, x] of pieces.entries()) {
      const col = k % parRangee, ran = Math.floor(k / parRangee);
      const gx = MARGE + 20 + col * (taille + 18);
      const gy = y - 4 - ran * (taille + 40);
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

