import {
  composerDocument,
  PALETTE_DOCUMENT,
  PIED_DOCUMENT,
  type DonneesDocument,
  type LigneDocument,
  type TraceDocument,
} from "./document-commun";
import { jourNumerique } from "../../lib/jour";

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
  /** Recopiée à la création. `null` : aucune durée ne s'imprime. */
  validiteJours?: number | null;
};

/**
 * La durée de validité vient du DEVIS, plus d'une constante.
 *
 * Elle était écrite en dur — « 30 jours », la même pour tous les artisans, et
 * aucun écran ne la montrait. Un couvreur qui tient ses prix quinze jours
 * envoyait donc un devis qui l'engageait trente (`ARCHITECTURE.md` §102).
 *
 * **Elle est recopiée dans le devis à sa création**, comme l'identité : un
 * document garde ce qu'il portait. Les devis d'avant la migration 0040 valent
 * 30, ce que la constante écrivait — ils ne changent pas.
 */
function libelleValiditeDevis(jours: number | null | undefined): string | null {
  if (jours === null || jours === undefined) return null;
  return `${jours} jour${jours > 1 ? "s" : ""}`;
}

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
      // Jour/mois/année : personne, en France, ne lit « 2026-08-04 » sur un
      // devis. Le format ISO reste celui de la base, jamais celui du papier.
      ["Date", jourNumerique(data.dateEmission)],
      // Absente quand l'artisan l'a retirée : une ligne « Validité : — » ferait
      // croire à une donnée perdue.
      ...(libelleValiditeDevis(data.validiteJours)
        ? ([["Validité", libelleValiditeDevis(data.validiteJours) as string]] as [string, string][])
        : []),
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
