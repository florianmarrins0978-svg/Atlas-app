import { PDFDocument, PDFFont, PDFPage, rgb, type RGB } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PALETTE_DOCUMENT, PIED_DOCUMENT } from "./document-commun";
import type { LettreMiseEnDemeure, Segment } from "../../lib/mise-en-demeure";

// LA LETTRE DE MISE EN DEMEURE — sa planche du 24 septembre 2026
// (`appli/mise-en-demeure.html`).
//
// **Son propre moteur, et non `composerDocument`**, pour la raison que donne
// déjà `fiche-securite-pdf.ts` : le moteur commun dessine des pièces qu'on
// paie, un tableau de lignes et des totaux. Une lettre n'en a aucun. Ce qui est
// commun (le papier, l'encre, l'accent, la marge) vient du même endroit :
// `PALETTE_DOCUMENT` et `PIED_DOCUMENT`.
//
// **Tout le texte vient de `lettreDeMiseEnDemeure`**, la fonction qui peint
// aussi l'aperçu à l'écran : ce qu'il relit est ce qui part en recommandé.

export type EnTeteLettre = {
  entrepriseNom: string;
  /** Les coordonnées de l'entreprise, une par ligne, figées sur la facture. */
  coordonnees: string[];
};

const LARGEUR = 595.28;
const HAUTEUR = PIED_DOCUMENT.hauteurPage;
const MARGE = PIED_DOCUMENT.marge;
const CORPS = 10.5;
const INTERLIGNE = 1.5;

function teinte(hexa: string): RGB {
  const n = parseInt(hexa.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

export type Polices = { normale: PDFFont; grasse: PDFFont };

async function polices(doc: PDFDocument): Promise<Polices> {
  // Inter, embarquée : l'espace insécable des montants et le « œ » passent
  // sans détour, là où les polices standard (WinAnsi) en perdent.
  doc.registerFontkit(fontkit);
  const dossier = path.join(process.cwd(), "src/server/pdf/polices");
  const [normale, grasse] = await Promise.all([
    readFile(path.join(dossier, "inter-400.ttf")),
    readFile(path.join(dossier, "inter-700.ttf")),
  ]);
  return { normale: await doc.embedFont(normale, { subset: true }), grasse: await doc.embedFont(grasse, { subset: true }) };
}

/**
 * Un paragraphe aux mots gras et maigres, coupé à la largeur.
 *
 * Mot à mot, chacun mesuré dans SA police : couper le paragraphe comme un seul
 * texte maigre ferait déborder la ligne qui porte le montant en gras.
 */
export function couperLaLettre(segments: Segment[], p: Polices, largeur: number): { texte: string; gras: boolean }[][] {
  const mots: { texte: string; gras: boolean; colle: boolean }[] = [];
  // Un mot se colle au précédent quand AUCUNE espace ne les sépare, d'un
  // segment à l'autre compris : « TTC » puis « , payable » restent collés, mais
  // l'espace qui finit « pour un montant de » sépare bien le montant en gras.
  // Coupé sur l'espace ORDINAIRE seulement : l'insécable d'un montant
  // (« 1 440,00 € ») tient ses chiffres ensemble, c'est son rôle.
  let espaceAvant = true;
  for (const s of segments) {
    for (const [i, morceau] of s.texte.split(" ").entries()) {
      if (i > 0) espaceAvant = true;
      if (!morceau) continue;
      mots.push({ texte: morceau, gras: Boolean(s.gras), colle: !espaceAvant });
      espaceAvant = false;
    }
  }
  const lignes: { texte: string; gras: boolean }[][] = [];
  let ligne: { texte: string; gras: boolean }[] = [];
  let occupe = 0;
  const espace = p.normale.widthOfTextAtSize(" ", CORPS);
  for (const m of mots) {
    const police = m.gras ? p.grasse : p.normale;
    const w = police.widthOfTextAtSize(m.texte, CORPS);
    const avant = ligne.length === 0 || m.colle ? 0 : espace;
    if (ligne.length > 0 && occupe + avant + w > largeur && !m.colle) {
      lignes.push(ligne);
      ligne = [];
      occupe = 0;
      ligne.push({ texte: m.texte, gras: m.gras });
      occupe = w;
      continue;
    }
    ligne.push({ texte: (avant ? " " : "") + m.texte, gras: m.gras });
    occupe += avant + w;
  }
  if (ligne.length) lignes.push(ligne);
  return lignes;
}

export async function genererPdfMiseEnDemeure(lettre: LettreMiseEnDemeure, entete: EnTeteLettre): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Mise en demeure, ${lettre.reference}`);
  doc.setLanguage("fr-FR");
  const p = await polices(doc);
  const encre = teinte(PALETTE_DOCUMENT.encre);
  const accent = teinte(PALETTE_DOCUMENT.titrePartie);
  const largeurTexte = LARGEUR - 2 * MARGE;

  let page: PDFPage = doc.addPage([LARGEUR, HAUTEUR]);
  const nouvellePage = () => {
    page = doc.addPage([LARGEUR, HAUTEUR]);
    page.drawRectangle({ x: 0, y: 0, width: LARGEUR, height: HAUTEUR, color: teinte(PALETTE_DOCUMENT.papier) });
    y = HAUTEUR - MARGE;
  };
  page.drawRectangle({ x: 0, y: 0, width: LARGEUR, height: HAUTEUR, color: teinte(PALETTE_DOCUMENT.papier) });
  let y = HAUTEUR - MARGE;
  const place = (h: number) => {
    if (y - h < MARGE) nouvellePage();
  };
  const ecrire = (texte: string, x: number, taille: number, police: PDFFont, couleur: RGB = encre) => {
    page.drawText(texte, { x, y: y - taille, size: taille, font: police, color: couleur });
  };

  // L'en-tête : l'entreprise à gauche, le destinataire à droite, comme une
  // lettre qu'on glisse dans une enveloppe à fenêtre.
  const yHaut = y;
  ecrire(entete.entrepriseNom, MARGE, 14, p.grasse);
  y -= 20;
  for (const l of entete.coordonnees) {
    ecrire(l, MARGE, 9, p.normale);
    y -= 12.5;
  }
  const yGauche = y;
  y = yHaut - 60;
  const xDroite = LARGEUR / 2 + 40;
  for (const l of lettre.destinataire) {
    ecrire(l, xDroite, CORPS, p.normale);
    y -= CORPS * 1.4;
  }
  y = Math.min(y, yGauche) - 14;
  page.drawLine({ start: { x: MARGE, y }, end: { x: LARGEUR - MARGE, y }, thickness: 0.6, color: teinte(PALETTE_DOCUMENT.traitClair) });
  y -= 22;

  ecrire(lettre.lieuEtDate, xDroite, CORPS, p.normale);
  y -= CORPS * 1.5;
  ecrire("Lettre recommandée avec accusé de réception", xDroite, 9, p.grasse);
  y -= 34;

  ecrire(lettre.titre, MARGE, 13, p.grasse, accent);
  const ref = lettre.reference;
  ecrire(ref, LARGEUR - MARGE - p.normale.widthOfTextAtSize(ref, 10), 10, p.normale);
  y -= 34;

  const paragraphe = (segments: Segment[]) => {
    for (const ligne of couperLaLettre(segments, p, largeurTexte)) {
      place(CORPS * INTERLIGNE);
      let x = MARGE;
      for (const morceau of ligne) {
        const police = morceau.gras ? p.grasse : p.normale;
        ecrire(morceau.texte, x, CORPS, police);
        x += police.widthOfTextAtSize(morceau.texte, CORPS);
      }
      y -= CORPS * INTERLIGNE;
    }
    y -= CORPS * 0.8;
  };

  paragraphe([{ texte: lettre.appellation }]);
  for (const s of lettre.paragraphes) paragraphe(s);
  paragraphe([{ texte: lettre.formule }]);
  y -= 18;
  place(CORPS * 2);
  ecrire(lettre.signature, xDroite, CORPS, p.grasse);

  return doc.save();
}
