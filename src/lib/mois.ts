// Le mois, en sept colonnes — et ce que chaque jour porte.
//
// **Deux règles pures, testables sans base**, parce que les deux se sont déjà
// trompées ailleurs :
//
// 1. **La grille doit dire vrai.** Le 1er août 2026 est un SAMEDI. Une grille
//    qui compte les jours de dépassement à partir de dimanche pose quatre cases
//    de juillet au lieu de cinq, et TOUT LE MOIS glisse d'un jour — les
//    contrôles restent verts, les chiffres sont tous là, et le patron lit un
//    calendrier faux.
// 2. **« Complet » se compte PAR ÉQUIPE.** Un jour où une seule équipe sur deux
//    est prise reste proposable. C'est tout l'objet du compteur de Réglages.

import type { JourIso, Moment } from "@/server/disponibilites";
import { cleCreneau, versJourIso } from "@/server/disponibilites";

/** Lundi en tête — la semaine française, pas celle du navigateur. */
export const JOURS_COURTS = ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"];

export const MOIS_LONGS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

/** Une case de la grille. `horsMois` porte les jours d'avant et d'après. */
export type CaseMois = {
  jour: JourIso;
  numero: number;
  horsMois: boolean;
  weekEnd: boolean;
};

/**
 * Les cases d'un mois, alignées sur une semaine qui commence LUNDI.
 *
 * **Le décalage se calcule en base lundi**, et c'est le piège payé : avec
 * `getUTCDay()` tel quel, dimanche vaut 0 et samedi 6 ; un mois qui commence un
 * samedi obtient alors six cases de dépassement au lieu de cinq, ou l'inverse
 * selon le sens de la correction. `(jour + 6) % 7` remet lundi à 0.
 *
 * La grille est toujours complète — six semaines au plus, autant que nécessaire
 * — pour que les colonnes ne bougent pas d'un mois à l'autre.
 */
export function grilleDuMois(annee: number, mois: number): CaseMois[] {
  const premier = new Date(Date.UTC(annee, mois, 1));
  const decalage = (premier.getUTCDay() + 6) % 7;
  const depart = new Date(Date.UTC(annee, mois, 1 - decalage));

  const joursDansLeMois = new Date(Date.UTC(annee, mois + 1, 0)).getUTCDate();
  // Assez de semaines pleines pour contenir le décalage ET tout le mois.
  const semaines = Math.ceil((decalage + joursDansLeMois) / 7);

  return Array.from({ length: semaines * 7 }, (_, i) => {
    const d = new Date(depart.getTime());
    d.setUTCDate(d.getUTCDate() + i);
    const jourSemaine = d.getUTCDay();
    return {
      jour: versJourIso(d),
      numero: d.getUTCDate(),
      horsMois: d.getUTCMonth() !== ((mois % 12) + 12) % 12 || d.getUTCFullYear() !== annee + Math.floor(mois / 12),
      weekEnd: jourSemaine === 0 || jourSemaine === 6,
    };
  });
}

/** Les cinq marques du calendrier — cinq, et non quatre. */
export type MarqueJour = "libre" | "reste" | "matin" | "apres_midi" | "plein";

/**
 * Ce que porte un jour, à partir de l'occupation réelle et du nombre d'équipes.
 *
 * | Marque | Ce qu'elle dit |
 * |---|---|
 * | `libre` | rien n'est posé ce jour-là |
 * | `reste` | il reste de la place — au moins une équipe libre |
 * | `matin` | le matin est complet **pour toutes les équipes** |
 * | `apres_midi` | l'après-midi est complet |
 * | `plein` | la journée est pleine |
 *
 * **Quatre marques ne suffisaient plus dès qu'il y a plusieurs équipes** : sans
 * `reste`, un jour à moitié pris se lisait comme un jour libre, et le patron
 * découvrait la collision en ouvrant la journée.
 */
export function marqueDuJour(
  jour: JourIso,
  occupation: ReadonlyMap<string, number>,
  nombreEquipes: number
): MarqueJour {
  const equipes = Math.max(1, Math.trunc(nombreEquipes) || 1);
  const pris = (moment: Moment) => occupation.get(cleCreneau({ jour, moment })) ?? 0;

  const matin = pris("matin");
  const apresMidi = pris("apres_midi");
  const matinComplet = matin >= equipes;
  const apremComplet = apresMidi >= equipes;

  if (matinComplet && apremComplet) return "plein";
  if (matinComplet) return "matin";
  if (apremComplet) return "apres_midi";
  // Rien de complet : reste-t-il quelque chose de posé ? Un jour vierge ne
  // porte aucune marque — le calendrier doit se lire d'abord comme des
  // chiffres.
  return matin + apresMidi > 0 ? "reste" : "libre";
}

/** Ce que la légende écrit, dans l'ordre des marques. */
export const LEGENDE_MARQUES: { marque: Exclude<MarqueJour, "libre">; texte: string }[] = [
  { marque: "reste", texte: "de la place" },
  { marque: "matin", texte: "matin pris" },
  { marque: "apres_midi", texte: "après-midi pris" },
  { marque: "plein", texte: "journée pleine" },
];

/** « Jeudi 20 août » — la date telle que la journée l'écrit. */
export function jourLisibleCourt(jour: JourIso): string {
  const d = new Date(`${jour}T12:00:00Z`);
  const texte = d.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

/** Un samedi ou un dimanche — jamais proposé (`disponibilites.ts`). */
export function estWeekEndIso(jour: JourIso): boolean {
  const j = new Date(`${jour}T12:00:00Z`).getUTCDay();
  return j === 0 || j === 6;
}

// ─── Qui occupe quelle équipe, sur une demi-journée ────────────────────────

/** Ce qu'une ligne de la journée montre : une équipe, et ce qu'elle tient. */
export type LigneEquipe<C> = {
  /** 1 à N — c'est lui qui porte la lettre de repli. */
  rang: number;
  /** Le chantier qui l'occupe, ou `null` : la ligne est libre. */
  occupe: C | null;
};

/**
 * Répartit les chantiers d'une demi-journée sur les équipes.
 *
 * **Un chantier posé AVANT les équipes n'en a aucune** (`equipeId` à `null`,
 * l'état de tout ce qui existait avant la migration 0034). On ne lui en invente
 * pas : il prend simplement le premier rang encore libre, de façon déterministe
 * — deux affichages successifs doivent montrer la même chose, sinon le patron
 * voit son planning bouger tout seul.
 *
 * Les chantiers attribués passent d'abord : sans cela, un chantier sans équipe
 * pourrait s'asseoir sur le rang d'un chantier qui, lui, en a une.
 */
export function repartirParEquipe<C extends { id: string; rangEquipe: number | null }>(
  occupants: readonly C[],
  nombreEquipes: number
): LigneEquipe<C>[] {
  const borne = Math.max(1, Math.trunc(nombreEquipes) || 1);
  const lignes: LigneEquipe<C>[] = Array.from({ length: borne }, (_, i) => ({ rang: i + 1, occupe: null }));

  const attribues = occupants.filter((c) => c.rangEquipe != null);
  const sansEquipe = occupants.filter((c) => c.rangEquipe == null);

  for (const c of attribues) {
    const place = lignes.find((l) => l.rang === c.rangEquipe && l.occupe === null);
    // Rang hors bornes (le compteur a baissé depuis) ou déjà pris : le chantier
    // ne disparaît pas de l'écran pour autant — il rejoint la file d'attente.
    if (place) place.occupe = c;
    else sansEquipe.push(c);
  }

  // Ordre stable par identifiant : la seule façon que deux rendus successifs
  // montrent la même chose sans rien écrire en base.
  for (const c of [...sansEquipe].sort((a, b) => a.id.localeCompare(b.id))) {
    const libre = lignes.find((l) => l.occupe === null);
    if (libre) libre.occupe = c;
  }

  return lignes;
}
