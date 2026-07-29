import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import Decimal from "decimal.js";

export type LigneDevisPdf = { libelle: string; quantite: string; prixUnitaire: string; montant: string };

export type DevisPdfData = {
  numeroCommercial: string;
  numeroVersion: number;
  statut: "brouillon" | "envoye";
  dateEmission: string;
  entrepriseNom: string;
  entrepriseAdresse?: string | null;
  entrepriseSiret?: string | null;
  entrepriseTelephone?: string | null;
  entrepriseEmail?: string | null;
  clientNom?: string | null;
  clientAdresse?: string | null;
  clientTelephone?: string | null;
  adresseChantier?: string | null;
  conditionsPaiement?: string | null;
  devise: string;
  tauxTva: string;
  totalHt: string;
  totalTva: string;
  totalTtc: string;
  lignes: LigneDevisPdf[];
};

function formatMontant(v: string, devise: string): string {
  return `${new Decimal(v).toFixed(2)} ${devise}`;
}

export async function genererPdfDevis(data: DevisPdfData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const rust = rgb(0.7, 0.35, 0.18);
  const ink = rgb(0.11, 0.106, 0.09);
  const muted = rgb(0.42, 0.4, 0.34);

  const left = 50;
  let y = 790;

  const titre = data.statut === "brouillon" ? "Devis (brouillon)" : "Devis";
  page.drawText(`${titre} ${data.numeroCommercial}${data.numeroVersion > 1 ? ` — v${data.numeroVersion}` : ""}`, {
    x: left,
    y,
    size: 20,
    font: fontBold,
    color: ink,
  });
  y -= 20;
  page.drawText(`Émis le ${data.dateEmission}`, { x: left, y, size: 10, font, color: muted });
  y -= 30;

  page.drawText(data.entrepriseNom, { x: left, y, size: 12, font: fontBold, color: ink });
  y -= 14;
  if (data.entrepriseAdresse) {
    page.drawText(data.entrepriseAdresse, { x: left, y, size: 10, font, color: muted });
    y -= 12;
  }
  if (data.entrepriseSiret) {
    page.drawText(`SIRET ${data.entrepriseSiret}`, { x: left, y, size: 10, font, color: muted });
    y -= 12;
  }
  y -= 15;

  page.drawText("CLIENT", { x: left, y, size: 9, font: fontBold, color: rust });
  y -= 14;
  if (data.clientNom) {
    page.drawText(data.clientNom, { x: left, y, size: 11, font, color: ink });
    y -= 13;
  }
  if (data.clientAdresse) {
    page.drawText(data.clientAdresse, { x: left, y, size: 10, font, color: muted });
    y -= 12;
  }
  if (data.adresseChantier) {
    page.drawText(`Chantier : ${data.adresseChantier}`, { x: left, y, size: 10, font, color: muted });
    y -= 12;
  }
  y -= 20;

  page.drawText("Désignation", { x: left, y, size: 9, font: fontBold, color: muted });
  page.drawText("Qté", { x: 330, y, size: 9, font: fontBold, color: muted });
  page.drawText("PU", { x: 390, y, size: 9, font: fontBold, color: muted });
  page.drawText("Montant", { x: 460, y, size: 9, font: fontBold, color: muted });
  y -= 10;
  page.drawLine({ start: { x: left, y }, end: { x: 545, y }, thickness: 0.5, color: muted });
  y -= 16;

  for (const l of data.lignes) {
    page.drawText(l.libelle.slice(0, 44), { x: left, y, size: 10, font, color: ink });
    page.drawText(new Decimal(l.quantite).toFixed(2), { x: 330, y, size: 10, font, color: ink });
    page.drawText(formatMontant(l.prixUnitaire, data.devise), { x: 385, y, size: 10, font, color: ink });
    page.drawText(formatMontant(l.montant, data.devise), { x: 450, y, size: 10, font, color: ink });
    y -= 16;
  }

  y -= 6;
  page.drawLine({ start: { x: left, y }, end: { x: 545, y }, thickness: 0.5, color: muted });
  y -= 18;

  page.drawText("Total HT", { x: 400, y, size: 10, font, color: muted });
  page.drawText(formatMontant(data.totalHt, data.devise), { x: 470, y, size: 10, font, color: ink });
  y -= 14;
  page.drawText(`TVA (${new Decimal(data.tauxTva).toFixed(2)} %)`, { x: 400, y, size: 10, font, color: muted });
  page.drawText(formatMontant(data.totalTva, data.devise), { x: 470, y, size: 10, font, color: ink });
  y -= 18;
  page.drawText("Total TTC", { x: 400, y, size: 13, font: fontBold, color: rust });
  page.drawText(formatMontant(data.totalTtc, data.devise), { x: 470, y, size: 13, font: fontBold, color: rust });

  if (data.conditionsPaiement) {
    y -= 40;
    page.drawText(data.conditionsPaiement.slice(0, 95), { x: left, y, size: 9, font, color: muted });
  }

  return pdfDoc.save();
}
