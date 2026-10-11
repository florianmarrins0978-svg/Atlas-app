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
// 2. **La date se lit en français, pas comme le navigateur la rend.**
//
// **Ce qui a QUITTÉ ce fichier le 21 août 2026** : les cinq marques du
// calendrier et la répartition par équipe. Le planning refait porte ses propres
// règles dans `src/lib/planning-jour.ts` — voir plus bas.

import type { JourIso } from "@/lib/disponibilites";
import { versJourIso } from "@/lib/disponibilites";

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

// **LES CINQ MARQUES ONT DISPARU LE 21 AOÛT 2026.** `MarqueJour`,
// `marqueDuJour` et `LEGENDE_MARQUES` disaient « libre / de la place / matin
// pris / après-midi pris / journée pleine ». Le planning refait (planche 84)
// peint deux barres qui se REMPLISSENT à la proportion, et quatre états dont le
// dernier prévient sans interdire : `src/lib/planning-jour.ts`.
//
// Les garder à côté aurait fait deux façons de dire la charge d'un même jour, et
// c'est exactement ce que `CLAUDE.md` §3 interdit : elles auraient divergé au
// premier réglage, et l'écart se serait vu là où le patron compare.

/**
 * « ven. » — le jour de la semaine, en trois lettres.
 *
 * Pour les pastilles d'équipe d'un chantier de plusieurs jours (sa proposition
 * C du 8 septembre 2026) : la place y est comptée, et le quantième n'apprend
 * rien de plus quand les jours sont voisins.
 */
export function jourAbrege(jour: JourIso): string {
  const d = new Date(`${jour}T12:00:00Z`);
  // `getUTCDay()` rend 0 pour dimanche ; la table commence au lundi.
  return `${JOURS_COURTS[(d.getUTCDay() + 6) % 7]}.`;
}

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

/**
 * « 20 août 2026 » — une date qui se cite, avec son année.
 *
 * Pour ce qui se montre à un client : la date de consultation d'une source
 * phytosanitaire, par exemple. « 2026-08-20 » se lit comme un code.
 */
export function dateCitee(jour: JourIso): string {
  const d = new Date(`${jour}T12:00:00Z`);
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

/** Un samedi ou un dimanche — jamais proposé (`disponibilites.ts`). */
export function estWeekEndIso(jour: JourIso): boolean {
  const j = new Date(`${jour}T12:00:00Z`).getUTCDay();
  return j === 0 || j === 6;
}

// **`repartirParEquipe` a disparu le 21 août 2026, avec les cinq marques.** Elle
// asseyait les chantiers d'une demi-journée sur des lignes d'équipes, une par
// rang. La fiche du jour est désormais bâtie sur le CHANTIER — son nom une fois,
// ses demi-journées dessous — et une équipe n'est plus une file : un chantier
// peut en porter plusieurs sur la même moitié (migration 0058).

/**
 * LE MOIS D'À CÔTÉ — écrit une seule fois.
 *
 * Le passage de décembre à janvier vivait en clair dans chacune des deux
 * flèches du calendrier, avec sa bascule d'année à chaque fois. Le glissement du
 * 11 septembre 2026 en réclamait un troisième et un quatrième usage — le mois
 * qui arrive à droite, celui qui part à gauche —, et quatre copies d'une même
 * arithmétique finissent par diverger sur le seul cas qui compte : le
 * changement d'année (`CLAUDE.md` §3).
 *
 * Le pas n'est pas borné à ±1 : rien ici ne dit combien de mois l'on saute.
 */
export function moisDecale(
  c: { annee: number; mois: number },
  pas: number
): { annee: number; mois: number } {
  const total = c.annee * 12 + c.mois + pas;
  return { annee: Math.floor(total / 12), mois: ((total % 12) + 12) % 12 };
}
