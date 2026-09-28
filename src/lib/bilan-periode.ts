import Decimal from "decimal.js";
import type { AvoirPourTva } from "./exigibilite-tva";

/**
 * Ce qu'une entreprise a facturé et encaissé entre deux jours.
 *
 * **Sa question, jouée le 28 septembre 2026 :** « combien j'ai encaissé ce
 * mois », « mon chiffre d'affaires de l'année ». L'assistant n'avait aucune
 * période à lire : `LireFactures` rendait trente factures et un reste dû, et
 * le modèle aurait dû additionner lui-même des dates et des montants. Un
 * modèle qui additionne de tête se trompe, et c'est ce chiffre-là qu'on
 * répète à son comptable (`ARCHITECTURE.md` §420).
 *
 * **Deux totaux, parce que ce sont deux questions.** Facturé : les factures
 * ÉMISES dans la période, moins les avoirs émis dans la période (un avoir
 * retire du chiffre d'affaires le jour où il est fait, pas celui de sa
 * facture). Encaissé : les règlements DATÉS dans la période, quelle que soit
 * la date de leur facture : un client qui paie en octobre une facture de
 * septembre, c'est de l'argent d'octobre.
 *
 * Les bornes sont des jours « AAAA-MM-JJ », comprises. Les comparer en
 * chaîne est exact dans ce format, et c'est celui de toutes les dates du
 * dépôt (`jourIso`).
 */
export type FacturePourBilan = {
  dateEmission: string;
  totalHt: string;
  totalTtc: string;
  avoirs: readonly Pick<AvoirPourTva, "date" | "ht" | "ttc">[];
  paiements: readonly { date: string; montant: string }[];
};

export type BilanDeLaPeriode = {
  du: string;
  au: string;
  factureHt: string;
  factureTtc: string;
  nombreFactures: number;
  nombreAvoirs: number;
  encaisse: string;
  nombreReglements: number;
};

function dans(jour: string, du: string, au: string): boolean {
  return jour >= du && jour <= au;
}

export function bilanDeLaPeriode(factures: readonly FacturePourBilan[], du: string, au: string): BilanDeLaPeriode {
  let ht = new Decimal(0);
  let ttc = new Decimal(0);
  let encaisse = new Decimal(0);
  let nombreFactures = 0;
  let nombreAvoirs = 0;
  let nombreReglements = 0;
  for (const f of factures) {
    if (dans(f.dateEmission, du, au)) {
      ht = ht.plus(f.totalHt || 0);
      ttc = ttc.plus(f.totalTtc || 0);
      nombreFactures++;
    }
    for (const a of f.avoirs) {
      if (!dans(a.date, du, au)) continue;
      ht = ht.minus(a.ht || 0);
      ttc = ttc.minus(a.ttc || 0);
      nombreAvoirs++;
    }
    for (const p of f.paiements) {
      if (!dans(p.date, du, au)) continue;
      encaisse = encaisse.plus(p.montant || 0);
      nombreReglements++;
    }
  }
  return {
    du,
    au,
    factureHt: ht.toFixed(2),
    factureTtc: ttc.toFixed(2),
    nombreFactures,
    nombreAvoirs,
    encaisse: encaisse.toFixed(2),
    nombreReglements,
  };
}
