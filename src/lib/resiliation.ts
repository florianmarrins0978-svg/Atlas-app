import { FORMULES, type Formule, type FormuleCode, type Periodicite } from "./abonnements";

/**
 * PARTIR — ce que demande l'écran « Avant de partir », et ce que vaut un refus
 * de nouvelles conditions. Planche du 18 octobre 2026
 * (`appli/documents-legaux-un-geste.html`), `docs/A-FAIRE.md` §17.
 */

/**
 * Les trois raisons proposées. Facultatives : on peut partir sans répondre.
 * Le prestataire les reçoit avec la résiliation, où le patron les lit ; ce
 * fichier ne sait pas lequel (`src/server/paiement/stripe.ts` traduit).
 */
export const RAISONS_DEPART = [
  { code: "trop_cher", libelle: "C’est trop cher" },
  { code: "peu_servi", libelle: "Je ne m’en sers pas assez" },
  { code: "manque", libelle: "Il me manque quelque chose" },
] as const;

export type RaisonDepart = (typeof RAISONS_DEPART)[number]["code"];

export function estRaisonDepart(v: unknown): v is RaisonDepart {
  return RAISONS_DEPART.some((r) => r.code === v);
}

/**
 * Ce qu'il a écrit, tel quel, borné. Cinq cents caractères suffisent à dire
 * ce qui manque ; au-delà, c'est un formulaire qu'on détourne.
 */
export const TEXTE_DEPART_MAX = 500;

export function texteDeDepart(brut: unknown): string | null {
  if (typeof brut !== "string") return null;
  const t = brut.trim().slice(0, TEXTE_DEPART_MAX);
  return t === "" ? null : t;
}

/**
 * La formule juste en dessous de la sienne, à proposer avant qu'il parte ;
 * `null` quand il a déjà la moins chère. La grille est rangée du moins cher au
 * plus cher (`FORMULES`), et c'est elle qui décide, jamais l'écran.
 */
export function formuleMoinsChere(actuelle: FormuleCode): Formule | null {
  const i = FORMULES.findIndex((f) => f.code === actuelle);
  return i > 0 ? FORMULES[i - 1] : null;
}

/**
 * LE REMBOURSEMENT D'UN REFUS DE NOUVELLES CONDITIONS — son choix du
 * 18 octobre 2026 (la B) : il résilie tout de suite, et **les mois payés et
 * non utilisés** lui sont rendus. Le mois commencé ne l'est pas : il a servi.
 *
 * En centimes, sur ce qui a VRAIMENT été payé (TVA comprise, remise comprise),
 * jamais sur la grille : rembourser plus qu'encaissé serait une perte, moins
 * serait une retenue qu'il n'a pas acceptée.
 *
 * `null` quand on ne sait pas (une date manque) : un montant deviné ne part
 * pas sur une carte.
 */
export function remboursementAuProrata(p: {
  payeCentimes: number;
  periodicite: Periodicite;
  finDePeriode: Date | null;
  maintenant: Date;
}): { moisNonUtilises: number; centimes: number } | null {
  if (!p.finDePeriode || !Number.isFinite(p.payeCentimes) || p.payeCentimes < 0) return null;
  const moisDeLaPeriode = p.periodicite === "annuelle" ? 12 : 1;
  const moisNonUtilises = Math.min(moisDeLaPeriode, moisEntiersEntre(p.maintenant, p.finDePeriode));
  return {
    moisNonUtilises,
    centimes: Math.floor((p.payeCentimes * moisNonUtilises) / moisDeLaPeriode),
  };
}

/** Les mois ENTIERS de `debut` à `fin` : du 18 octobre au 18 avril, six ; au 17 avril, cinq. */
function moisEntiersEntre(debut: Date, fin: Date): number {
  if (fin.getTime() <= debut.getTime()) return 0;
  let mois = (fin.getUTCFullYear() - debut.getUTCFullYear()) * 12 + (fin.getUTCMonth() - debut.getUTCMonth());
  const memeInstantDansLeMois = Date.UTC(
    debut.getUTCFullYear(),
    debut.getUTCMonth() + mois,
    debut.getUTCDate(),
    debut.getUTCHours(),
    debut.getUTCMinutes(),
    debut.getUTCSeconds()
  );
  if (memeInstantDansLeMois > fin.getTime()) mois -= 1;
  return Math.max(0, mois);
}
