import { PDFDocument, degrees, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { charte } from "@/lib/chartes";
import { TON_DE_LA_CONCLUSION, type ContenuAttestation, type TexteDuTampon } from "@/lib/attestation-comptable";
import { protegerContreModification } from "./proteger-pdf";

/**
 * L'ATTESTATION DU COMPTABLE, EN PDF — sa planche du 27 octobre 2026
 * (`appli/soignee/comptable-attestation.html`, écran « Relire et signer »).
 *
 * **Son propre moteur**, comme la lettre de mise en demeure : le moteur commun
 * dessine des pièces qu'on paie, un tableau de lignes et des totaux. Une
 * attestation n'en a aucun.
 *
 * **Tout le texte vient de `contenuDeLAttestation`**, la fonction qui peint
 * aussi l'aperçu que le comptable signe : ce qu'il relit est ce qui se range.
 *
 * Inter et EB Garamond, embarquées : le moins typographique des montants
 * (« −9,28 € ») et l'espace insécable passent sans détour, là où les polices
 * standard du PDF (WinAnsi) les perdent.
 *
 * Le fichier est protégé contre la modification (`protegerContreModification`) :
 * une attestation signée ne se retouche pas d'un doigt dans un lecteur.
 */

const LARGEUR = 595.28;
const HAUTEUR = 841.89;
const MARGE = 56;
const UTILE = LARGEUR - 2 * MARGE;
const BAS = 64;
const ORIGINE = charte("origine").jetons;

function couleur(hex: string) {
  const n = hex.replace("#", "");
  return rgb(parseInt(n.slice(0, 2), 16) / 255, parseInt(n.slice(2, 4), 16) / 255, parseInt(n.slice(4, 6), 16) / 255);
}
type Teinte = ReturnType<typeof rgb>;

const ENCRE = couleur(ORIGINE.ink);
const DOUX = couleur(ORIGINE.inkSoft);
const FILET = couleur("#e4e0d6");
const REJET_FOND = couleur(ORIGINE.carteRougeFond);
const REJET_TEXTE = couleur(ORIGINE.carteRougeTexte);
const TEINTE_DU_TON: Record<"vert" | "ambre" | "rouge", Teinte> = {
  vert: couleur(ORIGINE.carteVertTexte),
  ambre: couleur(ORIGINE.carteAmbreTexte),
  rouge: couleur(ORIGINE.carteRougeTexte),
};

type Polices = { sans: PDFFont; gras: PDFFont; serif: PDFFont };

async function polices(doc: PDFDocument): Promise<Polices> {
  doc.registerFontkit(fontkit);
  const dossier = path.join(process.cwd(), "src/server/pdf/polices");
  const [sans, gras, serif] = await Promise.all(
    ["inter-400.ttf", "inter-700.ttf", "eb-garamond-400.ttf"].map((f) => readFile(path.join(dossier, f)))
  );
  return {
    sans: await doc.embedFont(sans, { subset: true }),
    gras: await doc.embedFont(gras, { subset: true }),
    serif: await doc.embedFont(serif, { subset: true }),
  };
}

/**
 * Le texte pour le papier. Les lettres en exposant de « 1ᵉʳ » n'existent pas
 * dans Inter : il s'écrit « 1er », comme sur un document imprimé (la même
 * règle que le dossier, `dossier-comptable-pdf.ts`).
 */
function papier(texte: string): string {
  return texte.replace(/ᵉʳ/g, "er").replace(/ᵉ/g, "e");
}

/** Un texte coupé en lignes au mot près, à la largeur donnée. */
function enLignes(texte: string, police: PDFFont, taille: number, largeur: number): string[] {
  const lignes: string[] = [];
  let courante = "";
  for (const mot of papier(texte).split(/\s+/).filter(Boolean)) {
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

/**
 * Le curseur d'écriture : il descend la page, et en ouvre une autre quand la
 * place manque. Cent lignes rejetées ne doivent pas sortir du papier.
 */
class Plume {
  page: PDFPage;
  y: number;
  constructor(
    private doc: PDFDocument,
    private p: Polices
  ) {
    this.page = doc.addPage([LARGEUR, HAUTEUR]);
    this.y = HAUTEUR - 72;
  }
  place(hauteur: number) {
    if (this.y - hauteur >= BAS) return;
    this.page = this.doc.addPage([LARGEUR, HAUTEUR]);
    this.y = HAUTEUR - 64;
  }
  texte(t: string, police: PDFFont, taille: number, teinte: Teinte, x = MARGE, largeur = UTILE, interligne = 1.45) {
    for (const l of enLignes(t, police, taille, largeur)) {
      this.place(taille * interligne);
      this.y -= taille * interligne;
      this.page.drawText(l, { x, y: this.y, size: taille, font: police, color: teinte });
    }
  }
  filet(ecart = 14) {
    this.place(ecart * 2);
    this.y -= ecart;
    this.page.drawLine({ start: { x: MARGE, y: this.y }, end: { x: LARGEUR - MARGE, y: this.y }, thickness: 0.6, color: FILET });
  }
  get polices() {
    return this.p;
  }
}

/** Une rangée « libellé à gauche, valeur à droite ». */
function rangee(plume: Plume, gauche: string, droite: string, policeDroite: PDFFont, tailleDroite: number, teinteDroite: Teinte) {
  const pas = Math.max(17, tailleDroite * 1.35);
  plume.place(pas);
  plume.y -= pas;
  droite = papier(droite);
  plume.page.drawText(gauche, { x: MARGE, y: plume.y, size: 10.5, font: plume.polices.sans, color: DOUX });
  plume.page.drawText(droite, { x: LARGEUR - MARGE - policeDroite.widthOfTextAtSize(droite, tailleDroite), y: plume.y, size: tailleDroite, font: policeDroite, color: teinteDroite });
}

/**
 * Le tampon du cabinet, dans le repère de la planche (un cercle de 120 unités),
 * incliné de neuf degrés comme à l'écran. Chaque lettre des deux arcs se pose
 * une à une, tournée selon sa place sur le cercle.
 */
function poserLeTampon(page: PDFPage, p: Polices, cx: number, cy: number, diametre: number, t: TexteDuTampon, teinte: Teinte) {
  const k = diametre / 120;
  const incline = (9 * Math.PI) / 180;
  const tourne = (x: number, y: number) => ({
    x: cx + (x * Math.cos(incline) - y * Math.sin(incline)) * k,
    y: cy + (x * Math.sin(incline) + y * Math.cos(incline)) * k,
  });
  page.drawCircle({ x: cx, y: cy, size: 57 * k, borderColor: teinte, borderWidth: 2.4 * k, opacity: 0, borderOpacity: 0.9 });
  page.drawCircle({ x: cx, y: cy, size: 38.5 * k, borderColor: teinte, borderWidth: 1.1 * k, opacity: 0, borderOpacity: 0.9 });

  function arc(texte: string, rayon: number, taille: number, espace: number, enHaut: boolean) {
    const lettres = [...texte];
    const largeurs = lettres.map((c) => p.gras.widthOfTextAtSize(c, taille));
    let total = largeurs.reduce((a, b) => a + b, 0) + espace * (lettres.length - 1);
    // Un cabinet au nom long se resserre plutôt que de faire le tour du cercle.
    const maximum = rayon * Math.PI * 0.92;
    const echelle = total > maximum ? maximum / total : 1;
    total *= echelle;
    let parcouru = 0;
    lettres.forEach((c, i) => {
      const angle = enHaut ? Math.PI / 2 + total / 2 / rayon - parcouru / rayon : (3 * Math.PI) / 2 - total / 2 / rayon + parcouru / rayon;
      const o = tourne(rayon * Math.cos(angle), rayon * Math.sin(angle));
      const rotation = (angle * 180) / Math.PI + (enHaut ? -90 : 90) + 9;
      page.drawText(c, { x: o.x, y: o.y, size: taille * echelle * k, font: p.gras, color: teinte, rotate: degrees(rotation), opacity: 0.9 });
      parcouru += (largeurs[i] + espace) * echelle;
    });
  }
  arc(t.haut, 47, 7.5, 0.7, true);
  arc(t.bas, 52.5, 7, 1.1, false);

  /** Une ligne du centre, lettre à lettre pour garder l'espacement de la planche. */
  function centre(texte: string, yPlanche: number, taille: number, espace: number) {
    const lettres = [...texte];
    const largeurs = lettres.map((c) => p.gras.widthOfTextAtSize(c, taille));
    const total = largeurs.reduce((a, b) => a + b, 0) + espace * (lettres.length - 1);
    let x = -total / 2;
    lettres.forEach((c, i) => {
      const o = tourne(x, 60 - yPlanche);
      page.drawText(c, { x: o.x, y: o.y, size: taille * k, font: p.gras, color: teinte, rotate: degrees(9), opacity: 0.9 });
      x += largeurs[i] + espace;
    });
  }
  if (t.centre.length === 1) centre(t.centre[0], 64, 10.5, 0.6);
  else if (t.centre[0] === "NON") {
    centre(t.centre[0], 56, 8.5, 1.2);
    centre(t.centre[1], 68.5, 10.5, 0.6);
  } else {
    centre(t.centre[0], 59, 10.5, 0.6);
    centre(t.centre[1], 70, 6.6, 0.7);
  }
}

export async function composerAttestation(c: ContenuAttestation, signaturePng: Uint8Array, tampon: TexteDuTampon, auteur: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${c.titre}, ${c.dossier}`);
  doc.setAuthor(auteur);
  doc.setSubject(papier(c.periode));
  doc.setCreator("Atlas");
  const p = await polices(doc);
  const signature: PDFImage = await doc.embedPng(signaturePng);
  const verdict = TEINTE_DU_TON[TON_DE_LA_CONCLUSION[c.conclusion]];
  const plume = new Plume(doc, p);

  plume.texte(c.titre, p.serif, 26, ENCRE, MARGE, UTILE, 1.1);
  plume.y -= 6;
  plume.texte(c.dossier, p.sans, 11, DOUX);
  plume.texte(c.periode, p.sans, 11, DOUX);

  plume.filet(16);
  rangee(plume, "Conclusion", c.motConclusion, p.serif, 16, verdict);
  rangee(plume, "Lignes vérifiées", String(c.comptes.lignes), p.sans, 10.5, ENCRE);
  rangee(plume, "Validées", String(c.comptes.validees), p.sans, 10.5, ENCRE);
  rangee(plume, "Rejetées", String(c.comptes.rejetees), p.sans, 10.5, ENCRE);

  if (c.rejets.length > 0) {
    plume.y -= 14;
    plume.texte(c.rejets.length === 1 ? "Ligne rejetée" : "Lignes rejetées", p.gras, 9.5, REJET_TEXTE);
    for (const r of c.rejets) {
      const libelle = enLignes(`${r.jour} ${r.libelle}`, p.gras, 10, UTILE - 110);
      const note = r.note ? enLignes(r.note, p.sans, 10, UTILE - 20) : [];
      const hauteur = 10 + (libelle.length + note.length) * 14.5;
      plume.place(hauteur + 6);
      plume.y -= 6;
      plume.page.drawRectangle({ x: MARGE, y: plume.y - hauteur, width: UTILE, height: hauteur, color: REJET_FOND });
      let y = plume.y - 4;
      libelle.forEach((l, i) => {
        y -= 14.5;
        plume.page.drawText(l, { x: MARGE + 10, y, size: 10, font: p.gras, color: REJET_TEXTE });
        if (i === 0) plume.page.drawText(r.montant, { x: LARGEUR - MARGE - 10 - p.gras.widthOfTextAtSize(r.montant, 10), y, size: 10, font: p.gras, color: REJET_TEXTE });
      });
      for (const l of note) {
        y -= 14.5;
        plume.page.drawText(l, { x: MARGE + 10, y, size: 10, font: p.sans, color: REJET_TEXTE });
      }
      plume.y -= hauteur;
    }
  }

  if (c.observations) {
    plume.y -= 14;
    plume.texte("Observations", p.gras, 9.5, DOUX);
    plume.texte(c.observations, p.sans, 10.5, ENCRE);
  }

  plume.y -= 18;
  plume.texte(c.phrase, p.serif, 14, ENCRE, MARGE, UTILE, 1.35);

  plume.y -= 8;
  c.signataire.forEach((l, i) => plume.texte(l, i === 0 ? p.gras : p.sans, i === 0 ? 11 : 10, i === 0 ? ENCRE : DOUX));

  // La signature et le tampon, sur la même ligne, comme sur la planche : le
  // tampon déborde sur la fin du trait, ce que fait tout tampon posé à la main.
  const zone = 112;
  plume.place(zone + 30);
  plume.y -= 22;
  plume.page.drawText(papier(c.fait), { x: MARGE, y: plume.y, size: 10, font: p.sans, color: DOUX });
  const haut = plume.y - 8;
  const base = haut - zone;
  const echelle = Math.min(260 / signature.width, (zone - 16) / signature.height, 1);
  plume.page.drawImage(signature, { x: MARGE + 4, y: base + 12, width: signature.width * echelle, height: signature.height * echelle });
  plume.page.drawLine({ start: { x: MARGE, y: base + 14 }, end: { x: MARGE + 280, y: base + 14 }, thickness: 0.6, color: FILET });
  poserLeTampon(plume.page, p, MARGE + 300, base + zone / 2, 104, tampon, verdict);
  plume.y = base;

  plume.filet(18);
  plume.texte(c.pied, p.sans, 9, DOUX);
  plume.texte(c.empreinte, p.sans, 8.5, DOUX);

  return protegerContreModification(await doc.save());
}
