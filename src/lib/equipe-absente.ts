import { creneauxDuChantier, type Creneau, type JourIso } from "../server/disponibilites";

/**
 * ─── ON NE COCHE PAS QUELQU'UN QUI N'EST PAS LÀ ─────────────────────────────
 *
 * **Son signalement du 7 septembre 2026, capture à l'appui :** *« j'ai mis
 * Julien en congé, la feuille le dit aussi, or je peux quand même sélectionner
 * Julien ce jour — il doit être grisé et on ne doit pas pouvoir le
 * sélectionner. »*
 *
 * **Ce qui manquait, et c'est une moitié de règle.** Une absence était déjà
 * comptée là où elle change une DATE — les jours proposés au client
 * (`absences-equipe.ts`, 14 août 2026). Elle ne l'était nulle part où elle
 * change une PERSONNE : les pastilles d'équipe du planning ne l'ont jamais
 * consultée. On pouvait donc envoyer sur un chantier quelqu'un que
 * l'application savait absent, et l'écran l'affichait sans broncher — deux
 * vérités sur la même journée, à trois centimètres d'écart.
 *
 * **ELLE VIT ICI, ET PAS DANS L'ÉCRAN.** `CLAUDE.md` §3 : *« jamais de règle
 * dupliquée entre l'affichage et la vérification »*. La même fonction grise la
 * pastille et refuse la coche au serveur. Écrite deux fois, la version de
 * l'écran aurait suffi — et un écran ne protège rien : il se contourne.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **UN CHANTIER DE DEUX JOURS AVEC UN SEUL JOUR D'ABSENCE : LE CAS QUI TRANCHE.**
 *
 * Une équipe n'est pas cochée « pour le 10 » : elle est cochée **pour le matin
 * du chantier**, et cette coche traverse tous les jours qu'il occupe. Le modèle
 * ne sait pas dire « Julien le 11 mais pas le 10 ».
 *
 * | Refuser dès UN jour d'absence | Refuser seulement si TOUS les jours |
 * |---|---|
 * | il ne peut pas cocher Julien sur un chantier de deux jours dont un tombe sur son congé | Julien est annoncé sur le chantier un jour où il n'y sera pas |
 * | le coût : une coche à faire autrement | le coût : **personne ne vient** |
 *
 * On refuse dès UN jour. C'est le côté sûr, et le seul des deux qui ne fasse
 * pas partir un chantier sans personne — la règle de prudence du dépôt, qui
 * choisit toujours l'erreur qui se répare.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **ON PEUT TOUJOURS DÉCOCHER, ET C'EST ESSENTIEL.** Sa capture montre Julien
 * COCHÉ sur un jour où il est absent : la coche est antérieure au congé. Griser
 * franchement l'aurait enfermé dans l'état faux, sans aucun moyen d'en sortir —
 * il n'existe pas d'autre chemin pour retirer quelqu'un d'une demi-journée.
 *
 * Le refus ne porte donc que sur la COCHE. Une pastille déjà cochée reste
 * cliquable pour être retirée, et son gris dit pourquoi il faut le faire.
 */

/** Une absence, telle que l'écran et le serveur la connaissent tous les deux. */
export type AbsenceDUneEquipe = {
  /** Le rang de la personne — c'est lui que porte une pastille. */
  rang: number;
  /** Premier jour d'absence, inclus. « AAAA-MM-JJ ». */
  premierJour: JourIso;
  /** Dernier jour d'absence, inclus. */
  dernierJour: JourIso;
};

/** Le chantier concerné, réduit à ce dont cette règle a besoin. */
export type ChantierPourAbsence = {
  datePlanifiee: JourIso | null;
  /**
   * **Une chaîne libre, et c'est délibéré.** La base rend un `string` ; exiger
   * ici un `Moment` obligerait chaque appelant à convertir, donc à écrire deux
   * fois la même conversion — et c'est toujours la seconde qui se trompe. Tout
   * ce qui n'est pas « apres_midi » vaut matin, comme partout ailleurs.
   */
  creneauDebut: string | null;
  dureeDemiJournees: number | null;
};

/** La durée par défaut, quand le chantier n'en porte pas — une journée. */
const DUREE_PAR_DEFAUT = 2;

/** Les jours qu'un chantier traverse. Vide s'il n'est pas encore posé. */
export function joursDuChantier(c: ChantierPourAbsence): JourIso[] {
  if (!c.datePlanifiee) return [];
  const creneaux: Creneau[] = creneauxDuChantier(
    { jour: c.datePlanifiee, moment: c.creneauDebut === "apres_midi" ? "apres_midi" : "matin" },
    c.dureeDemiJournees ?? DUREE_PAR_DEFAUT
  );
  return [...new Set(creneaux.map((x) => x.jour))];
}

/** Cette personne est-elle absente ce jour-là ? Bornes incluses. */
export function absenteCeJour(
  rang: number,
  jour: JourIso,
  absences: readonly AbsenceDUneEquipe[]
): boolean {
  return absences.some(
    (a) => a.rang === rang && a.premierJour <= jour && jour <= a.dernierJour
  );
}

/**
 * Les jours du chantier où cette personne n'est pas là.
 *
 * **Elle rend les JOURS, pas un oui/non**, et ce n'est pas du zèle : l'écran
 * doit pouvoir dire *lequel*. « Julien n'est pas là le 10 » se corrige ; « on ne
 * peut pas » s'endure.
 */
export function joursAbsentsDuChantier(
  rang: number,
  chantier: ChantierPourAbsence,
  absences: readonly AbsenceDUneEquipe[]
): JourIso[] {
  return joursDuChantier(chantier).filter((j) => absenteCeJour(rang, j, absences));
}

/**
 * Peut-on cocher cette personne sur ce chantier ?
 *
 * **`dejaCochee` renverse la réponse**, et c'est la raison d'être du paramètre :
 * le geste est une BASCULE. Décocher quelqu'un d'absent est exactement ce qu'on
 * veut permettre — c'est la réparation de l'état que le patron a photographié.
 */
export function cocheRefusee(
  rang: number,
  chantier: ChantierPourAbsence,
  absences: readonly AbsenceDUneEquipe[],
  dejaCochee: boolean
): boolean {
  if (dejaCochee) return false;
  return joursAbsentsDuChantier(rang, chantier, absences).length > 0;
}
