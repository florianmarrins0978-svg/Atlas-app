import {
  composerDocument,
  type DonneesDocument,
  type LigneDocument,
  type TraceDocument,
  type LogoDocument,
} from "./document-commun";
import { jourNumerique } from "../../lib/jour";
import type { Allure } from "@/lib/allure-documents";

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
  /**
   * Le régime de TVA **au jour de l'émission**, figé dans la facture
   * (migration 0039).
   *
   * Absent pour les factures antérieures : la mention se déduit alors du taux,
   * exactement comme avant. Ne pas retirer ce repli — il porte tout
   * l'historique.
   */
  regimeTva?: "assujettie" | "franchise" | null;
};

/**
 * La mention du modèle d'Arborea, mot pour mot.
 *
 * La dernière phrase — la franchise de l'article 293 B — porte dans le modèle
 * la consigne « à retirer si vous êtes assujetti à la TVA ». On ne peut pas
 * laisser cette décision à l'impression.
 *
 * **ELLE SE LIT DÉSORMAIS DANS LE RÉGIME DÉCLARÉ, ET NON PLUS DANS LE TAUX**
 * (migration 0039, `ARCHITECTURE.md` §81). Jusqu'au 13 août 2026, la franchise
 * était DEVINÉE : « le taux vaut zéro, donc c'est une franchise ». La situation
 * fiscale de l'entreprise se déduisait donc d'un chiffre saisi chantier par
 * chantier, et les deux sens étaient faux — un artisan en franchise qui laissait
 * 20 % par mégarde perdait une mention obligatoire ; un assujetti qui posait
 * 0 % voyait s'imprimer, sur une pièce comptable, une phrase qui ne le
 * concernait pas.
 *
 * **Le repli sur le taux demeure, et doit demeurer** : les factures émises avant
 * la migration n'ont pas de régime figé, et il porte tout leur historique.
 */
function mentionLegaleFacture(data: FacturePdfData): string {
  const base =
    "En cas de retard de paiement, une pénalité au taux de trois fois le taux d'intérêt légal " +
    "est exigible, ainsi qu'une indemnité forfaitaire pour frais de recouvrement de 40 €. " +
    "Pas d'escompte pour paiement anticipé.";
  const enFranchise =
    data.regimeTva != null ? data.regimeTva === "franchise" : Number(data.tauxTva) === 0;
  return enFranchise ? `${base} TVA non applicable, art. 293 B du CGI.` : base;
}

/**
 * L'allure réglée par le patron (23 août 2026) — la facture la porte comme le
 * devis : ce sont les deux documents que son client reçoit.
 */
export type OptionsFacturePdf = {
  allure?: Allure | null;
  /** Son logo, lu par le dépôt. Une facture est une pièce que le client garde. */
  logo?: LogoDocument | null;
};

export async function composerFacturePdf(
  data: FacturePdfData,
  options: OptionsFacturePdf = {}
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
    allure: options.allure ?? null,
    logo: options.logo ?? null,
    // Une facture non émise qui ne le signale pas peut partir par erreur, et
    // une facture partie est immuable — la corriger demande un avoir.
    titre: data.statut === "brouillon" ? "FACTURE (BROUILLON)" : "FACTURE",
    references,
    titreNotes: "NOTES",
    // `composerDocument` ne connaît que `DonneesDocument` : la fonction reçoit
    // donc `data` par fermeture, qui porte le régime.
    mentionLegale: () => mentionLegaleFacture(data),
    cadreSignature: false,
    rappel: data.numeroDevis ? `Établie à partir du devis n° ${data.numeroDevis}` : null,
  });
}

export async function genererPdfFacture(
  data: FacturePdfData,
  options: OptionsFacturePdf = {}
): Promise<Uint8Array> {
  return (await composerFacturePdf(data, options)).pdf;
}
