import {
  composerDocument,
  type DonneesDocument,
  type LigneDocument,
  type TraceDocument,
} from "./document-commun";
import { jourNumerique } from "../../lib/jour";

// La facture, sur le modèle du patron (`appli/facture-modele.html`).
//
// Elle partage sa feuille avec le devis — même en-tête, même tableau, mêmes
// totaux : c'est `document-commun.ts` qui la dessine. Ne vit ici que ce qui
// appartient à une facture, et qui n'est pas cosmétique :
//
// - **Trois références d'en-tête au lieu d'une validité** : numéro, date
//   d'émission, date d'échéance. C'est la date d'échéance qui déclenche les
//   pénalités, et son absence rend la mention légale creuse.
// - **Le rappel du devis d'origine.** Sans lui, le client reçoit deux pièces
//   qu'il doit rapprocher lui-même.
// - **La mention légale du modèle**, reprise mot pour mot : pénalités de retard,
//   indemnité forfaitaire de 40 €, absence d'escompte. Ces mentions sont
//   obligatoires entre professionnels et attendues d'un particulier.
// - **Aucun cadre de signature.** Une facture ne se signe pas, elle se règle.
//   En proposer un inviterait le client à croire qu'il lui reste quelque chose
//   à accepter.
//
// **Rien n'est inventé** : la franchise de TVA n'est imprimée que si le taux
// appliqué est nul, et jamais « au cas où » — une facture qui annonce à tort
// « TVA non applicable » est une facture fausse.

export type LigneFacturePdf = LigneDocument;

export type FacturePdfData = DonneesDocument & {
  numeroCommercial: string;
  statut: "brouillon" | "emise";
  dateEmission: string;
  dateEcheance?: string | null;
  /** Le numéro du devis dont la facture est issue, quand il est connu. */
  numeroDevis?: string | null;
};

/**
 * La mention du modèle d'Arborea, mot pour mot.
 *
 * La dernière phrase — la franchise de l'article 293 B — porte dans le modèle
 * la consigne « à retirer si vous êtes assujetti à la TVA ». On ne peut pas
 * laisser cette décision à l'impression : ici, elle se déduit du taux
 * réellement appliqué. Une facture qui affiche une TVA de 10 % **et** annonce
 * la franchise se contredit sous les yeux du client.
 */
function mentionLegaleFacture(data: DonneesDocument): string {
  const base =
    "En cas de retard de paiement, une pénalité au taux de trois fois le taux d'intérêt légal " +
    "est exigible, ainsi qu'une indemnité forfaitaire pour frais de recouvrement de 40 €. " +
    "Pas d'escompte pour paiement anticipé.";
  const enFranchise = Number(data.tauxTva) === 0;
  return enFranchise ? `${base} TVA non applicable, art. 293 B du CGI.` : base;
}

export async function composerFacturePdf(
  data: FacturePdfData
): Promise<{ pdf: Uint8Array; trace: TraceDocument }> {
  const references: [string, string][] = [
    ["Facture n°", data.numeroCommercial],
    // Jour/mois/année, comme sur le devis : la facture est la pièce la plus
    // lue des deux, et une date à l'envers y fait douter du reste.
    ["Date d'émission", jourNumerique(data.dateEmission)],
  ];
  // Une échéance absente laisse sa ligne vide plutôt que d'afficher une date
  // plausible : c'est elle qui fait courir les pénalités (CLAUDE.md §4).
  if (data.dateEcheance) references.push(["Date d'échéance", jourNumerique(data.dateEcheance)]);

  return composerDocument(data, {
    // Une facture non émise qui ne le signale pas peut partir par erreur, et
    // une facture partie est immuable — la corriger demande un avoir.
    titre: data.statut === "brouillon" ? "FACTURE (BROUILLON)" : "FACTURE",
    references,
    titreNotes: "NOTES",
    mentionLegale: mentionLegaleFacture,
    cadreSignature: false,
    rappel: data.numeroDevis ? `Établie à partir du devis n° ${data.numeroDevis}` : null,
  });
}

export async function genererPdfFacture(data: FacturePdfData): Promise<Uint8Array> {
  return (await composerFacturePdf(data)).pdf;
}
