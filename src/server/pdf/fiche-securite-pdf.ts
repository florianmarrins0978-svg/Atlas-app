import { PDFDocument, PDFFont, PDFImage, PDFPage, rgb, type RGB } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PALETTE_DOCUMENT, PIED_DOCUMENT } from "./document-commun";
import {
  CONSIGNES_DE_SECOURS,
  DECOUVERTE_FORTUITE,
  LIBELLES,
  NOTE_DE_LA_FEUILLE,
  PERIMETRE_DU_DECRET,
  POINTS_DE_VIGILANCE,
  gardeeJusquAu,
  libellesAvecLesSiens,
  estCoche,
  type ContenuFiche,
  type Famille,
} from "../../lib/fiche-securite";

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
  /** Les photos jointes, déjà lues (JPEG ou PNG). */
  photos: readonly { octets: Uint8Array; mime: string }[];
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
    this.page.drawText(`Fiche de sécurité — page ${this.numero}`, {
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
  doc.setTitle(`Fiche de sécurité — ${data.chantierNom}`);
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

  plume.titre("Identification du chantier");
  plume.champ("Lieu (adresse, coordonnées GPS)", [data.adresse, c.gps].filter((x) => x && x.trim()).join(" — "));
  plume.champ("Dates d’exécution, début", [data.jour ? jourDepuisIso(data.jour) : "", c.heureDebut].filter(Boolean).join(", "));
  plume.champ("Dates d’exécution, fin", [data.jour ? jourDepuisIso(data.jour) : "", c.heureFin].filter(Boolean).join(", "));
  plume.vigilance(POINTS_DE_VIGILANCE.horaires);
  plume.sousTitre("Main d’œuvre");
  plume.champ("Responsable de l’entreprise sur le chantier", `${c.responsablePrenom} ${c.responsableNom}`.trim() + (c.responsableTel.trim() ? `, ${c.responsableTel.trim()}` : ""));
  plume.champ("Nombre de travailleurs de l’entreprise", String(c.nombreDeTravailleurs));
  plume.vigilance(POINTS_DE_VIGILANCE.mainDOeuvre);
  if (c.mainDOeuvre.trim()) plume.texte(c.mainDOeuvre.trim(), { retrait: 4 });

  plume.titre("Travaux à réaliser");
  famille(plume, c, "travaux");
  plume.vigilance(POINTS_DE_VIGILANCE.activites);

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

  plume.titre("Matières. État sanitaire et physiologique des arbres");
  famille(plume, c, "matieres");
  plume.vigilance(POINTS_DE_VIGILANCE.matieres);
  if (c.matieresAutres.trim()) plume.champ("Autres (à préciser)", c.matieresAutres);

  plume.titre("Carte / croquis / photo du chantier indiquant les accès, voies de circulation et les végétaux à traiter");
  if (data.photos.length === 0) plume.texte("Aucune photo jointe.", { opacite: 0.7 });
  for (const photo of data.photos) {
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

  plume.filet();
  plume.texte(NOTE_DE_LA_FEUILLE.titre, { grasse: true, taille: 8.5 });
  for (const ligne of NOTE_DE_LA_FEUILLE.lignes) plume.texte(`• ${ligne}`, { taille: 8.5, retrait: 4 });

  return doc.save();
}
