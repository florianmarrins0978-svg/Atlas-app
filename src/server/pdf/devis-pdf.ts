import {
  composerDocument,
  PALETTE_DOCUMENT,
  PIED_DOCUMENT,
  type DonneesDocument,
  type LigneDocument,
  type TraceDocument,
} from "./document-commun";

// Le devis, à l'image du modèle d'Arborea (`appli/devis-modele.html`).
//
// Pourquoi ce fichier est si court : la mise en page vit dans
// `document-commun.ts`, partagée avec la facture. Le modèle du patron donne aux
// deux pièces exactement la même feuille — en-tête, titre centré, colonnes
// émetteur/client, tableau réglé, totaux, notes, modalités, pied. Les copier
// aurait produit deux implémentations qui divergent (`CLAUDE.md` §3), et
// l'écart se serait vu sur ce que le client garde.
//
// Ne reste ici que ce qui appartient au devis : ses références d'en-tête, sa
// durée de validité, sa mention légale, et son cadre de signature.

export type LigneDevisPdf = LigneDocument;

export type DevisPdfData = DonneesDocument & {
  numeroCommercial: string;
  numeroVersion: number;
  statut: "brouillon" | "envoye";
  dateEmission: string;
};

/** Le modèle laisse le devis valable trente jours, mention imprimée en en-tête. */
const VALIDITE = "30 jours";

export async function composerDevisPdf(
  data: DevisPdfData
): Promise<{ pdf: Uint8Array; trace: TraceDocument }> {
  return composerDocument(data, {
    // Le brouillon le dit : un devis non envoyé qui ne le signale pas peut être
    // transmis par erreur, alors qu'il n'engage rien.
    titre: data.statut === "brouillon" ? "DEVIS (BROUILLON)" : "DEVIS",
    references: [
      [
        "Devis n°",
        data.numeroCommercial + (data.numeroVersion > 1 ? ` — v${data.numeroVersion}` : ""),
      ],
      ["Date", data.dateEmission],
      ["Validité", VALIDITE],
    ],
    titreNotes: "NOTES / CONDITIONS",
    mentionLegale: (d) =>
      `Devis établi par ${d.entrepriseNom}, valable selon la durée indiquée ci-dessus. ` +
      "Bon pour accord précédé de la mention manuscrite, daté et signé par le client.",
    cadreSignature: true,
  });
}

export async function genererPdfDevis(data: DevisPdfData): Promise<Uint8Array> {
  return (await composerDevisPdf(data)).pdf;
}

// Réexportés pour ne pas casser les contrôles et les appelants existants.
export type { TraceDocument as TraceDevis, TexteTrace, TraitTrace, CadreTrace } from "./document-commun";
export const PIED_DEVIS = PIED_DOCUMENT;
export const PALETTE_DEVIS = PALETTE_DOCUMENT;
