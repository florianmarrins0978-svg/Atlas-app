import { createHash } from "node:crypto";
import { jourIso } from "./jour";
import type { VirementRecu } from "./rapprochement-bancaire";

/**
 * LE RELEVÉ BANCAIRE, LU — règles pures, éprouvées sans banque ni base.
 *
 * Sa remarque du 24 octobre 2026 : *« e-banking permet de lire les virements
 * entrants, mais pas les sortants ; il va falloir le rajouter »*. La banque
 * envoyait déjà les deux sens ; la lecture d'avant jetait les débits. Le
 * dossier du comptable (`appli/pour-mon-comptable.html`) a besoin de chaque
 * ligne.
 *
 * Ce fichier ne parle à personne : `server/banque/enable-banking.ts` appelle la
 * banque et lui passe ce qu'elle rend.
 */

/** Une opération telle qu'Enable Banking la rend, réduite à ce qu'on lit. */
export type Transaction = {
  entry_reference?: string | null;
  transaction_id?: string | null;
  transaction_amount?: { amount?: string; currency?: string };
  credit_debit_indicator?: string;
  status?: string;
  booking_date?: string;
  value_date?: string;
  debtor?: { name?: string } | null;
  creditor?: { name?: string } | null;
  remittance_information?: string[] | null;
};

/**
 * Une ligne du relevé, dans un sens ou dans l'autre, et ce qui la reconnaîtra
 * à la lecture suivante.
 *
 * **Le montant est toujours positif** : `sens` dit de quel côté il va. La
 * contrepartie est celui qui a payé (une entrée) ou celui qui a été payé (une
 * sortie), quand la banque le dit.
 */
export type MouvementLu = {
  cle: string;
  date: string;
  montant: string;
  sens: "entree" | "sortie";
  contrepartie: string | null;
  libelle: string;
};

/** Un virement lu, tel que la carte de l'accueil l'attend. */
export type VirementLu = VirementRecu & { cle: string };

/**
 * **La référence de la banque d'abord** ; à défaut, une empreinte de ce
 * qu'elle montre, compte compris. Sans clé stable, chaque lecture doublerait
 * les lignes.
 *
 * **La formule n'a pas bougé depuis la lecture des seuls virements reçus** :
 * les clés déjà rangées dans `virements_recus` doivent rester les mêmes, sans
 * quoi la lecture suivante reposerait au patron des questions déjà répondues.
 */
function cleDuMouvement(compte: string, t: Transaction, m: Omit<MouvementLu, "cle" | "sens">): string {
  const reference = t.entry_reference?.trim() || t.transaction_id?.trim();
  if (reference) return `${compte}:${reference}`;
  return createHash("sha256").update([compte, m.date, m.montant, m.contrepartie ?? "", m.libelle].join("|")).digest("hex");
}

/**
 * Les lignes d'une page de relevé, dans les deux sens.
 *
 * Seulement les opérations inscrites (`BOOK`) : une opération en attente peut
 * encore disparaître. Seulement l'euro : le dossier du comptable et les
 * factures d'Atlas sont en euros.
 */
export function lireTransactions(compte: string, transactions: readonly Transaction[]): MouvementLu[] {
  const lus: MouvementLu[] = [];
  for (const t of transactions) {
    if (t.status !== "BOOK") continue;
    const sens = t.credit_debit_indicator === "CRDT" ? "entree" : t.credit_debit_indicator === "DBIT" ? "sortie" : null;
    if (!sens) continue;
    if (t.transaction_amount?.currency && t.transaction_amount.currency !== "EUR") continue;
    // La banque peut écrire un débit en négatif ; le sens le dit déjà.
    const brut = t.transaction_amount?.amount?.trim().replace(/^-/, "");
    const date = t.booking_date ?? t.value_date;
    if (!brut || !date || !(Number(brut) > 0)) continue;
    const partie = sens === "entree" ? t.debtor : t.creditor;
    const m = {
      date,
      montant: brut,
      contrepartie: partie?.name?.trim() || null,
      libelle: (t.remittance_information ?? []).join(" ").trim(),
    };
    lus.push({ ...m, sens, cle: cleDuMouvement(compte, t, m) });
  }
  return lus;
}

/** Les entrées d'un relevé, sous la forme qu'attend la question de l'accueil. */
export function virementsDesMouvements(mouvements: readonly MouvementLu[]): VirementLu[] {
  return mouvements
    .filter((m) => m.sens === "entree")
    .map((m) => ({ cle: m.cle, date: m.date, montant: m.montant, payeur: m.contrepartie, libelle: m.libelle }));
}

/**
 * À la première lecture : trente jours de virements reçus, quatre-vingt-dix
 * de relevé.
 *
 * **Deux fenêtres, et c'est voulu.** Un virement reçu devient une question sur
 * l'accueil : trois mois de vieux virements y feraient trois mois de cartes.
 * Le relevé, lui, sert le dossier du comptable, qui veut tout ce que la banque
 * accepte de rendre ; quatre-vingt-dix jours est ce qu'elle rend d'ordinaire.
 */
const PREMIERE_FENETRE_VIREMENTS_JOURS = 30;
const PREMIERE_FENETRE_RELEVE_JOURS = 90;
/** Ensuite, depuis la dernière lecture, moins trois jours de marge. */
const MARGE_JOURS = 3;

/**
 * D'où lire le relevé, et d'où garder les virements reçus : deux jours au
 * format `AAAA-MM-JJ`.
 *
 * Après une première lecture, les deux partent du même jour : la dernière
 * lecture moins la marge, jamais plus tôt que la fenêtre de première lecture.
 */
export function fenetresDeLecture(maintenant: Date, luLe: Date | null): { releve: string; virements: string } {
  const jours = (n: number) => n * 24 * 3600 * 1000;
  const depuis = (fenetre: number) => {
    const plusTot = maintenant.getTime() - jours(fenetre);
    return jourIso(new Date(luLe ? Math.max(plusTot, luLe.getTime() - jours(MARGE_JOURS)) : plusTot));
  };
  return { releve: depuis(PREMIERE_FENETRE_RELEVE_JOURS), virements: depuis(PREMIERE_FENETRE_VIREMENTS_JOURS) };
}
