import { LineCapStyle, PDFDocument, PDFFont, PDFImage, PDFPage, clip, endPath, popGraphicsState, pushGraphicsState, rectangle, rgb, type RGB } from "pdf-lib";
import type { CarteImprimee } from "../carte/geoplateforme-tuiles";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PALETTE_DOCUMENT, PIED_DOCUMENT } from "./document-commun";
import {
  CONSIGNES_DE_SECOURS,
  DECOUVERTE_FORTUITE,
  LIBELLES,
  NOTE_DE_LA_FEUILLE,
  lecturesManquantes,
  validite,
  PERIMETRE_DU_DECRET,
  POINTS_DE_VIGILANCE,
  gardeeJusquAu,
  libellesAvecLesSiens,
  estCoche,
  type ContenuFiche,
  type Famille,
} from "../../lib/fiche-securite";
import {
  HAUTEUR_DU_CROQUIS,
  LARGEUR_DU_CROQUIS,
  OUTILS_DU_CROQUIS,
  cheminDuRuisseau,
  manquesDuCroquis,
  numeroDeLArbre,
  numeroDeLaZone,
  rectangleDeLaLimite,
  type Croquis,
} from "../../lib/croquis-securite";

// LE PDF DE LA FICHE DE SÉCURITÉ — la feuille MSA, refaite depuis le contenu.
//
// **Pourquoi son propre moteur, et non `composerDocument`.** Le moteur commun
// dessine des pièces que le client PAIE : un tableau de lignes, des totaux, une
// TVA. La fiche n'a rien de tout cela — quatre pages de cases, un croquis, une
// signature dessinée — et la tordre dans un tableau de lignes aurait produit une
// fiche qu'un contrôleur ne reconnaît pas. Ce qui est commun aux deux moteurs
// (les teintes, la marge, le plancher du pied) vient du même endroit :
// `PALETTE_DOCUMENT` et `PIED_DOCUMENT`.
//
// **Chaque case de la feuille est imprimée, cochée ou non.** Une fiche qui ne
// montre que ce qui est coché ressemble à une fiche complète ; celle-ci montre
// aussi ce qui a été laissé vide — c'est ce que le contrôleur compare à sa
// feuille, et c'est ce que le patron signe en connaissance de cause.

export type FicheSecuritePdfData = {
  chantierNom: string;
  numeroDevis: string | null;
  adresse: string | null;
  jour: string | null;
  entrepriseNom: string;
  clientNom: string | null;
  contenu: ContenuFiche;
  signataire: string | null;
  signeeLe: Date | null;
  signaturePng: string | null;
  /** Les photos jointes, déjà lues (JPEG ou PNG). Celle qui porte l'identifiant du fond du croquis va sous le croquis. */
  photos: readonly { id: string; octets: Uint8Array; mime: string }[];
  /** La carte IGN autour du point GPS, déjà lue ; `null` sans point, ou quand l'IGN n'a pas répondu. */
  carte?: CarteImprimee | null;
};

const LARGEUR = 595.28;
const HAUTEUR = PIED_DOCUMENT.hauteurPage;
const MARGE = PIED_DOCUMENT.marge;
// Le pied des pièces du client réserve la place des mentions légales ; la fiche
// n'en a pas, et un quart de page vide par page ferait une fiche de six pages.
const PLANCHER = MARGE + 28;
const CORPS = 9.5;
const INTERLIGNE = 1.35;

function teinte(hexa: string): RGB {
  const n = parseInt(hexa.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
export function dateLongue(d: Date): string {
  return `${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`;
}
function jourDepuisIso(iso: string): string {
  const [a, m, j] = iso.split("-").map(Number);
  return dateLongue(new Date(a, m - 1, j));
}

/** Une case d'un tableau de champs : son nom au-dessus, sa valeur dessous. `plein` prend toute la ligne. */
type Champ = { nom: string; valeur: string; plein?: boolean };
/** Une cellule d'un tableau : un texte, rouge quand il dit un manque, ou une image (une signature). */
type Cellule = { texte: string; manque?: boolean; image?: PDFImage };

const LARGE = LARGEUR - 2 * MARGE;
// La tête courante vit dans la marge du haut ; le contenu commence dessous.
const HAUT_DU_CONTENU = HAUTEUR - MARGE - 14;
const CORPS_CASE = 9;
const GRIS = 0.62;

/**
 * LA PLUME DE LA FICHE, D'APRÈS SA PLANCHE DU 6 NOVEMBRE 2026 (« oui pour
 * tout ») : un titre et un filet doré au lieu d'une bande en capitales, une
 * case cochée pleine et noire au mot gras, une case vide grise mais imprimée
 * (l'inspecteur voit ce qui a été regardé), les listes courtes en colonnes,
 * et un titre qui ne reste jamais seul en bas d'une page : `titre` réserve la
 * place de ce qui le suit.
 */
class Plume {
  page!: PDFPage;
  y = HAUT_DU_CONTENU;
  constructor(
    private doc: PDFDocument,
    readonly polices: { normale: PDFFont; grasse: PDFFont },
    readonly encre: RGB,
    readonly accent: RGB,
    readonly trait: RGB,
    private papier: RGB
  ) {
    this.nouvellePage();
  }
  nouvellePage() {
    this.page = this.doc.addPage([LARGEUR, HAUTEUR]);
    this.page.drawRectangle({ x: 0, y: 0, width: LARGEUR, height: HAUTEUR, color: this.papier });
    this.y = HAUT_DU_CONTENU;
  }
  place(hauteur: number) {
    if (this.y - hauteur < PLANCHER) this.nouvellePage();
  }
  lignes(texte: string, police: PDFFont, taille: number, largeur: number): string[] {
    const mots = texte.split(/\s+/).filter(Boolean);
    const lignes: string[] = [];
    let courante = "";
    for (const mot of mots) {
      const essai = courante ? `${courante} ${mot}` : mot;
      if (police.widthOfTextAtSize(essai, taille) <= largeur || !courante) courante = essai;
      else {
        lignes.push(courante);
        courante = mot;
      }
    }
    if (courante) lignes.push(courante);
    return lignes;
  }
  texte(texte: string, options: { taille?: number; grasse?: boolean; couleur?: RGB; retrait?: number; opacite?: number } = {}) {
    const taille = options.taille ?? CORPS;
    const police = options.grasse ? this.polices.grasse : this.polices.normale;
    const retrait = options.retrait ?? 0;
    for (const ligne of this.lignes(texte, police, taille, LARGE - retrait)) {
      this.place(taille * INTERLIGNE);
      this.page.drawText(ligne, { x: MARGE + retrait, y: this.y - taille, size: taille, font: police, color: options.couleur ?? this.encre, opacity: options.opacite });
      this.y -= taille * INTERLIGNE;
    }
  }
  espace(h: number) {
    this.y -= h;
  }
  /** `suite` : la hauteur de ce qui doit tenir sous le titre, sur la même page. */
  titre(texte: string, suite = 40) {
    this.espace(12);
    const taille = 11;
    const lignes = this.lignes(texte, this.polices.grasse, taille, LARGE);
    this.place(lignes.length * taille * 1.25 + 10 + suite);
    lignes.forEach((ligne, i) => this.page.drawText(ligne, { x: MARGE, y: this.y - taille - i * taille * 1.25, size: taille, font: this.polices.grasse, color: this.encre }));
    this.y -= lignes.length * taille * 1.25 + 3.5;
    this.page.drawLine({ start: { x: MARGE, y: this.y }, end: { x: LARGEUR - MARGE, y: this.y }, thickness: 0.75, color: this.accent });
    this.y -= 7;
  }
  sousTitre(texte: string) {
    this.espace(5);
    this.place(28);
    this.texte(texte, { grasse: true, taille: 9.5 });
    this.espace(1);
  }
  vigilance(texte: string) {
    this.texte(`Point de vigilance : ${texte}`, { taille: 8, opacite: 0.72 });
  }
  note(texte: string, grasse = false) {
    this.texte(texte, { taille: 8, opacite: grasse ? 1 : 0.72, grasse });
  }
  coche(x: number, y: number, cochee: boolean) {
    if (!cochee) {
      this.page.drawRectangle({ x, y, width: 7.5, height: 7.5, borderColor: this.encre, borderWidth: 0.6, borderOpacity: 0.45 });
      return;
    }
    this.page.drawRectangle({ x, y, width: 7.5, height: 7.5, color: this.encre });
    this.page.drawLine({ start: { x: x + 1.6, y: y + 3.8 }, end: { x: x + 3.2, y: y + 2 }, thickness: 1.1, color: this.papier });
    this.page.drawLine({ start: { x: x + 3.2, y: y + 2 }, end: { x: x + 6.1, y: y + 5.9 }, thickness: 1.1, color: this.papier });
  }
  /** Des cases, rang par rang, sur `colonnes` colonnes : une ligne de trois mots courts tient la place d'un seul. */
  cases(cases: readonly { libelle: string; cochee: boolean }[], colonnes = 1, retrait = 0) {
    const gouttiere = 14;
    const largeur = (LARGE - retrait - (colonnes - 1) * gouttiere) / colonnes;
    for (let i = 0; i < cases.length; i += colonnes) {
      const rang = cases.slice(i, i + colonnes);
      const lignes = rang.map((c) => this.lignes(c.libelle, c.cochee ? this.polices.grasse : this.polices.normale, CORPS_CASE, largeur - 13));
      const hauteur = Math.max(...lignes.map((l) => l.length)) * CORPS_CASE * INTERLIGNE + 2.5;
      this.place(hauteur);
      rang.forEach((c, k) => {
        const x = MARGE + retrait + k * (largeur + gouttiere);
        this.coche(x, this.y - CORPS_CASE + 0.5, c.cochee);
        lignes[k].forEach((ligne, j) =>
          this.page.drawText(ligne, { x: x + 13, y: this.y - CORPS_CASE - j * CORPS_CASE * INTERLIGNE, size: CORPS_CASE, font: c.cochee ? this.polices.grasse : this.polices.normale, color: this.encre, opacity: c.cochee ? 1 : GRIS })
        );
      });
      this.y -= hauteur;
    }
  }
  /** Des champs en colonnes : le nom en petit au-dessus, la valeur dessous ; vide, il le dit. */
  champs(champs: readonly Champ[], colonnes = 2) {
    const gouttiere = 18;
    const rangs: Champ[][] = [];
    let courant: Champ[] = [];
    for (const c of champs) {
      if (c.plein) {
        if (courant.length) rangs.push(courant);
        rangs.push([c]);
        courant = [];
      } else {
        courant.push(c);
        if (courant.length === colonnes) {
          rangs.push(courant);
          courant = [];
        }
      }
    }
    if (courant.length) rangs.push(courant);
    for (const rang of rangs) {
      const n = rang.length === 1 && rang[0].plein ? 1 : colonnes;
      const largeur = (LARGE - (n - 1) * gouttiere) / n;
      const mesures = rang.map((c) => {
        const vide = !c.valeur.trim();
        return { vide, nom: this.lignes(c.nom, this.polices.normale, 7.5, largeur), valeur: this.lignes(vide ? "non renseigné" : c.valeur.trim(), vide ? this.polices.normale : this.polices.grasse, CORPS, largeur) };
      });
      const hauteur = Math.max(...mesures.map((m) => m.nom.length * 7.5 * 1.3 + m.valeur.length * CORPS * INTERLIGNE)) + 5;
      this.place(hauteur);
      mesures.forEach((m, k) => {
        const x = MARGE + k * (largeur + gouttiere);
        let y = this.y;
        for (const ligne of m.nom) {
          this.page.drawText(ligne, { x, y: y - 7.5, size: 7.5, font: this.polices.normale, color: this.encre, opacity: 0.68 });
          y -= 7.5 * 1.3;
        }
        for (const ligne of m.valeur) {
          this.page.drawText(ligne, { x, y: y - CORPS, size: CORPS, font: m.vide ? this.polices.normale : this.polices.grasse, color: this.encre, opacity: m.vide ? GRIS : 1 });
          y -= CORPS * INTERLIGNE;
        }
      });
      this.y -= hauteur;
    }
  }
  /** Un tableau : les en-têtes en petit, une ligne par personne, un filet entre chacune. */
  tableau(entetes: readonly string[], largeurs: readonly number[], lignes: readonly (readonly Cellule[])[], alerte: RGB) {
    const total = largeurs.reduce((a, b) => a + b, 0);
    const colonnes = largeurs.map((l) => (l / total) * LARGE);
    const xs = colonnes.map((_, i) => MARGE + colonnes.slice(0, i).reduce((a, b) => a + b, 0));
    this.place(14 + 18);
    entetes.forEach((e, i) => this.page.drawText(e, { x: xs[i], y: this.y - 7.5, size: 7.5, font: this.polices.grasse, color: this.encre, opacity: 0.68 }));
    this.y -= 11;
    this.page.drawLine({ start: { x: MARGE, y: this.y }, end: { x: LARGEUR - MARGE, y: this.y }, thickness: 0.5, color: this.trait });
    for (const ligne of lignes) {
      const mesures = ligne.map((c, i) => (c.image ? [] : this.lignes(c.texte || "non renseigné", i === 0 ? this.polices.grasse : this.polices.normale, CORPS, colonnes[i] - 8)));
      const hauteur = Math.max(24, ...mesures.map((m) => m.length * CORPS * INTERLIGNE + 9));
      this.place(hauteur);
      ligne.forEach((c, i) => {
        if (c.image) {
          const e = Math.min((colonnes[i] - 8) / c.image.width, 20 / c.image.height);
          this.page.drawImage(c.image, { x: xs[i], y: this.y - 3 - c.image.height * e, width: c.image.width * e, height: c.image.height * e });
          return;
        }
        mesures[i].forEach((t, j) =>
          this.page.drawText(t, { x: xs[i], y: this.y - 4.5 - CORPS - j * CORPS * INTERLIGNE, size: CORPS, font: i === 0 || c.manque ? this.polices.grasse : this.polices.normale, color: c.manque ? alerte : this.encre, opacity: c.texte ? 1 : GRIS })
        );
      });
      this.y -= hauteur;
      this.page.drawLine({ start: { x: MARGE, y: this.y }, end: { x: LARGEUR - MARGE, y: this.y }, thickness: 0.4, color: this.trait });
    }
  }
  filet() {
    this.place(8);
    this.page.drawLine({ start: { x: MARGE, y: this.y - 3 }, end: { x: LARGEUR - MARGE, y: this.y - 3 }, thickness: 0.5, color: this.trait });
    this.y -= 8;
  }
  image(img: PDFImage, largeurMax: number, hauteurMax: number) {
    const echelle = Math.min(largeurMax / img.width, hauteurMax / img.height, 1);
    const w = img.width * echelle;
    const h = img.height * echelle;
    this.place(h + 6);
    this.page.drawImage(img, { x: MARGE, y: this.y - h, width: w, height: h });
    this.y -= h + 6;
  }
  /** La tête et le pied de chaque page, posés une fois toutes les pages connues : « page 2 sur 6 ». */
  entourerLesPages(tete: { gauche: string; droite: string }, pied: string) {
    const pages = this.doc.getPages();
    pages.forEach((page, i) => {
      const t = 7.5;
      page.drawText(tete.gauche, { x: MARGE, y: HAUTEUR - MARGE + 2, size: t, font: this.polices.normale, color: this.encre, opacity: 0.68 });
      page.drawText(tete.droite, { x: LARGEUR - MARGE - this.polices.normale.widthOfTextAtSize(tete.droite, t), y: HAUTEUR - MARGE + 2, size: t, font: this.polices.normale, color: this.encre, opacity: 0.68 });
      page.drawLine({ start: { x: MARGE, y: PLANCHER - 6 }, end: { x: LARGEUR - MARGE, y: PLANCHER - 6 }, thickness: 0.5, color: this.trait });
      const numero = `Page ${i + 1} sur ${pages.length}`;
      page.drawText(pied, { x: MARGE, y: PLANCHER - 16, size: t, font: this.polices.normale, color: this.encre, opacity: 0.68 });
      page.drawText(numero, { x: LARGEUR - MARGE - this.polices.normale.widthOfTextAtSize(numero, t), y: PLANCHER - 16, size: t, font: this.polices.normale, color: this.encre, opacity: 0.68 });
    });
  }
}

/**
 * LES TEINTES DU CROQUIS IMPRIMÉ. Un document ne suit pas les thèmes de l'écran
 * (`couleursDocument`) : ce sont les valeurs d'Origine des jetons qu'emploie le
 * croquis à l'écran (`Croquis.tsx`), pour qu'un repère ait la même couleur
 * sur la feuille que sur le téléphone.
 */
const TEINTES_DU_CROQUIS = {
  pin: "#2f3b2f",
  pinClair: "#4f5f4c",
  or: "#B98B47",
  alerte: "#9C3B2E",
  plein: "#7d9a6d",
  papier: "#faf9f5",
  fond: "#ece9e1",
} as const;
/** Le vert de « Signée » en tête de la fiche : celui des cases « Fait » de l'écran, en Origine. */
const TEINTE_SIGNEE = "#506f44";

async function dessinerLeCroquis(doc: PDFDocument, plume: Plume, croquis: Croquis, fond: { octets: Uint8Array; mime: string } | null, police: { normale: PDFFont; grasse: PDFFont }, largeur: number) {
  const k = largeur / LARGEUR_DU_CROQUIS;
  const hauteur = HAUTEUR_DU_CROQUIS * k;
  plume.place(hauteur + 8);
  const page = plume.page;
  const haut = plume.y;
  const X = (x: number) => MARGE + x * k;
  const Y = (y: number) => haut - y * k;
  const t = (h: string) => teinte(h);
  page.drawRectangle({ x: MARGE, y: haut - hauteur, width: largeur, height: hauteur, color: t(croquis.fond === "blanc" ? TEINTES_DU_CROQUIS.papier : TEINTES_DU_CROQUIS.fond), borderColor: t(TEINTES_DU_CROQUIS.pin), borderWidth: 0.4, borderOpacity: 0.3 });
  if (fond) {
    try {
      const img = fond.mime === "image/png" ? await doc.embedPng(fond.octets) : await doc.embedJpg(fond.octets);
      // Entière, centrée : la même règle qu'à l'écran (`meet`), sinon les repères tomberaient à côté.
      const e = Math.min(largeur / img.width, hauteur / img.height);
      const w = img.width * e, h = img.height * e;
      page.drawImage(img, { x: MARGE + (largeur - w) / 2, y: haut - hauteur + (hauteur - h) / 2, width: w, height: h });
    } catch (erreur) {
      console.error("[fiche-securite-pdf] fond du croquis illisible", erreur);
      page.drawText("La photo sous le croquis n’a pas pu être imprimée.", { x: MARGE + 6, y: haut - 14, size: 8, font: police.normale, color: t(TEINTES_DU_CROQUIS.alerte) });
    }
  }
  const trait = (d: string, couleur: string, epaisseur: number, tirets?: number[], opacite = 1) =>
    page.drawSvgPath(d, { x: MARGE, y: haut, scale: k, borderColor: t(couleur), borderWidth: epaisseur, borderDashArray: tirets, borderOpacity: opacite, borderLineCap: LineCapStyle.Round });
  croquis.marques.forEach((m, rang) => {
    switch (m.t) {
      case "crayon": {
        let d = `M${m.pts[0]} ${m.pts[1]}`;
        for (let i = 2; i < m.pts.length; i += 2) d += ` L${m.pts[i]} ${m.pts[i + 1]}`;
        trait(d, TEINTES_DU_CROQUIS.pin, 3.5);
        break;
      }
      case "acces": trait(`M${m.x} ${m.y} L${m.x2} ${m.y2}`, TEINTES_DU_CROQUIS.pin, 5, [10, 7]); break;
      case "voie": trait(`M${m.x} ${m.y} L${m.x2} ${m.y2}`, TEINTES_DU_CROQUIS.or, 8, undefined, 0.8); break;
      case "ligne": trait(`M${m.x} ${m.y} L${m.x2} ${m.y2}`, TEINTES_DU_CROQUIS.alerte, 3, [14, 4, 2, 4]); break;
      case "ruisseau": trait(cheminDuRuisseau(m), TEINTES_DU_CROQUIS.pinClair, 6); break;
      case "limite": {
        const r = rectangleDeLaLimite(m);
        trait(`M${r.x} ${r.y} h${r.largeur} v${r.hauteur} h${-r.largeur} Z`, TEINTES_DU_CROQUIS.pin, 2, [3, 5]);
        break;
      }
      case "abattre":
      case "tailler": {
        const plein = m.t === "abattre";
        page.drawCircle({ x: X(m.x), y: Y(m.y), size: 15 * k, color: t(plein ? TEINTES_DU_CROQUIS.alerte : TEINTES_DU_CROQUIS.papier), borderColor: t(plein ? TEINTES_DU_CROQUIS.papier : TEINTES_DU_CROQUIS.or), borderWidth: (plein ? 2 : 4) * k });
        const n = String(numeroDeLArbre(croquis.marques, rang));
        const taille = 17 * k;
        page.drawText(n, { x: X(m.x) - police.grasse.widthOfTextAtSize(n, taille) / 2, y: Y(m.y) - taille * 0.36, size: taille, font: police.grasse, color: t(plein ? TEINTES_DU_CROQUIS.papier : TEINTES_DU_CROQUIS.pin) });
        break;
      }
      case "maison":
        page.drawRectangle({ x: X(m.x - 34), y: Y(m.y + 26), width: 68 * k, height: 52 * k, color: t(TEINTES_DU_CROQUIS.or), opacity: 0.35, borderColor: t(TEINTES_DU_CROQUIS.pin), borderWidth: 2 * k });
        break;
      case "danger": {
        page.drawCircle({ x: X(m.x), y: Y(m.y), size: 46 * k, color: t(TEINTES_DU_CROQUIS.alerte), opacity: 0.12, borderColor: t(TEINTES_DU_CROQUIS.alerte), borderWidth: 3 * k, borderDashArray: [7 * k, 5 * k] });
        const mot = m.mot.trim() || `Zone ${numeroDeLaZone(croquis.marques, rang)}`;
        const taille = 14 * k;
        page.drawText(mot, { x: X(m.x) - police.grasse.widthOfTextAtSize(mot, taille) / 2, y: Y(m.y + 64) + taille * 0.3, size: taille, font: police.grasse, color: t(TEINTES_DU_CROQUIS.alerte) });
        break;
      }
      case "stockage":
        page.drawRectangle({ x: X(m.x - 36), y: Y(m.y + 22), width: 72 * k, height: 44 * k, color: t(TEINTES_DU_CROQUIS.or), opacity: 0.13, borderColor: t(TEINTES_DU_CROQUIS.or), borderWidth: 2.5 * k, borderDashArray: [6 * k, 4 * k] });
        break;
      case "reseau":
        for (const [dx, hy] of [[0, 10], [10, 18], [20, 26]] as const) {
          page.drawRectangle({ x: X(m.x - 14 + dx), y: Y(m.y + 14), width: 7 * k, height: hy * k, color: t(TEINTES_DU_CROQUIS.pin) });
        }
        break;
      case "secours":
        page.drawRectangle({ x: X(m.x - 15), y: Y(m.y + 15), width: 30 * k, height: 30 * k, color: t(TEINTES_DU_CROQUIS.plein) });
        trait(`M${m.x - 8} ${m.y} h16 M${m.x} ${m.y - 8} v16`, TEINTES_DU_CROQUIS.papier, 4);
        break;
    }
  });
  plume.y = haut - hauteur - 8;
}

/** La carte du point, rognée à son cadre, le repère au centre : la même vue qu'à l'écran. */
async function dessinerLaCarte(doc: PDFDocument, plume: Plume, carte: CarteImprimee, police: PDFFont) {
  const largeur = LARGEUR - 2 * MARGE;
  const k = largeur / carte.largeur;
  const hauteur = carte.hauteur * k;
  plume.place(hauteur + 8);
  const page = plume.page;
  const haut = plume.y;
  page.pushOperators(pushGraphicsState(), rectangle(MARGE, haut - hauteur, largeur, hauteur), clip(), endPath());
  for (const t of carte.tuiles) {
    try {
      const img = t.mime === "image/png" ? await doc.embedPng(t.octets) : await doc.embedJpg(t.octets);
      page.drawImage(img, { x: MARGE + t.gauche * k, y: haut - (t.haut + 256) * k, width: 256 * k, height: 256 * k });
    } catch (erreur) {
      console.error("[fiche-securite-pdf] tuile de carte illisible", erreur);
    }
  }
  page.pushOperators(popGraphicsState());
  page.drawRectangle({ x: MARGE, y: haut - hauteur, width: largeur, height: hauteur, borderColor: teinte(TEINTES_DU_CROQUIS.pin), borderWidth: 0.4, borderOpacity: 0.3 });
  // Le repère : une goutte dont la pointe est le point.
  const cx = MARGE + largeur / 2, cy = haut - hauteur / 2;
  page.drawSvgPath("M17 43c-12-16-16-23-16-28a16 16 0 1 1 32 0c0 5-4 12-16 28z", { x: cx - 17 * 0.6, y: cy + 43 * 0.6, scale: 0.6, color: teinte(TEINTES_DU_CROQUIS.alerte), borderColor: rgb(1, 1, 1), borderWidth: 1.2 });
  page.drawCircle({ x: cx, y: cy + (43 - 15) * 0.6, size: 6 * 0.6, color: rgb(1, 1, 1) });
  page.drawText("Carte IGN", { x: MARGE + largeur - 40, y: haut - hauteur + 4, size: 6.5, font: police, color: teinte(TEINTES_DU_CROQUIS.pin) });
  plume.y = haut - hauteur - 8;
}

async function polices(doc: PDFDocument): Promise<{ normale: PDFFont; grasse: PDFFont }> {
  // Inter, embarquée : les polices standard d'un PDF (WinAnsi) n'ont ni « ≤ »
  // ni « … », et la feuille en est pleine (HTA (U ≤ 50 000 V)).
  doc.registerFontkit(fontkit);
  const dossier = path.join(process.cwd(), "src/server/pdf/polices");
  const [normale, grasse] = await Promise.all([readFile(path.join(dossier, "inter-400.ttf")), readFile(path.join(dossier, "inter-700.ttf"))]);
  return { normale: await doc.embedFont(normale, { subset: true }), grasse: await doc.embedFont(grasse, { subset: true }) };
}

function famille(plume: Plume, contenu: ContenuFiche, nom: Famille, colonnes = 1, retrait = 0) {
  plume.cases(libellesAvecLesSiens(contenu, nom).map((libelle) => ({ libelle, cochee: estCoche(contenu, nom, libelle) })), colonnes, retrait);
}

function heureDeParis(d: Date): string {
  return d.toLocaleTimeString("fr-FR", { hour: "numeric", minute: "2-digit", timeZone: "Europe/Paris" }).replace(":", " h ");
}

/**
 * EN CAS D'ACCIDENT — en tête de la première page (sa planche du 6 novembre
 * 2026). Ce que cherchent les secours ou un inspecteur était à la page 6 :
 * l'adresse, le point GPS, le point de rencontre, la trousse, qui est
 * secouriste, et les numéros. Rien n'y est écrit qui ne soit pas plus loin
 * dans la fiche : ces lignes y restent aussi, à leur place.
 */
function encadreDeLAccident(plume: Plume, alerte: RGB, lignes: { adresse: string; gps: string; rencontre: string; acces: string; trousse: string; sst: string; gsa: string; responsable: string }) {
  const { normale, grasse } = plume.polices;
  const ordre = ["18", "15", "112", "17", "114"];
  const numeros = ordre.map((n) => CONSIGNES_DE_SECOURS.urgences.find(([m]) => m === n)).filter((u): u is (typeof CONSIGNES_DE_SECOURS.urgences)[number] => u !== undefined);
  const dedans = 12;
  const largeurs = [104, (LARGE - 2 * dedans - 104 - 2 * 14) / 2, (LARGE - 2 * dedans - 104 - 2 * 14) / 2];
  const colonne = (paires: readonly (readonly [string, string])[], largeur: number) =>
    paires.map(([nom, valeur]) => ({ nom, valeur: plume.lignes(valeur.trim() || "non renseigné", valeur.trim() ? grasse : normale, CORPS, largeur), vide: !valeur.trim() }));
  const deux = colonne([["Adresse", lignes.adresse], ["Point GPS", lignes.gps], ["Point de rencontre des secours", lignes.rencontre], ...(lignes.acces.trim() ? [["Adresse d’accès des secours", lignes.acces] as const] : [])], largeurs[1]);
  const trois = colonne([["Trousse de secours", lignes.trousse], ["Sauveteurs secouristes (SST)", lignes.sst], ["Grimpeur sauveteur (GSA)", lignes.gsa], ["Responsable sur place", lignes.responsable]], largeurs[2]);
  const hauteurDe = (c: typeof deux) => c.reduce((h, x) => h + 7.5 * 1.3 + x.valeur.length * CORPS * INTERLIGNE + 4, 0);
  const hauteur = dedans + 18 + Math.max(numeros.length * 15, hauteurDe(deux), hauteurDe(trois)) + dedans - 4;
  plume.espace(12);
  plume.place(hauteur);
  const haut = plume.y;
  plume.page.drawRectangle({ x: MARGE, y: haut - hauteur, width: LARGE, height: hauteur, color: alerte, opacity: 0.08, borderColor: alerte, borderWidth: 0.6, borderOpacity: 0.3 });
  plume.page.drawText("En cas d’accident", { x: MARGE + dedans, y: haut - dedans - 11, size: 12, font: grasse, color: alerte });
  const departY = haut - dedans - 18;
  numeros.forEach(([n, q], i) => {
    const y = departY - i * 15;
    plume.page.drawText(n, { x: MARGE + dedans, y: y - 12, size: 13, font: grasse, color: plume.encre });
    plume.page.drawText(q, { x: MARGE + dedans + 30, y: y - 11, size: 7.5, font: normale, color: plume.encre });
  });
  [deux, trois].forEach((col, k) => {
    const x = MARGE + dedans + largeurs[0] + 14 + k * (largeurs[1] + 14);
    let y = departY;
    for (const ligne of col) {
      plume.page.drawText(ligne.nom, { x, y: y - 7.5, size: 7.5, font: grasse, color: alerte });
      y -= 7.5 * 1.3;
      for (const t of ligne.valeur) {
        plume.page.drawText(t, { x, y: y - CORPS, size: CORPS, font: ligne.vide ? normale : grasse, color: plume.encre, opacity: ligne.vide ? GRIS : 1 });
        y -= CORPS * INTERLIGNE;
      }
      y -= 4;
    }
  });
  plume.y = haut - hauteur;
}

export async function composerFicheSecuritePdf(data: FicheSecuritePdfData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Fiche de sécurité, ${data.chantierNom}`);
  doc.setLanguage("fr-FR");
  const p = await polices(doc);
  const encre = teinte(PALETTE_DOCUMENT.encre);
  const accent = teinte(PALETTE_DOCUMENT.titrePartie);
  const alerte = teinte(TEINTES_DU_CROQUIS.alerte);
  const plume = new Plume(doc, p, encre, accent, teinte(PALETTE_DOCUMENT.traitClair), teinte(PALETTE_DOCUMENT.papier));
  const c = data.contenu;
  // Les compétences à la date de la signature : c'est ce jour-là que la fiche les affirme.
  const ceJour = data.signeeLe ?? new Date();
  const presents = c.equipe.filter((x) => x.present && x.nom.trim());
  const responsable = `${c.responsablePrenom} ${c.responsableNom}`.trim() + (c.responsableTel.trim() ? `, ${c.responsableTel.trim()}` : "");
  const jours = (heure: string) => [data.jour ? jourDepuisIso(data.jour) : "", heure].filter(Boolean).join(", ");

  // ─── L'en-tête : le titre, le décret, et si la fiche est signée ───
  const statut = data.signeeLe
    ? [`le ${dateLongue(data.signeeLe)} à ${heureDeParis(data.signeeLe)}`, ...(data.signataire ? [`par ${data.signataire}`] : [])]
    : [];
  plume.page.drawText("Fiche de sécurité", { x: MARGE, y: plume.y - 20, size: 21, font: p.grasse, color: encre });
  const droite = LARGEUR - MARGE;
  plume.page.drawText(data.signeeLe ? "Signée" : "Non signée", { x: droite - p.grasse.widthOfTextAtSize(data.signeeLe ? "Signée" : "Non signée", 10), y: plume.y - 10, size: 10, font: p.grasse, color: data.signeeLe ? teinte(TEINTE_SIGNEE) : alerte });
  statut.forEach((t, i) => plume.page.drawText(t, { x: droite - p.normale.widthOfTextAtSize(t, 8), y: plume.y - 21 - i * 10.5, size: 8, font: p.normale, color: encre, opacity: 0.72 }));
  plume.y -= 28;
  for (const ligne of plume.lignes("Fiche d’intervention en lien avec le décret 2021-1833 du 24 décembre 2021 relatif aux règles de sécurité applicables aux travaux agricoles dans les parcs et jardins et autres travaux d’entretien de la végétation.", p.normale, 7.5, LARGE * 0.62)) {
    plume.page.drawText(ligne, { x: MARGE, y: plume.y - 7.5, size: 7.5, font: p.normale, color: encre, opacity: 0.72 });
    plume.y -= 7.5 * 1.4;
  }

  encadreDeLAccident(plume, alerte, {
    adresse: data.adresse ?? "",
    gps: c.gps,
    rencontre: c.pointDeRencontre,
    acces: c.adresseSecours,
    trousse: c.lieuTrousse,
    sst: presents.filter((x) => validite(x.sst, ceJour).ok).map((x) => x.nom.trim()).join(", "),
    gsa: presents.filter((x) => validite(x.gsa, ceJour).ok).map((x) => x.nom.trim()).join(", "),
    responsable,
  });

  plume.titre("Identification");
  plume.champs([
    { nom: "Nom du chantier", valeur: data.chantierNom },
    { nom: "N° de devis et/ou de commande afférent", valeur: data.numeroDevis ?? "" },
  ]);
  plume.sousTitre("Entreprise réalisant le chantier");
  plume.champs([
    { nom: "Raison sociale", valeur: data.entrepriseNom },
    { nom: "Téléphone (en cas d’incident ou d’accident)", valeur: c.telephoneIncident },
  ]);
  plume.sousTitre("Donneur d’ordre");
  plume.champs([
    ...(c.donneur === "autre"
      ? [{ nom: "Nom, prénom", valeur: `${c.donneurPrenom} ${c.donneurNom}`.trim() }, { nom: "Téléphone (en cas d’incident ou d’accident)", valeur: c.donneurTel }]
      : [{ nom: "Raison sociale", valeur: c.donneur === "client" ? data.clientNom ?? "" : "" }]),
    { nom: "Ce qu’il est pour le chantier", valeur: c.donneurRole },
  ]);

  plume.titre("Identification du chantier");
  plume.champs([
    { nom: "Lieu (adresse, coordonnées GPS)", valeur: [data.adresse, c.gps].filter((x) => x && x.trim()).join(", "), plein: true },
    ...(c.gps.trim() ? [{ nom: "Adresse au point GPS", valeur: c.adresseDuPoint || "aucune adresse connue à cet endroit" }] : []),
    { nom: "Adresse d’accès des secours", valeur: c.adresseSecours },
    { nom: "Dates d’exécution, début", valeur: jours(c.heureDebut) },
    { nom: "Dates d’exécution, fin", valeur: jours(c.heureFin) },
  ]);
  if (c.gps.trim()) {
    if (data.carte) await dessinerLaCarte(doc, plume, data.carte, p.normale);
    else plume.note("La carte du point n’a pas pu être imprimée.");
  }
  plume.vigilance(POINTS_DE_VIGILANCE.horaires);

  plume.titre("Main d’œuvre", 80);
  plume.champs([
    { nom: "Responsable de l’entreprise sur le chantier", valeur: responsable },
    { nom: "Nombre de travailleurs de l’entreprise", valeur: String(c.nombreDeTravailleurs) },
    ...c.autresResponsables.filter((r) => r.nom.trim()).map((r) => ({ nom: "Autre responsable", valeur: r.nom.trim() + (r.tel.trim() ? `, ${r.tel.trim()}` : "") })),
  ]);
  plume.vigilance(POINTS_DE_VIGILANCE.mainDOeuvre);
  if (presents.length) {
    plume.espace(4);
    const aLu = new Map(c.lectures.map((l) => [l.nom.trim(), l]));
    const doiventSigner = new Set(lecturesManquantes(c));
    plume.tableau(
      ["Nom", "Formations", "SST", "GSA", "A lu la fiche"],
      [1.1, 1.3, 1.2, 1.2, 1.4],
      presents.map((x) => {
        const sst = validite(x.sst, ceJour), gsa = validite(x.gsa, ceJour);
        const lecture = aLu.get(x.nom.trim());
        const lu: Cellule = lecture
          ? { texte: `le ${dateLongue(new Date(lecture.le))} à ${heureDeParis(new Date(lecture.le))}` }
          : doiventSigner.has(x.nom.trim())
            ? { texte: data.signeeLe ? "pas encore signé" : "après la signature", manque: Boolean(data.signeeLe) }
            : { texte: data.signeeLe ? "signataire de la fiche" : "" };
        return [
          { texte: x.nom.trim() },
          { texte: x.formations.join(", ") || "aucune" },
          sst.ok && sst.fin ? { texte: `jusqu’au ${dateLongue(sst.fin)}` } : { texte: "non à jour", manque: true },
          gsa.ok && gsa.fin ? { texte: `jusqu’au ${dateLongue(gsa.fin)}` } : { texte: "non", manque: true },
          lu,
        ];
      }),
      alerte
    );
  }
  if (c.mainDOeuvre.trim()) {
    plume.espace(3);
    plume.texte(c.mainDOeuvre.trim());
  }
  plume.sousTitre("Sous-traitants et autres entreprises sur le chantier");
  const surPlace = c.entreprisesSurPlace === "oui" ? c.entreprises.filter((x) => x.presente && x.nom.trim()) : [];
  if (surPlace.length === 0) plume.texte(c.entreprisesSurPlace === "aucune" ? "Aucune." : "non renseigné", { opacite: c.entreprisesSurPlace === "aucune" ? 1 : GRIS });
  for (const x of surPlace) {
    plume.texte(`${x.nom.trim()}${x.quoi.trim() ? `, ${x.quoi.trim()}` : ""}${x.tel.trim() ? `, ${x.tel.trim()}` : ""}. Fiche présentée à son responsable : ${x.montree ? "oui" : "non"}.`);
  }

  plume.titre("Travaux à réaliser");
  famille(plume, c, "travaux", 2);
  plume.vigilance(POINTS_DE_VIGILANCE.activites);

  plume.titre("Les EPI");
  famille(plume, c, "epi", 3);

  plume.titre("Matériels");
  plume.vigilance(POINTS_DE_VIGILANCE.materiels);
  plume.sousTitre("Moyens d’élévation");
  plume.vigilance(POINTS_DE_VIGILANCE.elevation);
  famille(plume, c, "elevation", 3);
  plume.vigilance(POINTS_DE_VIGILANCE.echelle);
  plume.sousTitre("Matériels de coupe");
  plume.vigilance(POINTS_DE_VIGILANCE.distanceMateriels);
  famille(plume, c, "coupe", 3);
  plume.sousTitre("Matériels autres");
  plume.vigilance(POINTS_DE_VIGILANCE.distanceMateriels);
  famille(plume, c, "autresMateriels", 3);

  plume.titre("La situation des travaux");
  famille(plume, c, "situation", 3);

  plume.titre("Les arbres dangereux");
  if (c.arbresDangereux !== "oui" || c.arbres.length === 0) plume.texte(c.arbresDangereux === "non" ? "Aucun." : "non renseigné", { opacite: c.arbresDangereux === "non" ? 1 : GRIS });
  else c.arbres.forEach((a, i) => {
    plume.sousTitre(`${a.groupe ? "Groupe d’arbres" : "Arbre"} ${i + 1}, numéro ${i + 1} sur le croquis`);
    plume.champs([
      { nom: "Intervention", valeur: a.intervention ?? "" },
      { nom: "Dangers vus", valeur: a.dangers.join(", ") },
      { nom: "Consignes", valeur: [...a.consignes, a.autres.trim()].filter(Boolean).join(", "), plein: true },
    ]);
  });

  plume.titre("Les arbres pendant l’intervention");
  famille(plume, c, "risquesArbres", 2);
  plume.sousTitre("Matières. État sanitaire et physiologique des arbres");
  famille(plume, c, "matieres");
  plume.vigilance(POINTS_DE_VIGILANCE.matieres);
  if (c.matieresAutres.trim()) plume.champs([{ nom: "Autres (à préciser)", valeur: c.matieresAutres, plein: true }]);

  // Le titre du croquis réserve la place du dessin : il ne reste plus seul en bas d'une page.
  const largeurDuCroquis = LARGE * 0.58;
  plume.titre("Carte / croquis / photo du chantier indiquant les accès, voies de circulation et les végétaux à traiter", c.croquis.fond ? HAUTEUR_DU_CROQUIS * (largeurDuCroquis / LARGEUR_DU_CROQUIS) + 8 : 20);
  const fond = data.photos.find((x) => x.id === c.croquis.fondPhotoId) ?? null;
  if (c.croquis.fond) {
    plume.place(HAUTEUR_DU_CROQUIS * (largeurDuCroquis / LARGEUR_DU_CROQUIS) + 8);
    const haut = plume.y;
    await dessinerLeCroquis(doc, plume, c.croquis, fond, p, largeurDuCroquis);
    const bas = plume.y;
    // La légende à côté du dessin, puis le périmètre du décret.
    const x = MARGE + largeurDuCroquis + 14;
    const largeurLegende = LARGE - largeurDuCroquis - 14;
    const poses = new Set(c.croquis.marques.map((m) => m.t));
    const legende = OUTILS_DU_CROQUIS.filter((o) => o.t !== "crayon" && poses.has(o.t)).map((o) => o.libelle);
    let y = haut;
    const ecrire = (texte: string, taille: number, grasse = false, opacite = 1) => {
      for (const ligne of plume.lignes(texte, grasse ? p.grasse : p.normale, taille, largeurLegende)) {
        plume.page.drawText(ligne, { x, y: y - taille, size: taille, font: grasse ? p.grasse : p.normale, color: encre, opacity: opacite });
        y -= taille * INTERLIGNE;
      }
    };
    if (legende.length) {
      ecrire("Légende", 8.5, true);
      for (const mot of legende) ecrire(mot, 8.5);
      y -= 2;
      ecrire("Les numéros des arbres sont ceux des arbres dangereux.", 7.5, false, 0.72);
    }
    const manque = manquesDuCroquis(c.croquis);
    if (manque.length) ecrire(`Croquis incomplet, il manque : ${manque.join(", ")}.`, 8.5, true);
    y -= 6;
    ecrire("Périmètre de sécurité, d’après le décret", 8.5, true);
    for (const [quoi, combien] of PERIMETRE_DU_DECRET) ecrire(`${quoi} : ${combien}.`, 8.5);
    plume.y = Math.min(bas, y - 4);
  } else {
    plume.texte("Aucun croquis.", { opacite: GRIS });
    plume.sousTitre("Périmètre de sécurité, d’après le décret");
    for (const [quoi, combien] of PERIMETRE_DU_DECRET) plume.texte(`${quoi} : ${combien}.`);
  }
  const autresPhotos = data.photos.filter((x) => x.id !== c.croquis.fondPhotoId);
  if (autresPhotos.length) plume.sousTitre("Photos du balisage et des zones sensibles");
  for (const photo of autresPhotos) {
    try {
      const img = photo.mime === "image/png" ? await doc.embedPng(photo.octets) : await doc.embedJpg(photo.octets);
      plume.image(img, LARGE, 300);
    } catch (erreur) {
      console.error("[fiche-securite-pdf] photo jointe illisible", erreur);
      plume.texte("Une photo jointe n’a pas pu être imprimée.", { opacite: GRIS });
    }
  }
  plume.note("Délimitation matérielle du chantier obligatoire");
  plume.sousTitre("Zones du chantier");
  famille(plume, c, "balisage");
  if (c.communication.trim()) plume.champs([{ nom: "Moyen de communication", valeur: c.communication, plein: true }]);

  plume.titre("Risques spécifiques au chantier. Risque biologique");
  famille(plume, c, "biologique", 3);
  plume.sousTitre("Mesures de prévention spécifiques au chantier");
  famille(plume, c, "biologiqueMesures", 2);

  plume.titre("Risques liés aux réseaux, aériens et souterrains");
  famille(plume, c, "reseaux", 3);
  plume.note("Électrique");
  famille(plume, c, "tensions", 3, 13);
  plume.sousTitre("Mesures");
  for (const libelle of libellesAvecLesSiens(c, "reseauxMesures")) {
    plume.cases([{ libelle, cochee: estCoche(c, "reseauxMesures", libelle) }]);
    if (libelle === LIBELLES.reseauxMesures[2]) famille(plume, c, "distances", 3, 13);
  }
  plume.note(`Au cas où : ${DECOUVERTE_FORTUITE.mot}`);

  plume.titre("La noyade");
  famille(plume, c, "noyade", 3);

  plume.titre("Risques liés à l’environnement du chantier");
  famille(plume, c, "environnement", 3);
  plume.sousTitre("Mesures");
  famille(plume, c, "environnementMesures", 2);
  if (c.environnementPreciser.trim()) plume.champs([{ nom: "Préciser", valeur: c.environnementPreciser, plein: true }]);

  plume.titre("Co-activité dans la zone de sécurité du chantier");
  famille(plume, c, "coactivite");
  plume.champs([
    { nom: "Risques autres identifiés", valeur: c.risquesAutres },
    { nom: "Mesures de prévention autres", valeur: c.mesuresAutres },
  ]);

  plume.titre("Règles organisationnelles à mettre en place");
  famille(plume, c, "organisation");
  if (c.organisationCommunication.trim()) plume.champs([{ nom: "Mode de communication", valeur: c.organisationCommunication, plein: true }]);
  plume.vigilance(POINTS_DE_VIGILANCE.manuel);

  plume.titre("Entrer dans une zone de danger");
  if (c.protocole.trim()) for (const ligne of c.protocole.trim().split("\n")) plume.texte(ligne);
  else plume.texte("non renseigné", { opacite: GRIS });

  plume.titre("Consignes sur la conduite à tenir en cas de phénomènes météorologiques imprévus");
  plume.vigilance(POINTS_DE_VIGILANCE.bulletins);
  famille(plume, c, "meteo");

  plume.titre("Organisation des secours. Ressources humaines et matérielles");
  famille(plume, c, "secours");
  plume.champs([
    { nom: "Préciser le lieu où se trouve la trousse de secours", valeur: c.lieuTrousse },
    { nom: "Préciser le Point de Rencontre des Secours", valeur: c.pointDeRencontre },
  ]);

  plume.titre("Organisation des secours. Consignes et procédures", 120);
  plume.sousTitre("1. Protéger");
  CONSIGNES_DE_SECOURS.proteger.forEach((x, i) => plume.texte(`${i + 1}. ${x}`, { retrait: 4 }));
  plume.sousTitre("2. Alerter");
  // Les numéros en cases, lisibles d'un coup d'œil : c'est ce qu'on cherche quand ça arrive.
  {
    const n = CONSIGNES_DE_SECOURS.urgences.length;
    const largeur = (LARGE - (n - 1) * 6) / n;
    plume.place(32);
    CONSIGNES_DE_SECOURS.urgences.forEach(([numero, qui], i) => {
      const x = MARGE + i * (largeur + 6);
      plume.page.drawRectangle({ x, y: plume.y - 28, width: largeur, height: 28, borderColor: encre, borderWidth: 0.6, borderOpacity: 0.35 });
      plume.page.drawText(numero, { x: x + 6, y: plume.y - 14, size: 12, font: p.grasse, color: encre });
      plume.page.drawText(qui, { x: x + 6, y: plume.y - 23.5, size: 7, font: p.normale, color: encre, opacity: 0.72 });
    });
    plume.y -= 34;
  }
  CONSIGNES_DE_SECOURS.alerter.forEach((x, i) => plume.texte(`${i + 1}. ${x}`, { retrait: 4 }));
  plume.sousTitre("3. Secourir");
  CONSIGNES_DE_SECOURS.secourir.forEach((x, i) => plume.texte(`${i + 1}. ${x}`, { retrait: 4 }));
  plume.espace(2);
  plume.note(CONSIGNES_DE_SECOURS.permanentes[0]);
  plume.note(CONSIGNES_DE_SECOURS.permanentes[1], true);

  plume.titre("Observations / Consignes particulières");
  plume.texte(c.observations.trim() || "Aucune observation.", { opacite: c.observations.trim() ? 1 : GRIS });

  // ─── L'enregistrement : le nom, la date, la garde, et la signature dans son cadre ───
  plume.titre("Enregistrement", 96);
  {
    const haut = plume.y;
    const largeurCadre = 230;
    const cadreX = LARGEUR - MARGE - largeurCadre;
    plume.page.drawRectangle({ x: cadreX, y: haut - 88, width: largeurCadre, height: 88, color: rgb(1, 1, 1), borderColor: encre, borderWidth: 0.6, borderOpacity: 0.35 });
    plume.page.drawText("Signature", { x: cadreX + 8, y: haut - 82, size: 7, font: p.normale, color: encre, opacity: 0.6 });
    let signee = false;
    if (data.signaturePng?.startsWith("data:image/png;base64,")) {
      try {
        const img = await doc.embedPng(Buffer.from(data.signaturePng.slice("data:image/png;base64,".length), "base64"));
        const e = Math.min((largeurCadre - 20) / img.width, 64 / img.height);
        plume.page.drawImage(img, { x: cadreX + (largeurCadre - img.width * e) / 2, y: haut - 8 - img.height * e, width: img.width * e, height: img.height * e });
        signee = true;
      } catch (erreur) {
        console.error("[fiche-securite-pdf] signature illisible", erreur);
        plume.page.drawText("Signature illisible.", { x: cadreX + 8, y: haut - 40, size: 9, font: p.normale, color: alerte });
      }
    }
    if (!signee && !data.signaturePng) plume.page.drawText("Non signée.", { x: cadreX + 8, y: haut - 40, size: 9, font: p.normale, color: encre, opacity: GRIS });
    const champs: [string, string][] = [
      ["Nom et prénom du chef d’entreprise (ou de son représentant)", data.signataire ?? ""],
      ["Date", data.signeeLe ? `${dateLongue(data.signeeLe)}, à ${heureDeParis(data.signeeLe)}` : ""],
      ...(data.signeeLe ? [["Gardée jusqu’au", dateLongue(gardeeJusquAu(data.signeeLe))] as [string, string]] : []),
    ];
    let y = haut;
    const largeurChamps = LARGE - largeurCadre - 18;
    for (const [nom, valeur] of champs) {
      for (const ligne of plume.lignes(nom, p.normale, 7.5, largeurChamps)) {
        plume.page.drawText(ligne, { x: MARGE, y: y - 7.5, size: 7.5, font: p.normale, color: encre, opacity: 0.68 });
        y -= 7.5 * 1.3;
      }
      for (const ligne of plume.lignes(valeur || "non renseigné", valeur ? p.grasse : p.normale, CORPS, largeurChamps)) {
        plume.page.drawText(ligne, { x: MARGE, y: y - CORPS, size: CORPS, font: valeur ? p.grasse : p.normale, color: encre, opacity: valeur ? 1 : GRIS });
        y -= CORPS * INTERLIGNE;
      }
      y -= 5;
    }
    plume.y = Math.min(y, haut - 88) - 4;
  }

  // La lecture de chaque salarié, sa signature et son heure : la preuve que la fiche lui a été présentée.
  const manquent = data.signeeLe ? lecturesManquantes(c) : [];
  if (c.lectures.length > 0 || manquent.length > 0) {
    plume.titre("Présentée aux travailleurs", 60);
    const lignes: Cellule[][] = [];
    for (const l of c.lectures) {
      let image: PDFImage | undefined;
      try {
        image = await doc.embedPng(Buffer.from(l.png.slice("data:image/png;base64,".length), "base64"));
      } catch (erreur) {
        console.error("[fiche-securite-pdf] signature de lecture illisible", erreur);
      }
      const le = new Date(l.le);
      lignes.push([{ texte: l.nom }, { texte: `le ${dateLongue(le)} à ${heureDeParis(le)}` }, image ? { texte: "", image } : { texte: "Signature illisible.", manque: true }]);
    }
    for (const nom of manquent) lignes.push([{ texte: nom }, { texte: "pas encore signé", manque: true }, { texte: " " }]);
    plume.tableau(["Nom", "A lu la fiche", "Signature"], [1.2, 1.6, 1.2], lignes, alerte);
  }

  plume.espace(10);
  plume.filet();
  plume.texte(NOTE_DE_LA_FEUILLE.titre, { grasse: true, taille: 8.5 });
  for (const ligne of NOTE_DE_LA_FEUILLE.lignes) plume.texte(`• ${ligne}`, { taille: 8.5, retrait: 4 });

  plume.entourerLesPages(
    { gauche: `Fiche de sécurité, ${data.chantierNom}${data.jour ? `, ${jourDepuisIso(data.jour)}` : ""}`, droite: data.entrepriseNom },
    data.signeeLe ? `Signée le ${dateLongue(data.signeeLe)}, gardée jusqu’au ${dateLongue(gardeeJusquAu(data.signeeLe))}` : "Non signée"
  );
  return doc.save();
}
