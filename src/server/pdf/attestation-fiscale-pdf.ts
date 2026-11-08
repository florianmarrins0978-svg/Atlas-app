import { PDFDocument, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { charte } from "@/lib/chartes";
import type { ContenuAttestationFiscale } from "@/lib/attestation-fiscale";
import { logger } from "../logger";
import type { LogoDocument } from "./document-commun";
import { protegerContreModification } from "./proteger-pdf";

/**
 * L'ATTESTATION FISCALE D'UN CLIENT, EN PDF : sa planche du 8 novembre 2026
 * (`appli/soignee/credit-d-impot.html`, écran « L'attestation »).
 *
 * **Son propre moteur**, comme l'attestation du comptable et la mise en
 * demeure : le moteur commun dessine des pièces qu'on paie, un tableau de
 * lignes chiffrées et des totaux. Une attestation n'en a aucun.
 *
 * **Tout le texte vient de `contenuDeLAttestationFiscale`**, la fonction que
 * la feuille de l'écran lit aussi : ce qu'il relit est ce qui part.
 *
 * **Du papier, pas une charte** : les couleurs d'origine, quelle que soit
 * celle qu'il a choisie à l'écran ; le papier part chez son client.
 *
 * **Pas de signature dans ce lot** : la planche en dessine une, Atlas n'en
 * garde pas encore (`ARCHITECTURE.md` §571). Le fichier est protégé contre la
 * modification (`protegerContreModification`) : un papier fiscal ne se
 * retouche pas d'un doigt dans un lecteur.
 */

const LARGEUR = 595.28;
const HAUTEUR = 841.89;
const MARGE = 56;
const UTILE = LARGEUR - 2 * MARGE;
const BAS = 64;
const ORIGINE = charte("origine").jetons;
/** Le logo tient dans ce carré, comme sur la planche. */
const LOGO_MAX = 64;

function couleur(hex: string) {
  const n = hex.replace("#", "");
  return rgb(parseInt(n.slice(0, 2), 16) / 255, parseInt(n.slice(2, 4), 16) / 255, parseInt(n.slice(4, 6), 16) / 255);
}
type Teinte = ReturnType<typeof rgb>;

const ENCRE = couleur(ORIGINE.ink);
const DOUX = couleur(ORIGINE.inkSoft);
const OR = couleur("#8b6835");
const FILET = couleur("#e4e0d6");
const FILET_TETE = couleur("#c9c4b8");

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

/** Les exposants de « 1ᵉʳ » n'existent pas dans Inter : « 1er », comme imprimé. */
function papier(t: string): string {
  return t.replace(/ᵉʳ/g, "er").replace(/ᵉ/g, "e");
}

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
 * Le logo, embarqué, ou rien : **une image illisible ne retient pas le
 * papier**. Le refus utile se fait au dépôt du logo, dans Mon entreprise ;
 * ici l'incident se journalise, et l'attestation part sans lui.
 */
async function imageDuLogo(doc: PDFDocument, logo: LogoDocument | null): Promise<PDFImage | null> {
  if (!logo) return null;
  try {
    return logo.mime === "image/png" ? await doc.embedPng(logo.octets) : await doc.embedJpg(logo.octets);
  } catch (err) {
    logger.error("Logo des services à la personne illisible, attestation composée sans lui", {
      mime: logo.mime,
      erreur: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/** Ce que le papier porte, relevé à l'écriture : la suite PDF le relit sans décoder les polices. */
export type TraceAttestation = { textes: string[]; logos: number; pages: number };

/** Les colonnes du tableau, à la planche : Date, Durée, Intervenant. */
const X_DUREE = MARGE + 150;
const X_NOM = MARGE + 250;

export async function composerAttestationFiscale(
  c: ContenuAttestationFiscale,
  logo: LogoDocument | null
): Promise<{ octets: Uint8Array; trace: TraceAttestation }> {
  const doc = await PDFDocument.create();
  doc.setTitle(papier(`${c.titre}, ${c.entete.nom}`));
  doc.setAuthor(papier(c.entete.nom));
  doc.setCreator("Atlas");
  const p = await polices(doc);
  const image = await imageDuLogo(doc, logo);
  const trace: TraceAttestation = { textes: [], logos: 0, pages: 0 };

  let page: PDFPage = doc.addPage([LARGEUR, HAUTEUR]);
  trace.pages++;
  let y = HAUTEUR - 64;
  const ecrire = (t: string, x: number, police: PDFFont, taille: number, teinte: Teinte = ENCRE) => {
    const propre = papier(t);
    page.drawText(propre, { x, y, size: taille, font: police, color: teinte });
    trace.textes.push(propre);
  };
  const nouvellePage = () => {
    page = doc.addPage([LARGEUR, HAUTEUR]);
    trace.pages++;
    y = HAUTEUR - 64;
  };
  const place = (h: number) => {
    if (y - h < BAS) nouvellePage();
  };
  const paragraphe = (t: string, police: PDFFont, taille: number, teinte: Teinte, interligne = 1.45, largeur = UTILE) => {
    for (const l of enLignes(t, police, taille, largeur)) {
      place(taille * interligne);
      y -= taille * interligne;
      ecrire(l, MARGE, police, taille, teinte);
    }
  };

  // ─── L'en-tête : l'organisme à gauche, le logo à droite ───────────────────
  const haut = y;
  const largeurTexte = image ? UTILE - LOGO_MAX - 16 : UTILE;
  y -= 4;
  paragraphe(c.entete.nom, p.serif, 17, ENCRE, 1.2, largeurTexte);
  for (const l of c.entete.lignes) paragraphe(l, p.sans, 10, DOUX, 1.5, largeurTexte);
  if (image) {
    const echelle = Math.min(LOGO_MAX / image.width, LOGO_MAX / image.height);
    const w = image.width * echelle;
    const h = image.height * echelle;
    page.drawImage(image, { x: LARGEUR - MARGE - w, y: haut - h, width: w, height: h });
    trace.logos++;
    y = Math.min(y, haut - h);
  }

  // ─── Le titre et la phrase ────────────────────────────────────────────────
  y -= 30;
  paragraphe(c.titre, p.serif, 22, ENCRE, 1.1);
  y -= 8;
  paragraphe(c.phrase, p.sans, 11, ENCRE, 1.5);

  // ─── Le tableau : une ligne par intervention ─────────────────────────────
  const enTete = () => {
    place(40);
    y -= 26;
    for (const [mot, x] of [["DATE", MARGE], ["DURÉE", X_DUREE], ["INTERVENANT", X_NOM]] as const) {
      page.drawText(mot, { x, y, size: 7.5, font: p.gras, color: OR });
      trace.textes.push(mot);
    }
    y -= 7;
    page.drawLine({ start: { x: MARGE, y }, end: { x: LARGEUR - MARGE, y }, thickness: 0.7, color: FILET_TETE });
  };
  enTete();
  for (const l of c.lignes) {
    const noms = enLignes(l.nom, p.sans, 10.5, LARGEUR - MARGE - X_NOM);
    const hauteur = 10 + noms.length * 14 + 13;
    if (y - hauteur < BAS) {
      nouvellePage();
      enTete();
    }
    y -= 16;
    const base = y;
    ecrire(l.date, MARGE, p.sans, 10.5);
    ecrire(l.duree, X_DUREE, p.sans, 10.5);
    noms.forEach((n, i) => {
      y = base - i * 14;
      ecrire(n, X_NOM, p.sans, 10.5);
    });
    y -= 13;
    ecrire(l.numero, X_NOM, p.sans, 9, DOUX);
    y -= 8;
    page.drawLine({ start: { x: MARGE, y }, end: { x: LARGEUR - MARGE, y }, thickness: 0.5, color: FILET });
  }

  // ─── Le montant, puis le lieu et la date ──────────────────────────────────
  place(60);
  y -= 24;
  ecrire(c.total.libelle, MARGE, p.sans, 11, DOUX);
  const montant = papier(c.total.montant);
  page.drawText(montant, { x: LARGEUR - MARGE - p.serif.widthOfTextAtSize(montant, 17), y, size: 17, font: p.serif, color: ENCRE });
  trace.textes.push(montant);
  y -= 34;
  place(20);
  ecrire(c.lieuEtDate, MARGE, p.sans, 10.5);

  return { octets: await protegerContreModification(await doc.save()), trace };
}
