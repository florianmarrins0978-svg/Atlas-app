/**
 * Ce qu'un échec de connexion coûte au suivant — la règle, et rien qu'elle.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **Fonction pure, dans `src/lib/`, et ce n'est pas un rangement** (`CLAUDE.md`
 * §3). La même règle décide de ce que la base écrit ET de ce que l'écran
 * annonce. Deux rédactions divergeraient, et la divergence se paierait dans le
 * pire sens : un artisan à qui l'on dit « réessayez dans deux minutes » et que
 * le serveur refuse encore au bout de cinq.
 *
 * Elle s'éprouve sans base et sans Redis — `scripts/test-tentatives-connexion.ts`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **Le raisonnement, parce qu'il commande tous les chiffres ci-dessous.**
 *
 * Avant l'audit du 23 août 2026, un attaquant disposait de 28 800 essais par
 * jour et par compte, et de tous les essais qu'il voulait dès que Redis
 * toussait. Avec ces paliers, une fois le seuil franchi, il en obtient **quatre
 * par heure** — moins de cent par jour. Un mot de passe honnête ne tombe plus.
 *
 * **Et le plafond est là pour le PATRON, pas pour l'attaquant.** Sans lui, il
 * suffirait de taper trois fois à côté sur son adresse pour l'empêcher d'entrer
 * chez lui indéfiniment : on aurait remplacé une porte trop faible par une porte
 * murée, et c'est le propriétaire qui paierait. Quinze minutes est ce qu'on a
 * jugé supportable un soir de chantier ; au-delà, l'outil devient l'obstacle.
 */

/** En dessous, rien ne se passe : ce sont les essais de quelqu'un qui cherche. */
export const SEUIL_AVANT_TEMPORISATION = 5;

/**
 * Ce que coûte le 5ᵉ échec, puis le 6ᵉ, le 7ᵉ, le 8ᵉ. Au-delà, le dernier
 * palier se répète — c'est le plafond, et il est délibéré (voir en-tête).
 */
export const PALIERS_MS = [60_000, 120_000, 300_000, 900_000] as const;

/**
 * Au bout de quoi un échec ne compte plus.
 *
 * Sans cet oubli, l'artisan qui se trompe trois fois en janvier et deux fois en
 * mars se retrouverait temporisé au cinquième — pour des fautes qui n'ont aucun
 * rapport entre elles. Ce qu'on veut attraper, c'est une rafale, pas une vie.
 */
export const FENETRE_OUBLI_MS = 60 * 60 * 1000;

/** L'état gardé pour une saisie — exactement ce que porte la table. */
export type EtatTentatives = {
  echecs: number;
  dernierEchecAt: Date;
  bloqueJusqua: Date | null;
};

/** Combien de temps le prochain essai doit attendre, après `echecs` échecs. */
export function delaiApresEchec(echecs: number): number {
  if (echecs < SEUIL_AVANT_TEMPORISATION) return 0;
  const rang = Math.min(echecs - SEUIL_AVANT_TEMPORISATION, PALIERS_MS.length - 1);
  return PALIERS_MS[rang];
}

/**
 * Le compte des échecs à retenir, une fois l'oubli appliqué.
 *
 * Rendu à part parce que deux endroits en ont besoin : celui qui décide de
 * refuser d'avance, et celui qui écrit l'échec suivant. Les faire compter
 * chacun de son côté, c'est la duplication que `CLAUDE.md` §3 interdit.
 */
export function echecsRetenus(etat: EtatTentatives | null, maintenant: Date): number {
  if (!etat) return 0;
  if (maintenant.getTime() - etat.dernierEchecAt.getTime() >= FENETRE_OUBLI_MS) return 0;
  return etat.echecs;
}

/**
 * Cette saisie est-elle refusée d'avance, et pour combien de temps ?
 *
 * **`null` veut dire « laissez passer »**, jamais « c'est le bon mot de passe » :
 * la vérification vient après, et elle seule tranche.
 */
export function attenteRestanteMs(etat: EtatTentatives | null, maintenant: Date): number | null {
  if (!etat?.bloqueJusqua) return null;
  const reste = etat.bloqueJusqua.getTime() - maintenant.getTime();
  return reste > 0 ? reste : null;
}

/** L'état à écrire après un échec de plus. */
export function etatApresEchec(etat: EtatTentatives | null, maintenant: Date): EtatTentatives {
  const echecs = echecsRetenus(etat, maintenant) + 1;
  const delai = delaiApresEchec(echecs);
  return {
    echecs,
    dernierEchecAt: maintenant,
    bloqueJusqua: delai > 0 ? new Date(maintenant.getTime() + delai) : null,
  };
}

/**
 * Ce que l'artisan lit quand il est temporisé.
 *
 * **Elle ne dit JAMAIS « mot de passe incorrect »** — c'est la règle du dépôt
 * depuis le 6 août 2026, née du jour où les parents du patron ont lu cette
 * phrase avec le bon mot de passe et se sont enfoncés en recommençant.
 *
 * **Et elle dit qu'on essaie d'entrer.** Une temporisation qui tombe sur
 * quelqu'un qui connaît son mot de passe signifie qu'un autre le cherche : le
 * taire, ce serait laisser l'artisan croire à une panne de l'application
 * pendant qu'on tape à sa porte.
 */
export function messageAttente(resteMs: number): string {
  const minutes = Math.max(1, Math.ceil(resteMs / 60_000));
  return (
    `Trop de tentatives sur ce compte. Réessayez dans ${minutes} minute${minutes > 1 ? "s" : ""}. ` +
    `Si ce n'est pas vous qui venez d'essayer, quelqu'un cherche à entrer : changez votre mot de passe dès que vous le pourrez.`
  );
}
