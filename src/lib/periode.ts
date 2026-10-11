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
 * **REMPLACÉE LE 11 OCTOBRE 2026 par sa proposition A**
 * (`appli/filtre-a-partout.html`) : le mois se feuillette entre deux chevrons,
 * le toucher ouvre la roue pour un jour, « Tout le mois » y revient. L'année
 * d'un bloc n'a plus de geste à l'écran ; une adresse `?periode=2026` reste
 * lue, et se feuillette depuis janvier (`moisVoisin`).
 *
 * **Le jour se lit à l'heure du patron** (`jourIso`), jamais en UTC : signée à
 * 0 h 30 à Paris, une fiche est à 22 h 30 UTC la veille, et elle sortirait sous
 * un jour que sa carte n'écrit pas.
 */

/** Ce que la période embrasse : un jour, un mois, ou une année venue d'une adresse. */
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
 * Le mois d'avant (`-1`) ou d'après (`1`) — ce que font les deux chevrons.
 *
 * **Sa proposition A du 11 octobre 2026**, qui remplace les trois mots
 * touchables de la B : *« dur à utiliser »*, on ne devinait pas que « 11 »,
 * « octobre » et « 2026 » se touchaient chacun à part. Le filtre se feuillette
 * désormais comme le mois de Terminés.
 *
 * On part toujours d'un MOIS : un jour choisi passe à son mois voisin (sinon
 * « suivant » avancerait d'un jour), et une année seule, venue d'une ancienne
 * adresse, part de son janvier.
 */
export function moisVoisin(periode: string, decalage: -1 | 1): string {
  const [annee, mois = 1] = periode.split("-").map(Number);
  const rang = annee * 12 + (mois - 1) + decalage;
  return `${Math.floor(rang / 12)}-${String((rang % 12) + 1).padStart(2, "0")}`;
}

/**
 * Le chevron d'après s'ouvre-t-il ? Rien n'est encore signé ni envoyé dans un
 * mois à venir : il s'éteint au mois en cours, comme sur Terminés.
 */
export function moisSuivantOuvert(periode: string, maintenant: Date = new Date()): boolean {
  return moisVoisin(periode, 1) <= moisEnCours(maintenant);
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
