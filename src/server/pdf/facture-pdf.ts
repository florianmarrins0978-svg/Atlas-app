import {
  composerDocument,
  type DonneesDocument,
  type LigneDocument,
  type TraceDocument,
  type LogoDocument,
} from "./document-commun";
import { jourNumerique } from "../../lib/jour";
import type { Allure } from "@/lib/allure-documents";
import { LIBELLE_MAIN_DOEUVRE } from "@/lib/main-doeuvre-devis";
import { echeancierDevis, modeDeReglement, type AcompteDevis } from "@/lib/acomptes-devis";
import {
  netAPayer,
  nomAcompte,
  phraseMontantsVerses,
  tamponAcquittee,
  type ReglementRecu,
} from "@/lib/acomptes-facture";
import { lireConditions, lignesConditionsFacture, type ConditionsLues } from "@/lib/conditions-documents";
import { enEuros } from "@/lib/euros";
import Decimal from "decimal.js";

// LA FACTURE — le même papier que le devis, sa planche du 14 septembre 2026
// (`appli/le-papier-devis-et-facture.html`) : *« il faut uniformiser les deux
// car c'est la même chose, c'est le titre qui change »*.
//
// Tout ce que le devis imprime, la facture l'imprime aussi — c'est
// `document-commun.ts` qui dessine : les colonnes des pros, la main d'œuvre
// nommée sous le total, les conditions réglées en gras. Ne vit ici que ce qui
// n'a de sens qu'une fois le chantier fait :
//
// - **les acomptes reçus sous le Total TTC**, chacun sa ligne, puis « Net à
//   payer » — la somme des acomptes ne s'écrit pas, elle se déduit ;
// - **« Montants versés »** dans les notes : le moyen, le numéro du chèque, la
//   date, le montant ;
// - **le tampon « Acquittée le … »** quand plus rien n'est dû ;
// - **la main d'œuvre TTC, pour information** — ce qu'un client demande pour
//   son crédit d'impôt.
// - **Aucun cadre de signature.** Une facture ne se signe pas, elle se règle.
//
// **La mention légale du pied reste scellée** : pénalités de retard, indemnité
// de 40 €, absence d'escompte — la loi, pas un réglage. Elle ne se répète donc
// pas dans les conditions en gras. Et la franchise de TVA n'est imprimée que si
// le régime est nul, jamais « au cas où ».

export type LigneFacturePdf = LigneDocument;

export type FacturePdfData = DonneesDocument & {
  numeroCommercial: string;
  statut: "brouillon" | "emise";
  dateEmission: string;
  dateEcheance?: string | null;
  /** Le numéro du devis dont la facture est issue, quand il est connu. */
  numeroDevis?: string | null;
  regimeTva?: "assujettie" | "franchise" | null;
  /** « dont main d'œuvre HT », recopiée du devis (migration 0092). */
  mainDoeuvreHt?: string | null;
  /** Son titre, s'il en a donné un (migration 0092). Vide : rien ne s'imprime. */
  titre?: string | null;
  /** Les acomptes du devis, pour nommer le rang de chaque règlement reçu. */
  acomptesDuDevis?: readonly AcompteDevis[] | null;
  /** Ce qui a été reçu, dans l'ordre où c'est tombé. */
  reglements?: readonly ReglementRecu[] | null;
  /** Les conditions figées sur le devis d'origine — ou celles des Réglages, sans devis. */
  conditionsReglees?: ConditionsLues | null;
};

function mentionLegaleFacture(data: FacturePdfData): string {
  const base =
    "En cas de retard de paiement, une pénalité au taux de trois fois le taux d'intérêt légal " +
    "est exigible, ainsi qu'une indemnité forfaitaire pour frais de recouvrement de 40 €. " +
    "Pas d'escompte pour paiement anticipé.";
  const enFranchise =
    data.regimeTva != null ? data.regimeTva === "franchise" : Number(data.tauxTva) === 0;
  return enFranchise ? `${base} TVA non applicable, art. 293 B du CGI.` : base;
}

export type OptionsFacturePdf = {
  allure?: Allure | null;
  logo?: LogoDocument | null;
  /** La facture d'exemple des Réglages : EXEMPLE en travers de la page. */
  exemple?: boolean;
};

/**
 * Sous le Total TTC : chaque acompte reçu en gris — « Acompte 30 % », « Acompte
 * 50 % », « Acompte » —, puis « Net à payer » dans la fonte du total.
 *
 * **Le trait d'union, jamais le « moins » typographique** : WinAnsi ne le
 * connaît pas, et c'est toute la facture qui ne se générerait plus.
 */
function lignesApresTotal(data: FacturePdfData): { libelle: string; montant: string; style?: "doux" | "grand" }[] {
  const reglements = data.reglements ?? [];
  const acomptes = data.acomptesDuDevis ?? [];
  return [
    ...reglements.map((g, i) => ({
      libelle: nomAcompte(reglements, i, acomptes),
      montant: `-${g.montant}`,
      style: "doux" as const,
    })),
    { libelle: "Net à payer", montant: netAPayer(data.totalTtc, reglements), style: "grand" as const },
  ];
}

function notesEnGras(data: FacturePdfData): string[] {
  const conditions = lireConditions(data.conditionsReglees);
  const mode = data.acomptesDuDevis?.length
    ? modeDeReglement(echeancierDevis(data.acomptesDuDevis, data.totalTtc))
    : null;
  return lignesConditionsFacture(conditions, mode, phraseMontantsVerses(data.reglements ?? []));
}

/**
 * « Pour information, montant de la main d'œuvre TTC : 513,00 €. » — la main
 * d'œuvre nette de remise, au taux du document. Une information, pas un total.
 */
function informations(data: FacturePdfData): string[] {
  if (!data.mainDoeuvreHt) return [];
  const remise = data.reductionPourcent ? new Decimal(data.reductionPourcent) : new Decimal(0);
  const ttc = new Decimal(data.mainDoeuvreHt)
    .times(new Decimal(1).minus(remise.dividedBy(100)))
    .times(new Decimal(1).plus(new Decimal(data.tauxTva).dividedBy(100)))
    .toDecimalPlaces(2);
  return [`Pour information, montant de la main d’œuvre TTC : ${enEuros(ttc.toFixed(2))}.`];
}

export async function composerFacturePdf(
  data: FacturePdfData,
  options: OptionsFacturePdf = {}
): Promise<{ pdf: Uint8Array; trace: TraceDocument }> {
  // La date, l'échéance, le devis d'origine — le numéro, lui, est à droite du
  // titre (sa planche).
  const references: [string, string][] = [["Date", jourNumerique(data.dateEmission)]];
  if (data.dateEcheance) references.push(["Échéance", jourNumerique(data.dateEcheance)]);
  if (data.numeroDevis) references.push(["Devis", data.numeroDevis]);

  return composerDocument(data, {
    allure: options.allure ?? null,
    logo: options.logo ?? null,
    titre: data.statut === "brouillon" ? "FACTURE (BROUILLON)" : "FACTURE",
    numero: data.numeroCommercial,
    titreLibre: data.titre,
    references,
    titreNotes: "NOTES / CONDITIONS",
    notesEnGras: notesEnGras(data),
    sousLeTotalHt: data.mainDoeuvreHt ? [{ libelle: LIBELLE_MAIN_DOEUVRE, montant: data.mainDoeuvreHt }] : [],
    apresTotal: lignesApresTotal(data),
    tampon: tamponAcquittee(data.totalTtc, data.reglements ?? []),
    informations: informations(data),
    mentionLegale: () => mentionLegaleFacture(data),
    cadreSignature: false,
    filigrane: options.exemple ? "EXEMPLE" : null,
  });
}

export async function genererPdfFacture(
  data: FacturePdfData,
  options: OptionsFacturePdf = {}
): Promise<Uint8Array> {
  return (await composerFacturePdf(data, options)).pdf;
}
