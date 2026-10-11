import Decimal from "decimal.js";
import { composerDocument, type DonneesDocument, type LogoDocument } from "./document-commun";
import { jourNumerique } from "../../lib/jour";
import type { Allure } from "@/lib/allure-documents";
import { enEuros } from "@/lib/euros";
import type { LigneAvoirStockee } from "@/lib/avoir";

/**
 * L'avoir, sur le papier de ses factures.
 *
 * **Sa demande du 24 septembre 2026** : *« reprends exactement le style de nos
 * factures pour les transformer en avoir »* (planche `appli/avoir.html`). C'est
 * donc `composerDocument`, le même que la facture : même en-tête, mêmes
 * colonnes, même récapitulatif de TVA. Seuls changent le titre, les références
 * et ce qui suit le total.
 *
 * **Ce que la loi exige** (BOFiP BOI-TVA-DECLA-30-20-20-20, lu à la source) :
 *   - §220 : la facture initiale, son numéro ET sa date ; toutes les mentions
 *     d'une facture (l'en-tête et le client les portent, recopiés d'elle) ;
 *   - §260 : le HT de la réduction et sa TVA (les lignes et le récapitulatif),
 *     et le total HT et la TVA dus APRÈS la réduction (« Nouveau montant »).
 *
 * **Les montants s'impriment en négatif**, avec le trait d'union : WinAnsi ne
 * connaît pas le « moins » typographique, et le document ne se générerait plus
 * (même raison que `lignesApresTotal` de la facture).
 */
export type AvoirPdfData = {
  /** L'en-tête, le client et le lieu, recopiés de la facture qu'il corrige. */
  facture: DonneesDocument & { numeroCommercial: string; dateEmission: string; regimeTva?: "assujettie" | "franchise" | null };
  numero: string;
  dateEmission: string;
  motif: string;
  lignes: readonly LigneAvoirStockee[];
  totalHt: string;
  totalTva: string;
  totalTtc: string;
  /**
   * Ce que la facture vaut après cet avoir (et ceux d'avant) : la loi le
   * demande (§260). « Nouveau montant » et non « reste dû » : un acompte déjà
   * reçu ne s'y retire pas, et le mot « dû » mentirait alors.
   */
  resteHt: string;
  resteTva: string;
  resteTtc: string;
};

const negatif = (x: string) => new Decimal(x).negated().toFixed(2);

export async function genererPdfAvoir(
  data: AvoirPdfData,
  options: { allure?: Allure | null; logo?: LogoDocument | null } = {}
): Promise<Uint8Array> {
  const f = data.facture;
  const enFranchise = f.regimeTva != null ? f.regimeTva === "franchise" : Number(f.tauxTva) === 0;

  const document: DonneesDocument = {
    ...f,
    // **Un avoir ne se paie pas** : ni IBAN, ni chèque, ni conditions de
    // règlement. Les laisser imprimerait « Paiement par virement » sur une
    // pièce qui rend de l'argent au lieu d'en demander.
    entrepriseIban: null,
    consignePaiement: null,
    ordreDuCheque: null,
    conditionsPaiement: null,
    reductionPourcent: null,
    reductionMontant: null,
    totalHt: negatif(data.totalHt),
    totalTva: negatif(data.totalTva),
    totalTtc: negatif(data.totalTtc),
    lignes: data.lignes.map((l) => ({
      libelle: l.libelle,
      quantite: l.quantite,
      unite: l.unite,
      prixUnitaire: negatif(l.prixUnitaire),
      montant: negatif(l.totalHt),
      tauxTva: l.tauxTva,
    })),
  };

  const { pdf } = await composerDocument(document, {
    allure: options.allure ?? null,
    logo: options.logo ?? null,
    titre: "AVOIR",
    numero: data.numero,
    titreLibre: null,
    references: [
      ["Date", jourNumerique(data.dateEmission)],
      ["Facture", f.numeroCommercial],
      ["du", jourNumerique(f.dateEmission)],
    ],
    // Ses mots sur la planche : « Total avoir TTC ».
    libelleTotalTtc: "Total avoir TTC",
    titreNotes: "RECTIFICATION",
    notesEnGras: [
      `Rectifie la facture n° ${f.numeroCommercial} du ${jourNumerique(f.dateEmission)}, prestation de services.`,
      `Motif : ${data.motif}.`,
      `Nouveau montant de la facture : ${enEuros(data.resteHt)} HT, ${enEuros(data.resteTva)} de TVA, ${enEuros(data.resteTtc)} TTC.`,
    ],
    sousLeTotalHt: [],
    apresTotal: [
      { libelle: `Facture ${f.numeroCommercial}`, montant: new Decimal(f.totalTtc).toFixed(2), style: "doux" },
      { libelle: "Nouveau montant TTC", montant: data.resteTtc, style: "grand" },
    ],
    tampon: null,
    informations: [],
    mentionLegale: () => (enFranchise ? "TVA non applicable, art. 293 B du CGI." : ""),
    cadreSignature: false,
  });
  return pdf;
}
