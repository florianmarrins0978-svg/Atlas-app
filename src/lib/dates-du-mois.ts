// LES DATES DU MOIS D'UN CONTRAT D'ENTRETIEN — sa demande du 27 septembre 2026,
// planche 130 (`appli/contrat-dates-du-mois.html`) : *« tous les 20 du mois,
// j'envoie pour le mois suivant »*.
//
// **Règles pures**, la même fonction pour le tiroir du planning et pour le
// serveur qui refuse un envoi incomplet (`CLAUDE.md` §3) :
//
// - un contrat et un mois font UN envoi : toutes les dates partent d'un coup ;
// - le bloc « À envoyer » s'ouvre dès que la DERNIÈRE date du mois est posée
//   (*« il ne faut pas avoir besoin de recliquer sur le nom du client »*) ;
// - envoyé et sans réponse, le client est « en attente » ; sans réponse, chaque
//   date tient jusqu'au jour prévu (*« au pire l'utilisateur la déplacera »*),
//   donc rien ne bascule, et l'attente cesse quand le dernier jour est passé.

import { deOuD, lirePassage } from "./contrats-entretien";
import { MOIS_LONGS } from "./mois";

/** Ce que le tiroir sait d'un passage, et rien de plus. */
export type PassageAuPlanning = {
  id: string;
  contratEntretienId?: string | null;
  contratPassage?: string | null;
  datePlanifiee: string | null;
};

/** Un envoi déjà parti : son contrat, son mois (le 1er), s'il a eu réponse. */
export type EnvoiDesDates = {
  contratEntretienId: string;
  mois: string;
  envoyeLe: string;
  reponduLe: string | null;
};

export type GroupeDuMois<P> = {
  contratEntretienId: string;
  /** Le premier jour du mois : « 2026-10-01 ». */
  mois: string;
  passages: P[];
};

/** Le mois d'un passage, au 1er : « 2026-10-01 ». NULL si la clé ne se lit pas. */
export function moisDuPassage(cle: string): string | null {
  const lu = lirePassage(cle);
  if (!lu) return null;
  return `${lu.annee}-${String(lu.mois).padStart(2, "0")}-01`;
}

/**
 * La prestation d'un passage, sans le nom du client qui le précède : le
 * chantier s'appelle « Mme Costa, Tonte et ébarbage » (`nomDuChantier`), et le
 * nom se lit déjà une ligne plus haut.
 */
export function prestationDuPassage(nom: string): string {
  const virgule = nom.indexOf(", ");
  return virgule >= 0 ? nom.slice(virgule + 2) : nom;
}

/** « d'octobre », « de novembre » : ce que dit le bouton d'envoi. */
export function duMois(mois: string): string {
  return deOuD(MOIS_LONGS[Number(mois.slice(5, 7)) - 1] ?? "");
}

/** Le dernier jour du mois : la fin de ce que le client peut choisir. */
export function finDuMois(mois: string): string {
  const [a, m] = [Number(mois.slice(0, 4)), Number(mois.slice(5, 7))];
  const d = new Date(Date.UTC(a, m, 0));
  return d.toISOString().slice(0, 10);
}

/** Le jour d'après, à midi UTC pour que l'heure d'été ne décale rien. */
export function lendemain(jour: string): string {
  return new Date(new Date(`${jour}T12:00:00Z`).getTime() + 86_400_000).toISOString().slice(0, 10);
}

/**
 * LES JOURS QUE LE CLIENT PEUT PRENDRE : le mois du passage, à partir de
 * demain. **Le mois entier**, pas la semaine du passage — sa correction du
 * 27 septembre : une semaine pleine laissait le client sans aucun choix.
 * NULL quand le mois est déjà fini.
 */
export function fenetreDuMois(mois: string, aujourdhui: string): { debut: string; fin: string } | null {
  const demain = lendemain(aujourdhui);
  const debut = demain > mois ? demain : mois;
  const fin = finDuMois(mois);
  return debut > fin ? null : { debut, fin };
}

/**
 * Les passages groupés par contrat et par mois, triés par mois puis par date.
 * Un chantier sans contrat, ou dont la clé ne se lit pas, n'y entre pas.
 */
export function groupesDesPassages<P extends PassageAuPlanning>(passages: readonly P[]): GroupeDuMois<P>[] {
  const groupes = new Map<string, GroupeDuMois<P>>();
  for (const p of passages) {
    if (!p.contratEntretienId || !p.contratPassage) continue;
    const mois = moisDuPassage(p.contratPassage);
    if (!mois) continue;
    const cle = `${p.contratEntretienId}|${mois}`;
    const g = groupes.get(cle) ?? { contratEntretienId: p.contratEntretienId, mois, passages: [] };
    g.passages.push(p);
    groupes.set(cle, g);
  }
  return [...groupes.values()]
    .map((g) => ({
      ...g,
      passages: [...g.passages].sort((a, b) => (a.datePlanifiee ?? "9999").localeCompare(b.datePlanifiee ?? "9999")),
    }))
    .sort((a, b) => a.mois.localeCompare(b.mois) || a.contratEntretienId.localeCompare(b.contratEntretienId));
}

/**
 * Ce que le tiroir montre : les mois PRÊTS à partir, et ceux qui attendent la
 * réponse du client.
 *
 * - **à envoyer** : aucun envoi pour ce contrat et ce mois, TOUTES ses dates
 *   posées, et au moins une encore à venir (envoyer des dates passées ne
 *   demande rien à personne) ;
 * - **en attente** : envoyé, sans réponse, et un jour encore à venir. Le
 *   dernier jour passé, l'attente n'a plus d'objet : les dates ont tenu.
 */
export function datesDuMois<P extends PassageAuPlanning>(
  passages: readonly P[],
  envois: readonly EnvoiDesDates[],
  aujourdhui: string
): { aEnvoyer: GroupeDuMois<P>[]; enAttente: (GroupeDuMois<P> & { envoyeLe: string })[] } {
  const aEnvoyer: GroupeDuMois<P>[] = [];
  const enAttente: (GroupeDuMois<P> & { envoyeLe: string })[] = [];
  for (const g of groupesDesPassages(passages)) {
    const aVenir = g.passages.some((p) => p.datePlanifiee !== null && p.datePlanifiee >= aujourdhui);
    if (!aVenir) continue;
    const envoi = envois.find((e) => e.contratEntretienId === g.contratEntretienId && e.mois === g.mois);
    if (envoi) {
      if (envoi.reponduLe === null) enAttente.push({ ...g, envoyeLe: envoi.envoyeLe });
      continue;
    }
    if (g.passages.every((p) => p.datePlanifiee !== null)) aEnvoyer.push(g);
  }
  return { aEnvoyer, enAttente };
}
