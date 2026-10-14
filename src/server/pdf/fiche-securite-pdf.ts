import { LineCapStyle, PDFDocument, PDFFont, PDFImage, PDFPage, rgb, type RGB } from "pdf-lib";
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

class Plume {
  page!: PDFPage;
  y = HAUTEUR - MARGE;
  numero = 0;
  constructor(
    private doc: PDFDocument,
    private polices: { normale: PDFFont; grasse: PDFFont },
    private encre: RGB,
    private accent: RGB,
    private trait: RGB
  ) {
    this.nouvellePage();
  }
  nouvellePage() {
    this.page = this.doc.addPage([LARGEUR, HAUTEUR]);
    this.page.drawRectangle({ x: 0, y: 0, width: LARGEUR, height: HAUTEUR, color: teinte(PALETTE_DOCUMENT.papier) });
    this.y = HAUTEUR - MARGE;
    this.numero++;
    this.page.drawText(`Fiche de sécurité, page ${this.numero}`, {
      x: MARGE,
      y: PLANCHER - 14,
      size: 7.5,
      font: this.polices.normale,
      color: this.encre,
      opacity: 0.6,
    });
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
    const largeur = LARGEUR - 2 * MARGE - retrait;
    for (const ligne of this.lignes(texte, police, taille, largeur)) {
      this.place(taille * INTERLIGNE);
      this.page.drawText(ligne, { x: MARGE + retrait, y: this.y - taille, size: taille, font: police, color: options.couleur ?? this.encre, opacity: options.opacite });
      this.y -= taille * INTERLIGNE;
    }
  }
  espace(h: number) {
    this.y -= h;
  }
  titre(texte: string) {
    this.espace(10);
    this.place(30);
    this.page.drawRectangle({ x: MARGE, y: this.y - 17, width: LARGEUR - 2 * MARGE, height: 17, color: this.accent, opacity: 0.12 });
    this.page.drawText(texte.toUpperCase(), { x: MARGE + 6, y: this.y - 12.5, size: 9, font: this.polices.grasse, color: this.encre });
    this.y -= 24;
  }
  sousTitre(texte: string) {
    this.espace(4);
    this.texte(texte, { grasse: true, taille: 9.5 });
  }
  vigilance(texte: string) {
    this.texte(`Point de vigilance : ${texte}`, { taille: 8.5, opacite: 0.75, retrait: 4 });
  }
  champ(nom: string, valeur: string) {
    this.texte(`${nom} : ${valeur.trim() || "—"}`, {});
  }
  case(libelle: string, cochee: boolean, retrait = 0) {
    const taille = CORPS;
    const x = MARGE + retrait;
    const lignes = this.lignes(libelle, this.polices.normale, taille, LARGEUR - 2 * MARGE - retrait - 14);
    this.place(lignes.length * taille * INTERLIGNE + 2);
    const yCase = this.y - taille + 1;
    this.page.drawRectangle({ x, y: yCase, width: 7.5, height: 7.5, borderColor: this.encre, borderWidth: 0.6, color: cochee ? this.accent : undefined });
    if (cochee) {
      this.page.drawLine({ start: { x: x + 1.6, y: yCase + 3.6 }, end: { x: x + 3.2, y: yCase + 1.8 }, thickness: 1, color: rgb(1, 1, 1) });
      this.page.drawLine({ start: { x: x + 3.2, y: yCase + 1.8 }, end: { x: x + 6.2, y: yCase + 6 }, thickness: 1, color: rgb(1, 1, 1) });
    }
    lignes.forEach((ligne, i) => {
      this.page.drawText(ligne, { x: x + 12, y: this.y - taille - i * taille * INTERLIGNE, size: taille, font: this.polices.normale, color: this.encre });
    });
    this.y -= lignes.length * taille * INTERLIGNE + 2;
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

async function dessinerLeCroquis(doc: PDFDocument, plume: Plume, croquis: Croquis, fond: { octets: Uint8Array; mime: string } | null, police: { normale: PDFFont; grasse: PDFFont }) {
  const largeur = LARGEUR - 2 * MARGE;
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

async function polices(doc: PDFDocument): Promise<{ normale: PDFFont; grasse: PDFFont }> {
  // Inter, embarquée : les polices standard d'un PDF (WinAnsi) n'ont ni « ≤ »
  // ni « … », et la feuille en est pleine (HTA (U ≤ 50 000 V)).
  doc.registerFontkit(fontkit);
  const dossier = path.join(process.cwd(), "src/server/pdf/polices");
  const [normale, grasse] = await Promise.all([readFile(path.join(dossier, "inter-400.ttf")), readFile(path.join(dossier, "inter-700.ttf"))]);
  return { normale: await doc.embedFont(normale, { subset: true }), grasse: await doc.embedFont(grasse, { subset: true }) };
}

function famille(plume: Plume, contenu: ContenuFiche, nom: Famille, retrait = 0) {
  for (const libelle of libellesAvecLesSiens(contenu, nom)) plume.case(libelle, estCoche(contenu, nom, libelle), retrait);
}

export async function composerFicheSecuritePdf(data: FicheSecuritePdfData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Fiche de sécurité, ${data.chantierNom}`);
  doc.setLanguage("fr-FR");
  const p = await polices(doc);
  const encre = teinte(PALETTE_DOCUMENT.encre);
  const accent = teinte(PALETTE_DOCUMENT.titrePartie);
  const plume = new Plume(doc, p, encre, accent, teinte(PALETTE_DOCUMENT.traitClair));
  const c = data.contenu;

  // ─── L'en-tête, comme la feuille ───
  plume.page.drawText("FICHE DE SÉCURITÉ", { x: MARGE, y: plume.y - 18, size: 18, font: p.grasse, color: encre });
  plume.y -= 26;
  plume.texte("Fiche d’intervention en lien avec le décret 2021-1833 du 24 décembre 2021 relatif aux règles de sécurité applicables aux travaux agricoles dans les parcs et jardins et autres travaux d’entretien de la végétation.", { taille: 8, opacite: 0.8 });
  plume.espace(6);
  plume.champ("Nom du chantier", data.chantierNom);
  plume.champ("N° de devis et/ou de commande afférent", data.numeroDevis ?? "");

  plume.titre("Identification");
  plume.sousTitre("Entreprise réalisant le chantier");
  plume.champ("Raison sociale", data.entrepriseNom);
  plume.champ("Téléphone (en cas d’incident ou d’accident)", c.telephoneIncident);
  plume.sousTitre("Donneur d’ordre");
  if (c.donneur === "client") {
    plume.champ("Raison sociale", data.clientNom ?? "");
  } else if (c.donneur === "autre") {
    plume.champ("Nom, prénom", `${c.donneurPrenom} ${c.donneurNom}`.trim());
    plume.champ("Téléphone (en cas d’incident ou d’accident)", c.donneurTel);
  } else plume.champ("Raison sociale", "");
  if (c.donneurRole.trim()) plume.champ("Ce qu’il est pour le chantier", c.donneurRole);

  plume.titre("Identification du chantier");
  plume.champ("Lieu (adresse, coordonnées GPS)", [data.adresse, c.gps].filter((x) => x && x.trim()).join(", "));
  if (c.adresseSecours.trim()) plume.champ("Adresse d’accès des secours", c.adresseSecours);
  plume.champ("Dates d’exécution, début", [data.jour ? jourDepuisIso(data.jour) : "", c.heureDebut].filter(Boolean).join(", "));
  plume.champ("Dates d’exécution, fin", [data.jour ? jourDepuisIso(data.jour) : "", c.heureFin].filter(Boolean).join(", "));
  plume.vigilance(POINTS_DE_VIGILANCE.horaires);
  plume.sousTitre("Main d’œuvre");
  plume.champ("Responsable de l’entreprise sur le chantier", `${c.responsablePrenom} ${c.responsableNom}`.trim() + (c.responsableTel.trim() ? `, ${c.responsableTel.trim()}` : ""));
  for (const r of c.autresResponsables) if (r.nom.trim()) plume.champ("Autre responsable", r.nom.trim() + (r.tel.trim() ? `, ${r.tel.trim()}` : ""));
  plume.champ("Nombre de travailleurs de l’entreprise", String(c.nombreDeTravailleurs));
  plume.vigilance(POINTS_DE_VIGILANCE.mainDOeuvre);
  // Les compétences à la date de la signature : c'est ce jour-là que la fiche les affirme.
  const ceJour = data.signeeLe ?? new Date();
  for (const personne of c.equipe.filter((x) => x.present && x.nom.trim())) {
    const sst = validite(personne.sst, ceJour), gsa = validite(personne.gsa, ceJour);
    const dit = [
      ...personne.formations,
      sst.ok && sst.fin ? `SST jusqu’au ${dateLongue(sst.fin)}` : "SST : non à jour",
      gsa.ok && gsa.fin ? `GSA jusqu’au ${dateLongue(gsa.fin)}` : "GSA : non",
    ];
    plume.texte(`${personne.nom.trim()} : ${dit.join(", ")}.`, { retrait: 4 });
  }
  if (c.mainDOeuvre.trim()) plume.texte(c.mainDOeuvre.trim(), { retrait: 4 });
  plume.sousTitre("Sous-traitants et autres entreprises sur le chantier");
  const surPlace = c.entreprisesSurPlace === "oui" ? c.entreprises.filter((x) => x.presente && x.nom.trim()) : [];
  if (surPlace.length === 0) plume.texte(c.entreprisesSurPlace === "aucune" ? "Aucune." : "—", { retrait: 4 });
  for (const x of surPlace) {
    plume.texte(`${x.nom.trim()}${x.quoi.trim() ? `, ${x.quoi.trim()}` : ""}${x.tel.trim() ? `, ${x.tel.trim()}` : ""}. Fiche présentée à son responsable : ${x.montree ? "oui" : "non"}.`, { retrait: 4 });
  }

  plume.titre("Travaux à réaliser");
  famille(plume, c, "travaux");
  plume.vigilance(POINTS_DE_VIGILANCE.activites);

  plume.titre("Les EPI");
  famille(plume, c, "epi");

  plume.titre("Matériels");
  plume.vigilance(POINTS_DE_VIGILANCE.materiels);
  plume.sousTitre("Moyens d’élévation");
  plume.vigilance(POINTS_DE_VIGILANCE.elevation);
  famille(plume, c, "elevation");
  plume.vigilance(POINTS_DE_VIGILANCE.echelle);
  plume.sousTitre("Matériels de coupe");
  plume.vigilance(POINTS_DE_VIGILANCE.distanceMateriels);
  famille(plume, c, "coupe");
  plume.sousTitre("Matériels autres");
  plume.vigilance(POINTS_DE_VIGILANCE.distanceMateriels);
  famille(plume, c, "autresMateriels");

  plume.titre("La situation des travaux");
  famille(plume, c, "situation");

  plume.titre("Les arbres dangereux");
  if (c.arbresDangereux !== "oui" || c.arbres.length === 0) plume.texte(c.arbresDangereux === "non" ? "Aucun." : "—", { retrait: 4 });
  else c.arbres.forEach((a, i) => {
    plume.sousTitre(`${a.groupe ? "Groupe d’arbres" : "Arbre"} ${i + 1}, numéro ${i + 1} sur le croquis`);
    plume.champ("Intervention", a.intervention ?? "");
    plume.champ("Dangers vus", a.dangers.join(", "));
    plume.champ("Consignes", [...a.consignes, a.autres.trim()].filter(Boolean).join(", "));
  });

  plume.titre("Les arbres pendant l’intervention");
  famille(plume, c, "risquesArbres");
  plume.sousTitre("Matières. État sanitaire et physiologique des arbres");
  famille(plume, c, "matieres");
  plume.vigilance(POINTS_DE_VIGILANCE.matieres);
  if (c.matieresAutres.trim()) plume.champ("Autres (à préciser)", c.matieresAutres);

  plume.titre("Carte / croquis / photo du chantier indiquant les accès, voies de circulation et les végétaux à traiter");
  const fond = data.photos.find((x) => x.id === c.croquis.fondPhotoId) ?? null;
  if (c.croquis.fond) {
    await dessinerLeCroquis(doc, plume, c.croquis, fond, p);
    const poses = new Set(c.croquis.marques.map((m) => m.t));
    const legende = OUTILS_DU_CROQUIS.filter((o) => o.t !== "crayon" && poses.has(o.t)).map((o) => o.libelle);
    if (legende.length) plume.texte(`Légende : ${legende.join(", ")}. Les numéros des arbres sont ceux des arbres dangereux.`, { taille: 8.5 });
    const manque = manquesDuCroquis(c.croquis);
    if (manque.length) plume.texte(`Croquis incomplet, il manque : ${manque.join(", ")}.`, { taille: 8.5, grasse: true });
  } else plume.texte("Aucun croquis.", { opacite: 0.7 });
  const autresPhotos = data.photos.filter((x) => x.id !== c.croquis.fondPhotoId);
  if (autresPhotos.length) plume.sousTitre("Photos du balisage et des zones sensibles");
  for (const photo of autresPhotos) {
    try {
      const img = photo.mime === "image/png" ? await doc.embedPng(photo.octets) : await doc.embedJpg(photo.octets);
      plume.image(img, LARGEUR - 2 * MARGE, 300);
    } catch {
      plume.texte("Une photo jointe n’a pas pu être imprimée.", { opacite: 0.7 });
    }
  }
  plume.texte("Délimitation matérielle du chantier obligatoire", { taille: 8.5, opacite: 0.75 });
  plume.sousTitre("Périmètre de sécurité, d’après le décret");
  for (const [quoi, combien] of PERIMETRE_DU_DECRET) plume.texte(`${quoi} : ${combien}`, { retrait: 4 });
  plume.sousTitre("Zones du chantier");
  famille(plume, c, "balisage");
  if (c.communication.trim()) plume.champ("Moyen de communication", c.communication);

  plume.titre("Risques spécifiques au chantier. Risque biologique");
  famille(plume, c, "biologique");
  plume.sousTitre("Mesures de prévention spécifiques au chantier");
  famille(plume, c, "biologiqueMesures");

  plume.titre("Risques liés aux réseaux, aériens et souterrains");
  for (const libelle of libellesAvecLesSiens(c, "reseaux")) {
    plume.case(libelle, estCoche(c, "reseaux", libelle));
    if (libelle === "Électrique") for (const t of LIBELLES.tensions) plume.case(t, estCoche(c, "tensions", t), 16);
  }
  plume.sousTitre("Mesures");
  for (const libelle of libellesAvecLesSiens(c, "reseauxMesures")) {
    plume.case(libelle, estCoche(c, "reseauxMesures", libelle));
    if (libelle === LIBELLES.reseauxMesures[2]) for (const d of LIBELLES.distances) plume.case(d, estCoche(c, "distances", d), 16);
  }
  plume.texte(`Au cas où : ${DECOUVERTE_FORTUITE.mot}`, { taille: 8.5, opacite: 0.75 });

  plume.titre("La noyade");
  famille(plume, c, "noyade");

  plume.titre("Risques liés à l’environnement du chantier");
  famille(plume, c, "environnement");
  plume.sousTitre("Mesures");
  famille(plume, c, "environnementMesures");
  if (c.environnementPreciser.trim()) plume.champ("Préciser", c.environnementPreciser);

  plume.titre("Co-activité dans la zone de sécurité du chantier");
  famille(plume, c, "coactivite");
  plume.champ("Risques autres identifiés", c.risquesAutres);
  plume.champ("Mesures de prévention autres", c.mesuresAutres);

  plume.titre("Règles organisationnelles à mettre en place");
  famille(plume, c, "organisation");
  if (c.organisationCommunication.trim()) plume.champ("Mode de communication", c.organisationCommunication);
  plume.vigilance(POINTS_DE_VIGILANCE.manuel);

  plume.titre("Entrer dans une zone de danger");
  for (const ligne of (c.protocole.trim() || "—").split("\n")) plume.texte(ligne, { retrait: 4 });

  plume.titre("Consignes sur la conduite à tenir en cas de phénomènes météorologiques imprévus");
  plume.vigilance(POINTS_DE_VIGILANCE.bulletins);
  famille(plume, c, "meteo");

  plume.titre("Organisation des secours. Ressources humaines et matérielles");
  famille(plume, c, "secours");
  plume.champ("Préciser le lieu où se trouve la trousse de secours", c.lieuTrousse);
  plume.champ("Préciser le Point de Rencontre des Secours", c.pointDeRencontre);

  plume.titre("Organisation des secours. Consignes et procédures");
  plume.sousTitre("1. Protéger");
  CONSIGNES_DE_SECOURS.proteger.forEach((x, i) => plume.texte(`${i + 1}. ${x}`, { retrait: 4 }));
  plume.sousTitre("2. Alerter");
  plume.texte(CONSIGNES_DE_SECOURS.urgences.map(([n, q]) => `${q} ${n}`).join(", "), { grasse: true, retrait: 4 });
  CONSIGNES_DE_SECOURS.alerter.forEach((x, i) => plume.texte(`${i + 1}. ${x}`, { retrait: 4 }));
  plume.sousTitre("3. Secourir");
  CONSIGNES_DE_SECOURS.secourir.forEach((x, i) => plume.texte(`${i + 1}. ${x}`, { retrait: 4 }));
  plume.texte(CONSIGNES_DE_SECOURS.permanentes[0], { retrait: 4, taille: 8.5 });
  plume.texte(CONSIGNES_DE_SECOURS.permanentes[1], { retrait: 4, taille: 8.5, grasse: true });

  plume.titre("Observations / Consignes particulières");
  plume.texte(c.observations.trim() || "—");

  plume.titre("Enregistrement");
  plume.champ("Nom et prénom du chef d’entreprise (ou de son représentant)", data.signataire ?? "");
  plume.champ("Date", data.signeeLe ? dateLongue(data.signeeLe) : "");
  if (data.signeeLe) plume.texte(`Gardée jusqu’au ${dateLongue(gardeeJusquAu(data.signeeLe))}.`, { taille: 8.5, opacite: 0.75 });
  if (data.signaturePng?.startsWith("data:image/png;base64,")) {
    try {
      const img = await doc.embedPng(Buffer.from(data.signaturePng.slice("data:image/png;base64,".length), "base64"));
      plume.texte("Signature", { grasse: true, taille: 8.5 });
      plume.image(img, 220, 90);
    } catch {
      plume.texte("Signature illisible.", { opacite: 0.7 });
    }
  } else plume.texte("Non signée.", { opacite: 0.7 });

  // La lecture de chaque salarié, sa signature et son heure : la preuve que la fiche lui a été présentée.
  if (c.lectures.length > 0 || (data.signeeLe && lecturesManquantes(c).length > 0)) {
    plume.titre("Présentée aux travailleurs");
    for (const l of c.lectures) {
      plume.texte(`${l.nom}, a lu la fiche le ${dateLongue(new Date(l.le))} à ${new Date(l.le).toLocaleTimeString("fr-FR", { hour: "numeric", minute: "2-digit", timeZone: "Europe/Paris" }).replace(":", " h ")}.`, { grasse: true, taille: 8.5 });
      try {
        plume.image(await doc.embedPng(Buffer.from(l.png.slice("data:image/png;base64,".length), "base64")), 160, 60);
      } catch (erreur) {
        console.error("[fiche-securite-pdf] signature de lecture illisible", erreur);
        plume.texte("Signature illisible.", { opacite: 0.7 });
      }
    }
    for (const nom of lecturesManquantes(c)) plume.texte(`${nom} : pas encore signé.`, { taille: 8.5, opacite: 0.8 });
  }

  plume.filet();
  plume.texte(NOTE_DE_LA_FEUILLE.titre, { grasse: true, taille: 8.5 });
  for (const ligne of NOTE_DE_LA_FEUILLE.lignes) plume.texte(`• ${ligne}`, { taille: 8.5, retrait: 4 });

  return doc.save();
}
