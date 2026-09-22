import { jourIso } from "@/lib/jour";
import { MOIS_LONGS } from "@/lib/mois";

/**
 * UNE PÉRIODE — un mois (`2026-09`) ou un jour (`2026-09-22`) — et ce qu'elle
 * contient.
 *
 * **Le filtre jour, mois, année des listes**, écrit une fois pour les deux
 * écrans qui le portent : les fiches de sécurité (*« rajoute le jour aussi en
 * filtre jour mois année »*, 22 septembre 2026) et les retours d'intervention
 * (*« met le filtre jours mois année de la fiche de sécurité »*, le même soir).
 * Deux copies finiraient par ne plus trier pareil (`CLAUDE.md` §3).
 *
 * **Le jour se lit à l'heure du patron** (`jourIso`), jamais en UTC : signée à
 * 0 h 30 à Paris, une fiche est à 22 h 30 UTC la veille, et elle sortirait sous
 * un jour que sa carte n'écrit pas.
 */

export function dansLaPeriode(instant: Date, periode: string): boolean {
  return jourIso(instant).startsWith(periode);
}

export function moisEnCours(maintenant: Date = new Date()): string {
  return jourIso(maintenant).slice(0, 7);
}

/** Une période venue d'une adresse, ou `null` si elle n'en est pas une. */
export function periodeValide(texte: string | undefined | null): string | null {
  return texte && /^\d{4}-\d{2}(-\d{2})?$/.test(texte) ? texte : null;
}

/** « Septembre 2026 », ou « 22 septembre 2026 » pour un jour. */
export function titreDeLaPeriode(periode: string): string {
  const [annee, mois, jour] = periode.split("-").map(Number);
  const nom = `${MOIS_LONGS[mois - 1]} ${annee}`;
  return jour ? `${jour} ${nom}` : nom.charAt(0).toUpperCase() + nom.slice(1);
}

/**
 * Le jour sur lequel la roue s'ouvre : celui qui est choisi ; sur un mois
 * entier, aujourd'hui s'il en est, sinon le 1er — la roue d'un téléphone ne
 * s'ouvre que sur un jour.
 */
export function jourDeLaRoue(periode: string, maintenant: Date = new Date()): string {
  if (periode.length === 10) return periode;
  const aujourdhui = jourIso(maintenant);
  return aujourdhui.startsWith(periode) ? aujourdhui : `${periode}-01`;
}
