// Disponibilités du patron — voir docs/AGENT.md §2.2 bis.
//
// Ce module ne fait qu'une chose, et c'est voulu : dire quels JOURS sont
// occupés. Il ne renvoie jamais ce qui les occupe. La page du client reçoit
// des dates, rien d'autre — aucun intitulé de chantier, aucun nom, aucune
// adresse, aucune durée. Le client apprend que le patron n'est pas libre le 24,
// exactement ce qu'il aurait appris en téléphonant.

/** Fenêtre par défaut sur laquelle un client peut proposer une date. */
export const FENETRE_PROPOSITION_JOURS = 90;

/**
 * Délai minimal entre aujourd'hui et une date proposable. Proposer le jour même
 * n'a aucun sens pour un chantier, et proposer demain met le patron en défaut.
 */
export const DELAI_MINIMAL_JOURS = 2;

/** Format `AAAA-MM-JJ`, celui de PostgreSQL pour le type `date`. */
export type JourIso = string;

export function versJourIso(d: Date): JourIso {
  return d.toISOString().slice(0, 10);
}

export function ajouterJours(depuis: Date, jours: number): Date {
  const d = new Date(depuis.getTime());
  d.setUTCDate(d.getUTCDate() + jours);
  return d;
}

export type FenetreProposition = { debut: JourIso; fin: JourIso };

/**
 * Bornes de la fenêtre pendant laquelle un client peut retenir une date.
 *
 * Bornée des deux côtés : sans borne haute, la liste des jours occupés
 * exposerait le planning du patron bien au-delà de toute utilité.
 */
export function fenetreProposition(
  aujourdHui: Date,
  fenetreJours: number = FENETRE_PROPOSITION_JOURS
): FenetreProposition {
  return {
    debut: versJourIso(ajouterJours(aujourdHui, DELAI_MINIMAL_JOURS)),
    fin: versJourIso(ajouterJours(aujourdHui, fenetreJours)),
  };
}

/**
 * Une date est-elle retenable, compte tenu des jours déjà occupés ?
 *
 * Fonction pure, sans accès à la base : c'est elle qui est appelée aussi bien
 * pour construire la page que pour REVÉRIFIER au moment de la validation. Une
 * seule règle, donc aucune divergence possible entre ce que le client voit et
 * ce que le serveur accepte.
 */
export function dateRetenable(
  date: JourIso,
  joursOccupes: readonly JourIso[],
  fenetre: FenetreProposition
): boolean {
  if (date < fenetre.debut || date > fenetre.fin) return false;
  return !joursOccupes.includes(date);
}

/**
 * Motif du refus, pour un message utile au client plutôt qu'un « date
 * invalide » qui ne lui apprend rien.
 */
export type MotifRefusDate = "hors_fenetre" | "jour_occupe";

export function motifRefusDate(
  date: JourIso,
  joursOccupes: readonly JourIso[],
  fenetre: FenetreProposition
): MotifRefusDate | null {
  if (date < fenetre.debut || date > fenetre.fin) return "hors_fenetre";
  if (joursOccupes.includes(date)) return "jour_occupe";
  return null;
}
