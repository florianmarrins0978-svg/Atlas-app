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
 *
 * Deux opérations identiques le même jour sans référence (deux pleins au même
 * montant, même libellé) ont la même empreinte. C'est le rang de la répétition
 * qui les sépare (`lireTransactions`), jamais la première occurrence : celle-ci
 * garde la clé qu'elle avait avant.
 */
function cleDeBase(compte: string, t: Transaction, m: Omit<MouvementLu, "cle" | "sens">): { cle: string; sansReference: boolean } {
  const reference = t.entry_reference?.trim() || t.transaction_id?.trim();
  if (reference) return { cle: `${compte}:${reference}`, sansReference: false };
  const empreinte = createHash("sha256").update([compte, m.date, m.montant, m.contrepartie ?? "", m.libelle].join("|")).digest("hex");
  return { cle: empreinte, sansReference: true };
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
  const vus = new Map<string, number>();
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
    const { cle, sansReference } = cleDeBase(compte, t, m);
    // Le rang suit l'ordre de la banque, qui reste le même d'une lecture à
    // l'autre : chaque lecture couvre les jours entiers depuis le début du
    // dossier, donc les répétitions reçoivent les mêmes clés.
    const rang = (vus.get(cle) ?? 0) + 1;
    vus.set(cle, rang);
    lus.push({ ...m, sens, cle: sansReference && rang > 1 ? `${cle}:${rang}` : cle });
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
 * La profondeur demandée à la banque, en jours, du plus profond au plus court.
 *
 * Le patron veut chaque ligne que la banque rend : on demande donc le plus
 * profond, puis on descend si elle refuse. Le dernier niveau, quatre-vingt-dix
 * jours, est celui qu'une banque accepte d'ordinaire sans nouvelle validation.
 * Sur ce poste, la profondeur qu'elle accepte réellement reste non vérifiée.
 */
export const NIVEAUX_D_HISTORIQUE_JOURS = [1826, 730, 90] as const;

/** Les virements à répondre : les trente derniers jours, toujours depuis aujourd'hui. */
const FENETRE_VIREMENTS_JOURS = 30;

/** Le premier jour du relevé, à `joursDHistorique` jours d'aujourd'hui, au format `AAAA-MM-JJ`. */
export function debutDuReleve(maintenant: Date, joursDHistorique: number): string {
  return jourIso(new Date(maintenant.getTime() - joursDHistorique * 24 * 3600 * 1000));
}

export function fenetreDeVirements(maintenant: Date): string {
  return debutDuReleve(maintenant, FENETRE_VIREMENTS_JOURS);
}

/** Un refus de la banque, avec son statut HTTP s'il en a un. Sans statut : pas de réponse du tout. */
export type RefusBanque = { ok: false; raison: string; statut?: number };

/**
 * Lit au niveau de profondeur le plus élevé que la banque accepte.
 *
 * **Seul un refus de période descend au niveau suivant.** Une limite de débit
 * (429), un accès expiré (401), ou une panne sans réponse arrêtent tout : un
 * autre niveau ne les répare pas, et chaque essai compte dans le quota de la
 * banque.
 *
 * Le résultat garde le premier refus rencontré (`refusDesPlusProfonds`) : c'est
 * lui qui dit au patron pourquoi il voit moins.
 */
export async function lireAuPlusProfond<T>(
  lire: (joursDHistorique: number) => Promise<({ ok: true } & T) | RefusBanque>,
  niveaux: readonly number[] = NIVEAUX_D_HISTORIQUE_JOURS
): Promise<({ ok: true; joursLus: number; refusDesPlusProfonds: string | null } & T) | RefusBanque> {
  let premierRefus: string | null = null;
  let dernier: RefusBanque | null = null;
  for (const jours of niveaux) {
    const r = await lire(jours);
    if (r.ok) return { ...r, joursLus: jours, refusDesPlusProfonds: premierRefus };
    dernier = r;
    const periodeRefusee = r.statut !== undefined && r.statut >= 400 && r.statut < 500 && r.statut !== 401 && r.statut !== 429;
    if (!periodeRefusee) return r;
    premierRefus ??= r.raison;
  }
  return dernier!;
}

/** Une page de relevé telle que la banque la rend, avec la suite à demander. */
export type PageReleve = { transactions: Transaction[]; continuation_key?: string | null };

/**
 * Pages au plus pour un compte. Au-delà, la banque rend davantage que prévu :
 * on refuse plutôt que de garder une partie du relevé et de la marquer complète.
 */
export const PAGES_MAX_PAR_COMPTE = 1000;

/**
 * Toutes les pages d'un compte, dans l'ordre. **Tout ou rien** : une page en
 * erreur, ou une suite qui ne finit pas, rend un refus sans aucune ligne.
 *
 * Avant : dix pages au plus, puis arrêt silencieux, et la lecture était
 * marquée faite. Les lignes au-delà disparaissaient sans message.
 */
export async function lireToutesLesPages<R extends { ok: false; raison: string }>(
  lirePage: (suite: string | undefined) => Promise<({ ok: true } & PageReleve) | R>
): Promise<({ ok: true; transactions: Transaction[] }) | { ok: false; raison: string }> {
  const transactions: Transaction[] = [];
  let suite: string | undefined;
  for (let page = 0; page < PAGES_MAX_PAR_COMPTE; page++) {
    const r = await lirePage(suite);
    if (!r.ok) return r;
    transactions.push(...r.transactions);
    suite = r.continuation_key ?? undefined;
    if (!suite) return { ok: true, transactions };
  }
  return { ok: false, raison: `La banque rend plus de ${PAGES_MAX_PAR_COMPTE} pages pour un seul compte. Rien n'a été rangé.` };
}
