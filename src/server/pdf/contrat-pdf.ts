import { composerDocument, type DonneesDocument, type LogoDocument, type TraceDocument } from "./document-commun";
import type { Allure } from "@/lib/allure-documents";
import {
  designationSurLePapier,
  mensualites,
  montantDeLaPrestation,
  passagesDeLaPrestation,
  periodeEnLettres,
  totauxDuContrat,
  type FacturationContrat,
  type PeriodeContrat,
  type PrestationContrat,
} from "@/lib/contrats-entretien";

/**
 * LE CONTRAT D'ENTRETIEN SUR LE PAPIER, par la fabrique des devis.
 *
 * **La même mise en page que ses devis, et c'est voulu** : sa planche 129 en
 * montrait l'aperçu sorti de `composerDocument`, et c'est ce document-là qu'il
 * a regardé. Un second gabarit aurait fait deux allures pour ce que son client
 * lit.
 *
 * **Une ligne par prestation, comptée en passages** : « Tonte et ébarbage,
 * 2 passages par mois, d'avril à octobre », 14 × 45 €. Le client recompte, et
 * le compte tombe.
 */
export type DonneesContratPdf = Omit<DonneesDocument, "lignes" | "totalHt" | "totalTva" | "totalTtc" | "tauxTva" | "devise"> & {
  prestations: PrestationContrat[];
  periode: PeriodeContrat;
  reconduit: boolean;
  facturation: FacturationContrat;
  tauxTva: string;
  dateDuDocument: string;
  statut: "brouillon" | "envoye" | "accepte" | "refuse";
  /**
   * Accepté et signé sur son lien (migration 0184) : le trait se pose dans le
   * cadre, avec son nom et le jour, sans l'heure. Absente : le cadre vide.
   */
  signature?: { png: Uint8Array; nom: string; jour: string } | null;
};

function jourNumerique(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
}

function eurosEcrits(v: string): string {
  const [entiere, decimales] = v.split(".");
  return `${entiere.replace(/\B(?=(\d{3})+(?!\d))/g, " ")},${decimales} €`;
}

/** Les conditions, en phrases : la période, la reconduction, la météo, la facture. */
function conditionsDuContrat(d: DonneesContratPdf, ttc: string): string {
  const phrases = [
    `${periodeEnLettres(d.periode)}${d.reconduit ? ", reconduit à son terme sauf résiliation un mois avant" : ""}.`,
    "Les passages sont fixés d'un mois à l'autre selon la météo.",
  ];
  if (d.facturation === "mois") {
    const m = mensualites(ttc, d.periode.dureeMois);
    phrases.push(
      m.montant === m.derniere
        ? `Facturation : ${m.nombre} mensualités de ${eurosEcrits(m.montant)} TTC, le 1er de chaque mois.`
        : `Facturation : ${m.nombre - 1} mensualités de ${eurosEcrits(m.montant)} TTC et une de ${eurosEcrits(m.derniere)}, le 1er de chaque mois.`
    );
  } else {
    phrases.push("Chaque passage est facturé une fois fait. Un passage qui n'a pas lieu n'est pas facturé.");
  }
  return phrases.join(" ");
}

/**
 * Le PDF et sa trace : la trace dit où la signature est tombée, ce qu'aucun
 * contrôle ne lirait dans un PDF protégé (`test-contrat-signe-pdf.ts`).
 */
export async function composerContratPdf(
  d: DonneesContratPdf,
  habillage: { allure?: Allure | null; logo?: LogoDocument | null } = {}
): Promise<{ pdf: Uint8Array; trace: TraceDocument }> {
  const totaux = totauxDuContrat(d.prestations, d.periode, d.tauxTva);
  return composerDocument(
    {
      ...d,
      devise: "EUR",
      tauxTva: d.tauxTva,
      totalHt: totaux.totalHt,
      totalTva: totaux.totalTva,
      totalTtc: totaux.totalTtc,
      conditionsPaiement: conditionsDuContrat(d, totaux.totalTtc),
      lignes: d.prestations.map((p) => {
        const montant = montantDeLaPrestation(p, d.periode);
        return {
          libelle: designationSurLePapier(p),
          quantite: String(passagesDeLaPrestation(p, d.periode)),
          unite: "passage",
          prixUnitaire: p.prixPassageHt ?? "0.00",
          montant: montant ?? "0.00",
          aChiffrer: p.prixPassageHt === null,
        };
      }),
    },
    {
      allure: habillage.allure,
      logo: habillage.logo,
      // Le brouillon le dit, comme un devis : un document non envoyé qui ne le
      // signale pas peut partir par erreur.
      titre: d.statut === "brouillon" ? "CONTRAT D'ENTRETIEN (BROUILLON)" : "CONTRAT D'ENTRETIEN",
      references: [
        ["Date", jourNumerique(d.dateDuDocument)],
        ["Durée", `${d.periode.dureeMois} mois${d.reconduit ? ", reconduit" : ""}`],
      ],
      titreNotes: "CONDITIONS DU CONTRAT",
      libelleTotalTtc: "Total TTC du contrat",
      apresTotal:
        d.facturation === "mois"
          ? [{ libelle: "Soit par mois", montant: mensualites(totaux.totalTtc, d.periode.dureeMois).montant, style: "grand" }]
          : [],
      mentionLegale: (x) =>
        d.signature
          ? `Contrat établi par ${x.entrepriseNom}. Accepté et signé en ligne par le client le ${jourNumerique(d.signature.jour)}.`
          : `Contrat établi par ${x.entrepriseNom}. Bon pour accord donné par le client sur le lien reçu, ` +
            "ou daté et signé ci-contre.",
      cadreSignature: true,
      signature: d.signature
        ? { png: d.signature.png, phrase: `Signé en ligne par ${d.signature.nom}, le ${jourNumerique(d.signature.jour)}.` }
        : null,
    }
  );
}
