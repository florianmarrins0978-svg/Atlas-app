import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { charte } from "@/lib/chartes";
import { enJours, nombreDeJours, nomDuMois, phraseDeLAbsence, phraseDeLaCorrection, phraseDuFerieTravaille, resumeDuMois, valeurDuMois } from "@/lib/jours-travailles";
import { MODELES, couleurDeLaCase, manqueAuxZones } from "@/lib/zones-deplacement";
import type { MoisDesSalaries } from "@/server/repositories/jours-travailles";
import { protegerContreModification } from "./proteger-pdf";

/**
 * LES JOURS TRAVAILLÉS DU MOIS, EN PDF : ce que reçoit le comptable (ses
 * planches des 5 et 6 novembre 2026, `appli/soignee/jours-travailles.html` et
 * `zones-deplacement.html`).
 *
 * **Du papier, pas une charte** : les couleurs d'origine, quelle que soit celle
 * que le patron a choisie à l'écran. Les zones gardent leur dégradé, en clair.
 *
 * **Tout le texte vient des règles pures** que l'écran lit aussi
 * (`phraseDeLAbsence`, `phraseDeLaCorrection`) : le comptable lit ce que le
 * patron a vu. La note libre d'une absence n'y est pas : elle est « pour vous ».
 *
 * **Sa remarque du 5 novembre, « aligne tout, fais les choses carrées »** : les
 * colonnes de zones ont toutes la même largeur, chaque en-tête tient sur deux
 * lignes posées en bas, et chaque chiffre est centré sous le sien.
 */

const LARGEUR = 595.28;
const HAUTEUR = 841.89;
const MARGE = 52;
const UTILE = LARGEUR - 2 * MARGE;
const BAS = 70;
const ORIGINE = charte("origine").jetons;

function couleur(hex: string) {
  const n = hex.replace("#", "");
  return rgb(parseInt(n.slice(0, 2), 16) / 255, parseInt(n.slice(2, 4), 16) / 255, parseInt(n.slice(4, 6), 16) / 255);
}

const ENCRE = couleur(ORIGINE.ink);
const DOUX = couleur(ORIGINE.inkSoft);
const DISCRET = couleur("#8a8578");
const VIDE = couleur("#c9c4b8");
const OR = couleur("#b98b47");
const FILET = couleur("#ebe8e1");
const FILET_TETE = couleur("#d9d5cc");
const ROUGE = couleur(ORIGINE.carteRougeTexte);
const BOITE = couleur("#f3f1ec");
const BOITE_BORD = couleur("#e3dfd6");

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

function capitale(t: string): string {
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export async function pdfDesJoursTravailles(lu: MoisDesSalaries, enCours: boolean, prepareLe: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const p = await polices(doc);
  const pages: PDFPage[] = [];
  let page = doc.addPage([LARGEUR, HAUTEUR]);
  pages.push(page);
  let y = HAUTEUR - 64;
  const nouvellePage = () => {
    page = doc.addPage([LARGEUR, HAUTEUR]);
    pages.push(page);
    y = HAUTEUR - 64;
  };
  const place = (h: number) => {
    if (y - h < BAS) nouvellePage();
  };
  const ecrire = (t: string, x: number, police: PDFFont, taille: number, teinte = ENCRE) =>
    page.drawText(papier(t), { x, y, size: taille, font: police, color: teinte });

  const nomMois = capitale(nomDuMois(lu.mois));
  const reglage = lu.reglage;
  const avecZones = reglage !== null && reglage.convention !== "aucune";

  // ─── L'en-tête ──────────────────────────────────────────────────────────
  y -= 30;
  ecrire("Jours travaillés", MARGE, p.serif, 30);
  y -= 22;
  ecrire(nomMois, MARGE, p.serif, 15, DOUX);
  y -= 18;
  page.drawLine({ start: { x: MARGE, y }, end: { x: LARGEUR - MARGE, y }, thickness: 0.8, color: OR });
  y -= 22;

  const colonne = (x: number, libelle: string, lignes: string[]) => {
    let yy = y;
    page.drawText(libelle.toUpperCase(), { x, y: yy, size: 7.5, font: p.gras, color: DISCRET });
    for (const l of lignes) {
      yy -= 14;
      page.drawText(papier(l), { x, y: yy, size: 10.5, font: p.sans, color: ENCRE });
    }
    return yy;
  };
  const entreprise = [lu.entreprise.nom, lu.entreprise.adresse, lu.entreprise.siret ? `SIRET ${lu.entreprise.siret}` : null].filter(
    (x): x is string => !!x
  );
  const droite = avecZones
    ? [`${MODELES[reglage.convention as "paysage" | "batiment"].nom}, depuis le siège`, "à vol d’oiseau"]
    : [resumeDuMois(lu.mois, lu.ouvres, lu.feries, false).replace(/\.$/, "")];
  const y1 = colonne(MARGE, "Entreprise", entreprise.flatMap((l) => enLignes(l, p.sans, 10.5, UTILE / 2 - 12)));
  const y2 = colonne(MARGE + UTILE / 2, avecZones ? "Zones" : "Le mois", droite);
  y = Math.min(y1, y2) - 30;

  // ─── Le tableau ─────────────────────────────────────────────────────────
  const cases = avecZones
    ? [
        ...reglage.zones.map((z, i) => ({ cle: `z${i}`, nom: z.nom, k: i })),
        { cle: "hors", nom: "Hors zone", k: reglage.zones.length },
      ]
    : [];
  const n = cases.length;
  const compte = (s: MoisDesSalaries["salaries"][number], cle: string) => {
    if (cle in s.zonesCorrigees) return s.zonesCorrigees[cle];
    if (!s.zones) return 0;
    return cle === "hors" ? s.zones.hors : s.zones.parZone[Number(cle.slice(1))] ?? 0;
  };
  // « Hors zone » ne paraît que si quelqu'un en a.
  const colonnes = cases.filter((c) => c.cle !== "hors" || lu.salaries.some((s) => compte(s, "hors") > 0));

  const LARGEUR_NOM = avecZones ? 120 : 130;
  const LARGEUR_JOURS = avecZones ? 54 : 70;
  const xJours = MARGE + LARGEUR_NOM;
  const xAbs = xJours + LARGEUR_JOURS + 14;
  const largeurZone = colonnes.length ? (UTILE - LARGEUR_NOM - LARGEUR_JOURS) / colonnes.length : 0;
  const xZone = (i: number) => xJours + LARGEUR_JOURS + i * largeurZone;

  const enTete = () => {
    const hauteur = 30;
    place(hauteur + 40);
    const base = y - hauteur + 8;
    page.drawText("SALARIÉ", { x: MARGE, y: base, size: 7, font: p.gras, color: DISCRET });
    const tJours = avecZones ? "JOURS" : "TRAVAILLÉS";
    page.drawText(tJours, {
      x: xJours + LARGEUR_JOURS - p.gras.widthOfTextAtSize(tJours, 7) - (avecZones ? (LARGEUR_JOURS - p.gras.widthOfTextAtSize(tJours, 7)) / 2 : 14),
      y: base,
      size: 7,
      font: p.gras,
      color: DISCRET,
    });
    if (!avecZones) page.drawText("ABSENCES", { x: xAbs, y: base, size: 7, font: p.gras, color: DISCRET });
    colonnes.forEach((c, i) => {
      // Deux lignes pour TOUS les en-têtes : « Zone » sur « 1A », « Hors » sur « zone ».
      const nom = c.nom.toUpperCase();
      const coupe = nom.indexOf(" ");
      const [haut, bas] = coupe < 0 ? ["", nom] : [nom.slice(0, coupe), nom.slice(coupe + 1)];
      const centre = xZone(i) + largeurZone / 2;
      const mark = couleur(couleurDeLaCase(c.k, n, reglage?.teinte ?? "turquoise").papier);
      page.drawRectangle({ x: centre - 7, y: base + 22, width: 14, height: 5, color: mark });
      if (haut) page.drawText(papier(haut), { x: centre - p.gras.widthOfTextAtSize(papier(haut), 7) / 2, y: base + 9, size: 7, font: p.gras, color: DISCRET });
      page.drawText(papier(bas), { x: centre - p.gras.widthOfTextAtSize(papier(bas), 7) / 2, y: base, size: 7, font: p.gras, color: DISCRET });
    });
    y -= hauteur;
    page.drawLine({ start: { x: MARGE, y }, end: { x: LARGEUR - MARGE, y }, thickness: 0.7, color: FILET_TETE });
  };
  enTete();

  for (const s of lu.salaries) {
    const v = valeurDuMois(s.compte, s.saisi);
    const lignes: { t: string; rouge: boolean }[] = avecZones
      ? []
      : [
          ...s.compte.absences.map((a) => ({ t: capitale(phraseDeLAbsence(a)), rouge: false })),
          ...s.compte.feriesTravailles.map((f) => ({ t: phraseDuFerieTravaille(f), rouge: false })),
          ...[phraseDeLaCorrection(s.compte, s.saisi, s.motif)].filter((x) => x !== null).map((c) => ({ t: c.texte, rouge: c.sansMotif })),
        ];
    if (!avecZones && lignes.length === 0) lignes.push({ t: "Aucune", rouge: false });
    const coupees = lignes.flatMap((l) => enLignes(l.t, p.sans, 9.5, LARGEUR - MARGE - xAbs).map((t) => ({ t, rouge: l.rouge })));
    const hauteur = Math.max(30, 12 + coupees.length * 13 + 6);
    if (y - hauteur < BAS) {
      nouvellePage();
      enTete();
    }
    // Le nom, le chiffre et la première absence posés sur la même ligne d'écriture.
    const base = y - 20;
    page.drawText(papier(s.nom), { x: MARGE, y: base, size: 10.5, font: p.sans, color: ENCRE });
    const chiffre = nombreDeJours(v);
    const largeurChiffre = p.serif.widthOfTextAtSize(chiffre, 15);
    page.drawText(chiffre, {
      x: avecZones ? xJours + (LARGEUR_JOURS - largeurChiffre) / 2 : xJours + LARGEUR_JOURS - 14 - largeurChiffre,
      y: base,
      size: 15,
      font: p.serif,
      color: ENCRE,
    });
    coupees.forEach((l, i) =>
      page.drawText(l.t, { x: xAbs, y: base - i * 13, size: 9.5, font: p.sans, color: l.rouge ? ROUGE : ENCRE })
    );
    colonnes.forEach((c, i) => {
      const nb = compte(s, c.cle);
      const t = String(nb);
      page.drawText(t, {
        x: xZone(i) + (largeurZone - p.serif.widthOfTextAtSize(t, 14)) / 2,
        y: base,
        size: 14,
        font: p.serif,
        color: nb === 0 ? VIDE : ENCRE,
      });
    });
    y -= hauteur;
    page.drawLine({ start: { x: MARGE, y }, end: { x: LARGEUR - MARGE, y }, thickness: 0.5, color: FILET });
  }

  // ─── Avec des zones : les absences et ce qui manque, sous le tableau ────
  if (avecZones) {
    const dits = lu.salaries.flatMap((s) => {
      const t = [
        ...s.compte.absences.map((a) => ({ t: `${s.nom} : ${phraseDeLAbsence(a)}`, rouge: false })),
        ...s.compte.feriesTravailles.map((f) => ({ t: `${s.nom} : ${phraseDuFerieTravaille(f)}`, rouge: false })),
        ...[phraseDeLaCorrection(s.compte, s.saisi, s.motif)].filter((x) => x !== null).map((c) => ({ t: `${s.nom} : ${c.texte}`, rouge: c.sansMotif })),
      ];
      const m = manqueAuxZones(valeurDuMois(s.compte, s.saisi), cases.map((c) => compte(s, c.cle)));
      if (m !== 0) t.push({ t: `${s.nom} : ${m > 0 ? `${enJours(m)} sans zone` : `${enJours(-m)} de trop dans les zones`}.`, rouge: true });
      return t;
    });
    if (dits.length) {
      y -= 22;
      place(30);
      page.drawText("ABSENCES ET CORRECTIONS", { x: MARGE, y, size: 7.5, font: p.gras, color: DISCRET });
      y -= 4;
      for (const d of dits) {
        for (const l of enLignes(d.t, d.rouge ? p.gras : p.sans, 10, UTILE)) {
          place(15);
          y -= 15;
          page.drawText(l, { x: MARGE, y, size: 10, font: d.rouge ? p.gras : p.sans, color: d.rouge ? ROUGE : ENCRE });
        }
      }
    }
  }

  // ─── La boîte du bas ────────────────────────────────────────────────────
  const tete = avecZones
    ? "Un jour compte dans la zone du chantier le plus loin de la journée. Une demi-journée d’absence compte pour une demie."
    : "Une demi-journée d’absence compte pour une demie.";
  const sous = [
    enCours ? `Préparé le ${prepareLe} : le mois n’est pas fini, les jours qui restent sont comptés travaillés.` : `Préparé le ${prepareLe}.`,
    avecZones ? "Atlas compte les jours, les montants restent ceux de votre barème." : null,
  ].filter((x): x is string => !!x);
  const lTete = enLignes(tete, p.sans, 10.5, UTILE - 26);
  const lSous = sous.flatMap((t) => enLignes(t, p.sans, 9, UTILE - 26));
  const hBoite = 20 + lTete.length * 14 + lSous.length * 12;
  y -= 26;
  place(hBoite + 10);
  page.drawRectangle({ x: MARGE, y: y - hBoite, width: UTILE, height: hBoite, color: BOITE, borderColor: BOITE_BORD, borderWidth: 0.7 });
  let yb = y - 8;
  for (const l of lTete) {
    yb -= 14;
    page.drawText(l, { x: MARGE + 13, y: yb, size: 10.5, font: p.sans, color: ENCRE });
  }
  for (const l of lSous) {
    yb -= 12;
    page.drawText(l, { x: MARGE + 13, y: yb, size: 9, font: p.sans, color: DISCRET });
  }

  // ─── Le pied de chaque page ─────────────────────────────────────────────
  pages.forEach((pg, i) => {
    pg.drawText(papier(`Jours travaillés, ${lu.entreprise.nom}`), { x: MARGE, y: 40, size: 8, font: p.sans, color: DISCRET });
    const t = `Page ${i + 1} sur ${pages.length}`;
    pg.drawText(t, { x: LARGEUR - MARGE - p.sans.widthOfTextAtSize(t, 8), y: 40, size: 8, font: p.sans, color: DISCRET });
  });

  doc.setTitle(`Jours travaillés, ${nomMois}`);
  return protegerContreModification(await doc.save());
}
