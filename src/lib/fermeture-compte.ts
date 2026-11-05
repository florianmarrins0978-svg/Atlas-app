import type { StatutAbonnement } from "./abonnements";

/**
 * FERMER SON COMPTE — ses décisions du 5 novembre 2026 (`docs/QUESTIONS.md`,
 * question 33 ; planche `appli/soignee/fermer-mon-compte.html`).
 *
 * | Ce qui se passe | Quand |
 * |---|---|
 * | il appuie sur « Fermer mon compte » | `demandeeLe` |
 * | le compte passe en lecture seule, les salariés perdent l'accès | `effectiveLe` : la fin de ce qui est payé (son choix A), sinon tout de suite |
 * | ce qui ne se garde pas s'efface | trente jours après `effectiveLe` |
 * | ce qui se garde (factures, avoirs, devis et contrats acceptés) | dix ans, lisible avec son mot de passe |
 *
 * Toutes les règles vivent ici, sans base : `withEntreprise` les lit pour
 * fermer l'écriture, la purge planifiée pour savoir qui effacer, l'écran pour
 * le dire. Trois lecteurs d'une seule règle (`CLAUDE.md` §3).
 */

const UN_JOUR_MS = 24 * 60 * 60 * 1000;

/**
 * Les trente jours entre la fermeture et l'effacement du reste.
 *
 * Décidés le 18 octobre 2026 (`docs/A-FAIRE.md`, « trente jours après ») et
 * tenus jusque-là par `RETENTION.compteFermeJours`, qui ne s'appliquait à
 * rien : aucun chemin de fermeture n'existait. Le chiffre a déménagé ici, et
 * l'ancienne constante est partie avec son avertissement.
 */
export const JOURS_AVANT_EFFACEMENT = 30;

export type Fermeture = {
  demandeeLe: Date | null;
  effectiveLe: Date | null;
  resteEffaceLe: Date | null;
};

export type EtatFermeture =
  | { statut: "ouvert" }
  /** Demandée : il garde tout jusqu'à la fin de ce qui est payé. */
  | { statut: "programmee"; effectiveLe: Date; effacementLe: Date }
  /** Lecture seule ; le reste n'est pas encore effacé, « Rouvrir » rend tout. */
  | { statut: "fermee"; effectiveLe: Date; effacementLe: Date }
  /** Le reste est effacé : ne demeurent que les pièces gardées dix ans. */
  | { statut: "archivee"; effectiveLe: Date };

/** Le jour où le reste s'efface, trente jours pleins après la fermeture. */
export function dateDEffacement(effectiveLe: Date): Date {
  return new Date(effectiveLe.getTime() + JOURS_AVANT_EFFACEMENT * UN_JOUR_MS);
}

export function etatDeLaFermeture(f: Fermeture | null | undefined, maintenant: Date): EtatFermeture {
  if (!f?.demandeeLe || !f.effectiveLe) return { statut: "ouvert" };
  const effacementLe = dateDEffacement(f.effectiveLe);
  if (f.resteEffaceLe) return { statut: "archivee", effectiveLe: f.effectiveLe };
  if (maintenant.getTime() < f.effectiveLe.getTime()) {
    return { statut: "programmee", effectiveLe: f.effectiveLe, effacementLe };
  }
  return { statut: "fermee", effectiveLe: f.effectiveLe, effacementLe };
}

/** Le compte est-il fermé, donc en lecture seule et réservé au patron ? */
export function compteFerme(f: Fermeture | null | undefined, maintenant: Date): boolean {
  const s = etatDeLaFermeture(f, maintenant).statut;
  return s === "fermee" || s === "archivee";
}

/**
 * Le reste de ce compte doit-il être effacé maintenant ?
 *
 * Seulement une fois les trente jours écoulés, et une seule fois : la date
 * posée par la purge l'empêche de repasser.
 */
export function resteAEffacer(f: Fermeture | null | undefined, maintenant: Date): boolean {
  const e = etatDeLaFermeture(f, maintenant);
  return e.statut === "fermee" && maintenant.getTime() >= e.effacementLe.getTime();
}

/**
 * QUAND LE COMPTE SE FERME — son choix A du 5 novembre 2026 : *« le compte
 * reste ouvert jusqu'à la fin de ce qui est payé, puis se ferme »*.
 *
 * Seul un abonnement ACTIF a une période payée devant lui. Un essai n'a rien
 * coûté, un impayé n'a pas été payé, un résilié est déjà fini : la fermeture
 * prend effet tout de suite. Une date de fin absente ne se devine pas, elle
 * vaut « tout de suite » aussi, le côté qui ne prolonge rien.
 */
export function dateDeFermeture(
  abonnement: { statut: StatutAbonnement; periodeFin: Date | null } | null | undefined,
  maintenant: Date
): Date {
  if (abonnement?.statut === "actif" && abonnement.periodeFin && abonnement.periodeFin.getTime() > maintenant.getTime()) {
    return abonnement.periodeFin;
  }
  return maintenant;
}

/**
 * COMMENT IL ROUVRE, selon où il en est.
 *
 * | | |
 * |---|---|
 * | `annuler` | fermeture seulement programmée : rien n'a changé, il reste abonné |
 * | `se-reabonner` | fermé, et son compte est passé par l'abonnement (essai ou payant) : rouvrir, c'est payer de nouveau |
 * | `rouvrir` | fermé, sans aucune ligne d'abonnement : un compte d'avant l'offre, qui n'a jamais rien payé |
 * | `null` | rien à rouvrir |
 */
export type CommentRouvrir = "annuler" | "se-reabonner" | "rouvrir";

export function commentRouvrir(etat: EtatFermeture, aUneLigneDAbonnement: boolean): CommentRouvrir | null {
  if (etat.statut === "ouvert") return null;
  if (etat.statut === "programmee") return "annuler";
  return aUneLigneDAbonnement ? "se-reabonner" : "rouvrir";
}

/**
 * UN ABONNEMENT REPRIS ROUVRE LE COMPTE.
 *
 * Fermé, il se réabonne : l'abonnement redevient actif, et la fermeture doit
 * partir avec, sinon il paierait pour un compte en lecture seule. Le même
 * geste vaut « Ne pas arrêter » avant l'échéance.
 *
 * **Une résiliation encore demandée ne rouvre rien** : c'est l'état exact que
 * laisse la fermeture d'un compte abonné (Stripe garde l'abonnement actif
 * jusqu'à la fin de ce qui est payé). La lire comme une reprise effacerait la
 * fermeture à la seconde où elle s'écrit.
 */
export function abonnementRouvreLeCompte(etat: { statut: StatutAbonnement; annulationDemandee: boolean }): boolean {
  return etat.statut === "actif" && !etat.annulationDemandee;
}

/**
 * « 5 décembre 2026 », à l'heure de Paris : l'écran dit un jour, et une date
 * posée à minuit en temps universel ne doit pas s'y lire la veille.
 */
export function jourEnMots(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" });
}
