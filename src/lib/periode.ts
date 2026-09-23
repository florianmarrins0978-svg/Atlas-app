import { jourIso } from "@/lib/jour";
import { MOIS_LONGS } from "@/lib/mois";

/**
 * UNE PÉRIODE — une année (`2026`), un mois (`2026-09`) ou un jour
 * (`2026-09-22`) — et ce qu'elle contient.
 *
 * **Le filtre jour, mois, année des listes**, écrit une fois pour les deux
 * écrans qui le portent : les fiches de sécurité (*« rajoute le jour aussi en
 * filtre jour mois année »*, 22 septembre 2026) et les retours d'intervention
 * (*« met le filtre jours mois année de la fiche de sécurité »*, le même soir).
 * Deux copies finiraient par ne plus trier pareil (`CLAUDE.md` §3).
 *
 * **L'ANNÉE EST ARRIVÉE LE 23 SEPTEMBRE 2026**, sur sa demande : *« l'idée
 * c'est de pouvoir filtrer aussi par mois ou par année ou par jour mois
 * année »*. Elle manquait : la roue donnait un jour, la croix son mois, et
 * rien ne disait « tout 2026 ». Il a choisi la proposition B de la planche
 * `appli/retours-la-roue-du-jour.html` — les trois mots du titre se touchent,
 * et la croix disparaît avec.
 *
 * **Le jour se lit à l'heure du patron** (`jourIso`), jamais en UTC : signée à
 * 0 h 30 à Paris, une fiche est à 22 h 30 UTC la veille, et elle sortirait sous
 * un jour que sa carte n'écrit pas.
 */

/** Ce que la période embrasse — c'est ce que les trois mots du titre règlent. */
export type Portee = "jour" | "mois" | "annee";

export function dansLaPeriode(instant: Date, periode: string): boolean {
  return jourIso(instant).startsWith(periode);
}

export function moisEnCours(maintenant: Date = new Date()): string {
  return jourIso(maintenant).slice(0, 7);
}

/** Une période venue d'une adresse, ou `null` si elle n'en est pas une. */
export function periodeValide(texte: string | undefined | null): string | null {
  return texte && /^\d{4}(-\d{2}(-\d{2})?)?$/.test(texte) ? texte : null;
}

/** Ce que cette période embrasse : une année, un mois, ou un jour. */
export function porteeDeLaPeriode(periode: string): Portee {
  return periode.length === 10 ? "jour" : periode.length === 7 ? "mois" : "annee";
}

/**
 * Le même point du calendrier, vu de plus haut ou de plus près.
 *
 * **C'est tout le geste de la proposition B** : toucher « septembre » garde le
 * jour sous la main, et le titre continue de l'écrire. Sans ça, élargir
 * perdrait la date, et redescendre demanderait de rouvrir la roue.
 */
export function avecLaPortee(jour: string, portee: Portee): string {
  return portee === "jour" ? jour : portee === "mois" ? jour.slice(0, 7) : jour.slice(0, 4);
}

/** « 2026 », « Septembre 2026 », ou « 22 septembre 2026 ». */
export function titreDeLaPeriode(periode: string): string {
  const [annee, mois, jour] = periode.split("-").map(Number);
  if (!mois) return String(annee);
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
  if (aujourdhui.startsWith(periode)) return aujourdhui;
  // Une année n'a pas de mois : il lui en faut un avant d'avoir un jour.
  return periode.length === 7 ? `${periode}-01` : `${periode}-01-01`;
}
