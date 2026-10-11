import type { Creneau, JourIso, Moment } from "./disponibilites";

/**
 * ─── LES ÉQUIPES JOUR PAR JOUR — sa demande du 15 septembre 2026 ────────────
 *
 * *« Sur le chantier de 8 jours, si je mets Antoine et Julien le premier jour,
 * ça les met automatiquement sur les 8 jours, ça c'est bien. Mais si le 4e jour
 * je décide de ne pas mettre Julien, ça l'enlève partout et ça faut pas ! Ça ne
 * sera pas forcément les mêmes équipes tous les jours ! »*
 *
 * Jusque-là une affectation ne portait qu'une demi-journée (migration 0058) :
 * « Julien le matin » valait le matin de CHAQUE jour du chantier, et décocher
 * le jeudi décochait tout. La migration 0093 ajoute un jour, **facultatif** :
 *
 * | `jour` | ce que la ligne dit |
 * |---|---|
 * | `null` | cette personne vient **chaque jour** posé du chantier — les lignes d'avant, intactes |
 * | une date | cette personne vient **ce jour-là** |
 *
 * **Sa règle, confirmée le 15 septembre (« oui ces deux points-là ») :**
 *
 * - **ajouter** quelqu'un un jour donné → il est mis **ce jour-là et tous les
 *   jours suivants** du chantier ;
 * - **retirer** quelqu'un un jour donné → il est retiré **ce jour-là seulement**.
 *
 * Tout ce fichier est pur : pas de base, pas d'écran. C'est la SEULE écriture
 * de la règle (`CLAUDE.md` §3) — le serveur décide avec elle, et l'écran lit
 * avec elle.
 */

/** Une affectation telle qu'elle est en base — `E` est le rang ou l'identifiant. */
export type LigneEquipe<E = number> = { jour: JourIso | null; demi: Moment; equipe: E };

/** Les rangs cochés, demi-journée par demi-journée — TRIÉS. */
export type EquipesParDemi = { matin: number[]; apres_midi: number[] };

/**
 * Ce que le planning reçoit pour un chantier.
 *
 * **`matin` / `apres_midi` disent qui vient AU MOINS UN jour** — c'est ce que
 * la ligne des planifiés écrit sous le nom du client, et ce que les contrôles
 * d'avant le 15 septembre lisaient (ils ne posaient que des lignes sans jour,
 * pour lesquelles « au moins un jour » et « chaque jour » sont la même chose).
 * **Pour UN jour, on lit `equipesDuJour`**, jamais ces deux listes.
 */
export type EquipesDuChantier = EquipesParDemi & { lignes: LigneEquipe[] };

function trie(rangs: Iterable<number>): number[] {
  return [...new Set(rangs)].sort((a, b) => a - b);
}

/** Ranger des lignes plates en ce que le planning lit. */
export function rangerEquipes(lignes: readonly LigneEquipe[]): EquipesDuChantier {
  return {
    matin: trie(lignes.filter((l) => l.demi === "matin").map((l) => l.equipe)),
    apres_midi: trie(lignes.filter((l) => l.demi === "apres_midi").map((l) => l.equipe)),
    lignes: [...lignes],
  };
}

/**
 * QUI VIENT CE JOUR-LÀ, demi-journée par demi-journée.
 *
 * Une ligne sans jour vaut pour chaque jour ; une ligne datée, pour le sien.
 * Les deux peuvent coexister pour la même personne — un décoché suivi d'un
 * recoché — et se lisent alors comme une seule coche.
 */
export function equipesDuJour(
  c: { lignes: readonly LigneEquipe[] },
  jour: JourIso
): EquipesParDemi {
  const ceJour = c.lignes.filter((l) => l.jour === null || l.jour === jour);
  return {
    matin: trie(ceJour.filter((l) => l.demi === "matin").map((l) => l.equipe)),
    apres_midi: trie(ceJour.filter((l) => l.demi === "apres_midi").map((l) => l.equipe)),
  };
}

/** Les jours posés sur cette demi-journée, triés, sans doublon. */
export function joursDuDemi(creneaux: readonly Creneau[], demi: Moment): JourIso[] {
  return [...new Set(creneaux.filter((c) => c.moment === demi).map((c) => c.jour))].sort();
}

const memeLigne = <E>(a: LigneEquipe<E>, b: LigneEquipe<E>) =>
  a.jour === b.jour && a.demi === b.demi && a.equipe === b.equipe;

/** Ce que la bascule doit écrire — rien d'autre. */
export type Bascule<E> = {
  /** Elle était cochée ce jour-là : on RETIRE. Sinon on AJOUTE. */
  cochee: boolean;
  retirer: LigneEquipe<E>[];
  ajouter: LigneEquipe<E>[];
};

/**
 * LA BASCULE D'UNE PASTILLE, sur UN jour d'UN chantier.
 *
 * **Ajouter → ce jour et les suivants** (de la même demi-journée), sans
 * doublonner ce qui est déjà écrit. Coché le premier jour, c'est donc tout le
 * chantier — ce qu'il faisait déjà, et qu'il trouve bien.
 *
 * **Retirer → ce jour seulement.** Si la coche venait d'une ligne sans jour
 * (« chaque jour »), elle ne peut pas perdre un seul jour : on la remplace par
 * une ligne datée pour chacun des autres jours posés, et celui qu'on retire
 * n'en reçoit pas. Rien n'est recopié à la migration — la ligne ne se déplie
 * qu'au premier geste qui l'exige.
 */
export function basculerCeJour<E>(
  lignes: readonly LigneEquipe<E>[],
  creneaux: readonly Creneau[],
  jour: JourIso,
  demi: Moment,
  equipe: E
): Bascule<E> {
  const siennes = lignes.filter((l) => l.demi === demi && l.equipe === equipe);
  const jours = joursDuDemi(creneaux, demi);
  const cochee = siennes.some((l) => l.jour === null || l.jour === jour);

  if (!cochee) {
    const deja = new Set(siennes.map((l) => l.jour));
    return {
      cochee,
      retirer: [],
      ajouter: jours.filter((j) => j >= jour && !deja.has(j)).map((j) => ({ jour: j, demi, equipe })),
    };
  }

  const retirer = siennes.filter((l) => l.jour === null || l.jour === jour);
  const datees = new Set(siennes.filter((l) => l.jour !== null).map((l) => l.jour));
  const ajouter = siennes.some((l) => l.jour === null)
    ? jours.filter((j) => j !== jour && !datees.has(j)).map((j) => ({ jour: j, demi, equipe }))
    : [];
  return { cochee, retirer, ajouter };
}

/**
 * QUAND LE CHANTIER BOUGE, ses lignes datées le suivent.
 *
 * Les lignes sans jour n'ont rien à suivre. Les autres :
 *
 * - **même jours** (une demi-journée libérée, un départ déplacé) : rien ne
 *   change ;
 * - **d'autres jours** (reposé une autre semaine) : le 1er jour devient le
 *   1er jour, le 4e le 4e — l'ordre des gens se conserve, pas leurs dates. Ce
 *   qui dépasse le nouveau nombre de jours tombe ;
 * - **plus aucun jour** (rendu à « Sans date ») : les lignes datées se
 *   replient en lignes sans jour, pour que personne ne soit perdu quand le
 *   chantier sera reposé. On ne sait plus dire « à partir du 4e jour » d'un
 *   chantier qui n'a plus de jours.
 *
 * Rend les lignes à écrire À LA PLACE des lignes datées, ou `null` s'il n'y a
 * rien à réécrire.
 */
export function reporterEquipes<E>(
  lignes: readonly LigneEquipe<E>[],
  avant: readonly Creneau[],
  apres: readonly Creneau[]
): LigneEquipe<E>[] | null {
  const datees = lignes.filter((l) => l.jour !== null);
  if (datees.length === 0) return null;

  const joursApres = [...new Set(apres.map((c) => c.jour))].sort();
  if (joursApres.length === 0) {
    // Repli : une ligne sans jour par (demi, personne), sans doublonner celles
    // qui existent déjà.
    const sansJour = lignes.filter((l) => l.jour === null);
    const repliees: LigneEquipe<E>[] = [];
    for (const l of datees) {
      const candidate = { jour: null, demi: l.demi, equipe: l.equipe };
      if (![...sansJour, ...repliees].some((x) => memeLigne(x, candidate))) repliees.push(candidate);
    }
    return repliees;
  }

  const apresSet = new Set(joursApres);
  if (datees.every((l) => apresSet.has(l.jour as JourIso))) return null;

  const joursAvant = [...new Set(avant.map((c) => c.jour))].sort();
  const reportees: LigneEquipe<E>[] = [];
  for (const l of datees) {
    const i = joursAvant.indexOf(l.jour as JourIso);
    const nouveau = i >= 0 ? joursApres[i] : undefined;
    if (nouveau === undefined) continue;
    const candidate = { jour: nouveau, demi: l.demi, equipe: l.equipe };
    if (!reportees.some((x) => memeLigne(x, candidate))) reportees.push(candidate);
  }
  return reportees;
}
