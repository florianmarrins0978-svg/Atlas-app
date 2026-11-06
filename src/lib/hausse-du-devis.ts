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
import { partsAppliquees } from "./feuille-main-oeuvre";
import { montantDeLaLigne } from "./montant-de-ligne";

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
  /** Son prix sur l'ancien devis : celui du TRAVAIL, main d'œuvre répartie retirée. */
  prixAncien: string;
  /** Le tarif du jour, quand sa grille le porte à un autre prix. */
  prixGrille: string | null;
};

/**
 * Une ligne reprise, main d'œuvre comprise : sa décision du 6 novembre 2026.
 *
 * *« Il faut garder les 400 € de main d'œuvre. Et quand on fait mettre à jour
 * les prix, ça doit juste se mettre à jour par rapport à la taille de la haie.
 * À part si les prix de la main d'œuvre ont augmenté. »*
 */
export type LigneRepriseAvecSaPart = PrixDeReprise & {
  quantite: string;
  /** La main d'œuvre répartie sur l'ancien devis, en euros ; `null` sans part. */
  partAncienne: string | null;
  /** La même au prix du jour par homme d'aujourd'hui, quand il a bougé. */
  partGrille: string | null;
};

/**
 * Ce que la ligne devient après sa réponse et la hausse, **toujours depuis
 * ses bases** : le travail (ancien ou tarif du jour), la main d'œuvre
 * (ancienne ou au prix du jour), chacun monté du même taux.
 *
 * La part se pose comme la feuille « Main d'œuvre » la pose (`partsAppliquees`) :
 * la part gardée est ce que le prix a VRAIMENT reçu au centime, pour que
 * « dont main d'œuvre HT » ne dise jamais un euro de plus que la ligne.
 */
export function ligneApresSaReponse(
  ligne: LigneRepriseAvecSaPart,
  reponse: ReponseGrille,
  hausse: number
): { prixUnitaire: string; montant: string; partMainDoeuvre: string | null } {
  const prixTravail = prixDeLaLigneReprise(ligne, reponse, hausse);
  if (ligne.partAncienne === null) {
    return { prixUnitaire: prixTravail, montant: montantDeLaLigne(ligne.quantite, prixTravail), partMainDoeuvre: null };
  }
  const base = reponse === "oui" && ligne.partGrille !== null ? ligne.partGrille : ligne.partAncienne;
  const [posee] = partsAppliquees(
    [{ id: "ligne", quantite: ligne.quantite, prixUnitaire: prixTravail, partMainDoeuvre: null }],
    { ligne: prixAugmente(base, hausse) }
  );
  // Une quantité nulle ne reçoit rien (`partsAppliquees`) : la ligne garde
  // alors son travail seul, et la part n'annonce rien qu'elle ne porte pas.
  if (!posee) {
    return { prixUnitaire: prixTravail, montant: montantDeLaLigne(ligne.quantite, prixTravail), partMainDoeuvre: null };
  }
  return { prixUnitaire: posee.prixUnitaire, montant: posee.montant, partMainDoeuvre: posee.partMainDoeuvre };
}

/** Les mains d'œuvre à nommer sous « Votre grille a changé » : celles dont le prix du jour par homme a bougé. */
export function partsAMettreAJour<L extends { partAncienne: string | null; partGrille: string | null }>(
  lignes: readonly L[]
): (L & { partAncienne: string; partGrille: string })[] {
  return lignes.filter(
    (l): l is L & { partAncienne: string; partGrille: string } =>
      l.partAncienne !== null && l.partGrille !== null && !new Decimal(l.partAncienne).equals(l.partGrille)
  );
}

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
