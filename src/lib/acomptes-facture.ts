import Decimal from "decimal.js";
import { enEuros } from "./euros";
import { jourNumerique } from "./jour";
import { echeancierDevis, type AcompteDevis } from "./acomptes-devis";

/**
 * ─── LES ACOMPTES REÇUS SUR LA FACTURE — sa planche du 14 septembre 2026 ────
 *
 * *« Chaque montant perçu avant la fin du chantier est un acompte. »* Sur la
 * facture, chaque règlement reçu prend donc son rang : « Acompte 30 % » pour
 * le premier — le taux du devis —, « Acompte 50 % » pour le deuxième si le
 * devis en prévoyait un, puis « Acompte » tout court. Sous le Total TTC,
 * chaque acompte a sa ligne ; leur somme, qui ne s'écrit pas, se déduit du
 * net à payer. Dans les notes, « Montants versés : chèque n° 1806028 du
 * 02/09/2026, 522,23 € ; virement du 14/09/2026, 25,00 €. » — le moyen, le
 * numéro, la date, le montant, et jamais le mot « acompte ».
 *
 * Tout ici est pur : l'écran de la facture et le PDF appellent ces fonctions,
 * aucun des deux ne les recopie (`CLAUDE.md` §3).
 */

export type MoyenDePaiement = "virement" | "cheque" | "especes" | "carte" | "autre";

/** Les moyens qu'il choisit d'un doigt, dans l'ordre de la planche. */
export const MOYENS_PROPOSES: readonly MoyenDePaiement[] = ["cheque", "virement", "especes", "carte"];

export const LIBELLES_MOYEN: Record<MoyenDePaiement, string> = {
  cheque: "chèque",
  virement: "virement",
  especes: "espèces",
  carte: "carte",
  autre: "règlement",
};

export type ReglementRecu = {
  /** Date civile `AAAA-MM-JJ`. */
  date: string;
  /** En euros TTC, à deux décimales. */
  montant: string;
  moyen: MoyenDePaiement | null;
  /** Le numéro du chèque, quand c'en est un. */
  numero: string | null;
  /** Posé par « Facture acquittée » : le solde, compté reçu. */
  solde: boolean;
};

/** « chèque n° 1806028 », « virement » — le numéro n'a de sens que pour un chèque. */
export function libelleReglement(g: Pick<ReglementRecu, "moyen" | "numero">): string {
  const moyen = LIBELLES_MOYEN[g.moyen ?? "autre"];
  return g.moyen === "cheque" && g.numero?.trim() ? `${moyen} n° ${g.numero.trim()}` : moyen;
}

/**
 * « Acompte 30 % », « Acompte 50 % », « Acompte ».
 *
 * Le rang de l'acompte dit son taux — celui que le devis prévoyait à ce rang.
 * Au-delà des acomptes du devis, ou pour le solde posé par l'interrupteur,
 * « Acompte » tout court : ni taux inventé, ni « solde », qui n'est pas un
 * mot qu'il emploie.
 */
export function nomAcompte(
  reglements: readonly Pick<ReglementRecu, "solde">[],
  index: number,
  acomptesDuDevis: readonly AcompteDevis[]
): string {
  const g = reglements[index];
  if (!g || g.solde) return "Acompte";
  const tries = [...acomptesDuDevis].sort((a, b) => a.rang - b.rang);
  const taux = tries[index]?.tauxCumule;
  return taux ? `Acompte ${new Decimal(taux).toDecimalPlaces(2).toString().replace(".", ",")} %` : "Acompte";
}

/**
 * Ce que le devis prévoyait pour ce rang, en euros : ce qui tombe ce jour-là,
 * c'est-à-dire la différence des cumuls (§343). `null` au-delà des acomptes du
 * devis — rien ne se propose d'office, le chiffre est à lui.
 */
export function montantAcompteDuDevis(
  index: number,
  acomptesDuDevis: readonly AcompteDevis[],
  totalTtc: string | number
): string | null {
  const echeancier = echeancierDevis(acomptesDuDevis, totalTtc);
  return echeancier.lignes[index]?.montant ?? null;
}

/** La somme reçue, à deux décimales. */
export function totalRecu(reglements: readonly Pick<ReglementRecu, "montant">[]): string {
  return reglements.reduce((acc, g) => acc.plus(new Decimal(g.montant || 0)), new Decimal(0)).toFixed(2);
}

/** Ce qui reste à payer — jamais négatif. */
export function netAPayer(totalTtc: string | number, reglements: readonly Pick<ReglementRecu, "montant">[]): string {
  return Decimal.max(0, new Decimal(totalTtc || 0).minus(new Decimal(totalRecu(reglements)))).toFixed(2);
}

/** Acquittée : plus rien à payer, et au moins un règlement reçu. */
export function estAcquittee(totalTtc: string | number, reglements: readonly Pick<ReglementRecu, "montant">[]): boolean {
  return reglements.length > 0 && new Decimal(netAPayer(totalTtc, reglements)).isZero();
}

/**
 * « Montants versés : chèque n° 1806028 du 02/09/2026, 522,23 € ; virement du
 * 14/09/2026, 25,00 €. » — sous la forme qu'il a validée. `null` sans règlement.
 */
export function phraseMontantsVerses(reglements: readonly ReglementRecu[]): string | null {
  if (!reglements.length) return null;
  const parts = reglements.map((g) => `${libelleReglement(g)} du ${jourNumerique(g.date)}, ${enEuros(g.montant)}`);
  return `Montants versés : ${parts.join(" ; ")}.`;
}

/**
 * Le tampon : « Acquittée le 21/09/2026 » — la date du dernier règlement.
 * `null` tant qu'il reste quelque chose à payer.
 */
export function tamponAcquittee(totalTtc: string | number, reglements: readonly ReglementRecu[]): string | null {
  if (!estAcquittee(totalTtc, reglements)) return null;
  const derniere = reglements.map((g) => g.date).sort().at(-1)!;
  return `Acquittée le ${jourNumerique(derniere)}`;
}

/**
 * Ce qu'un règlement reçu doit respecter pour être posé sur une facture en
 * brouillon. Rendu en VALEUR, jamais levé : le refus doit arriver à l'écran
 * avec ses mots (`AGENTS.md`).
 *
 * **Un acompte reçu AVANT la facture est normal ici** — c'est un acompte à la
 * signature. La règle de `refusDuPaiement` (un règlement ne précède pas sa
 * facture) vaut pour une facture ÉMISE, dont la date est arrêtée ; une facture
 * en brouillon n'a pas encore de date qui fasse foi.
 */
export function refusDuReglementRecu(
  totalTtc: string | number,
  dejaRecus: readonly Pick<ReglementRecu, "montant">[],
  neuf: { date: string; montant: string }
): string | null {
  let montant: Decimal;
  try {
    montant = new Decimal(String(neuf.montant ?? "").replace(/\s/g, "").replace(",", ".") || "0");
  } catch {
    return "Le montant reçu doit être un nombre positif.";
  }
  if (!montant.isFinite() || montant.lessThanOrEqualTo(0)) return "Le montant reçu doit être un nombre positif.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(neuf.date)) return "La date du règlement manque, ou n'est pas une date.";
  const reste = new Decimal(netAPayer(totalTtc, dejaRecus));
  if (montant.greaterThan(reste)) return `Il ne reste que ${enEuros(reste.toFixed(2))} à recevoir sur cette facture.`;
  return null;
}
