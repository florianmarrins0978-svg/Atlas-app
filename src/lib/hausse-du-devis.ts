/**
 * La hausse d'un devis repris, et le tarif du jour proposé.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * **D'OÙ ÇA VIENT.** Ses décisions du 26 septembre 2026, sur
 * `appli/augmenter-un-devis-repris.html` : un devis repris par « Dernier
 * devis » revient à SES prix ; si sa grille a bougé, l'écran lui pose la
 * question (« Mettre à jour » ou « Garder les anciens ») ; puis il peut
 * augmenter toutes les lignes reprises de 5, 10, 30 % ou d'un taux qu'il tape.
 *
 * **QUI EST « REPRISE ».** Une ligne venue de l'ancien devis et jamais
 * retouchée : elle porte `prixAncien`. Un prix qu'il tape, ou une ligne qu'il
 * ajoute, est un prix d'aujourd'hui ; le monter serait lui reprendre la main.
 * C'est le dépôt qui efface `prixAncien` au premier prix tapé
 * (`modifierLignePrix`).
 *
 * **LES TAUX NE S'ADDITIONNENT PAS.** Le prix se recalcule toujours depuis la
 * base (ancien prix, ou tarif du jour s'il a dit oui) : 10 % après 5 % donne
 * 10 %. Ce qu'il lit sur la pastille est ce qui est appliqué.
 *
 * Fonctions pures : ni base, ni réseau.
 */
import Decimal from "decimal.js";

/** Sa réponse à « Votre grille a changé ». `null` : pas encore répondu. */
export type ReponseGrille = "oui" | "non" | null;

/** Au delà, c'est une faute de frappe plus souvent qu'une intention. */
export const HAUSSE_MAXIMALE = 100;

/**
 * Le taux qu'il a tapé, ou `null` s'il ne se lit pas.
 *
 * Une décimale au plus, virgule ou point, de 0,1 à 100 %. Une case vide vaut
 * 0 : pas de hausse. **Un taux illisible ne se devine pas** : le refuser laisse
 * les prix tels quels, là où un taux deviné partirait chez le client.
 */
export function lireTauxDeHausse(texte: string): number | null {
  const t = texte.trim().replace(",", ".");
  if (t === "") return 0;
  if (!/^\d{1,3}(\.\d)?$/.test(t)) return null;
  const n = Number(t);
  return n > 0 && n <= HAUSSE_MAXIMALE ? n : null;
}

/**
 * Le prix unitaire augmenté, arrondi au centime, demi vers le haut, écrit
 * comme la base l'écrit (« 19.57 »).
 *
 * **L'arrondi porte sur le prix UNITAIRE**, pas sur le montant : le client lit
 * « 40 × 19,57 € » et doit pouvoir refaire la multiplication. Et le calcul est
 * décimal : en flottants, 14,90 × 1,05 tombe d'un côté ou de l'autre de
 * 15,645 selon l'ordre des opérations.
 */
export function prixAugmente(prix: string, taux: number): string {
  return new Decimal(prix)
    .times(new Decimal(100).plus(taux))
    .dividedBy(100)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
    .toFixed(2);
}

/** Ce qu'une ligne reprise porte pour le calcul. */
export type PrixDeReprise = {
  /** Son prix sur l'ancien devis. */
  prixAncien: string;
  /** Le tarif du jour, quand sa grille le porte à un autre prix. */
  prixGrille: string | null;
};

/**
 * Le prix affiché d'une ligne reprise : l'ancien prix, ou le tarif du jour
 * s'il a dit oui, puis la hausse, toujours calculée depuis cette base.
 */
export function prixDeLaLigneReprise(
  ligne: PrixDeReprise,
  reponse: ReponseGrille,
  hausse: number
): string {
  const base = reponse === "oui" && ligne.prixGrille !== null ? ligne.prixGrille : ligne.prixAncien;
  return prixAugmente(base, hausse);
}

/**
 * Les lignes à nommer sous « Votre grille a changé » : celles dont le tarif du
 * jour DIFFÈRE vraiment, comparé en centimes (« 0.37 » et « 0.370 » sont le
 * même prix). Aucune : la question ne se pose pas.
 */
export function lignesAMettreAJour<
  L extends { prixAncien: string | null; prixGrille: string | null },
>(lignes: readonly L[]): (L & { prixAncien: string; prixGrille: string })[] {
  return lignes.filter(
    (l): l is L & { prixAncien: string; prixGrille: string } =>
      l.prixAncien !== null && l.prixGrille !== null && !new Decimal(l.prixAncien).equals(l.prixGrille)
  );
}

/**
 * Deux prix écrits sont-ils le même ? Lus à la française (« 17,5 », « 1 200 »)
 * ou comme la base les rend (« 17.50 »). Un texte illisible n'égale rien :
 * dans le doute, c'est une retouche, et la ligne sort de la reprise plutôt que
 * de voir son prix réécrit sous ses yeux.
 */
export function memeValeur(a: string, b: string): boolean {
  const lire = (v: string) => {
    const t = v.replace(/\s/g, "").replace(",", ".");
    return /^-?\d+(\.\d+)?$/.test(t) ? new Decimal(t) : null;
  };
  const x = lire(a);
  const y = lire(b);
  return x !== null && y !== null && x.equals(y);
}
