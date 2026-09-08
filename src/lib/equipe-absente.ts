import { creneauxDuChantier, type Creneau, type JourIso } from "@/lib/disponibilites";

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
  /**
   * Les bornes de demi-journée, depuis le 8 septembre 2026 (choix D2).
   * Facultatives : absentes, elles valent la journée entière — ce que toutes
   * les absences d'avant signifiaient.
   */
  premierDemi?: string | null;
  dernierDemi?: string | null;
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

/**
 * Cette personne est-elle absente ce jour-là ? Bornes incluses.
 *
 * **Un JOUR est absent dès qu'une de ses deux moitiés l'est**, et c'est ce que
 * l'écran doit montrer : « Julien ven. » se lit sur les journées du chantier,
 * pas sur ses demi-journées. La finesse de la demi-journée sert la CAPACITÉ
 * (`absences-equipe.ts`) ; ici on répond à « quel jour n'est-il pas là ».
 */
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
 * ─── LES JOURS OÙ ELLE VIENT VRAIMENT, SUR CE CHANTIER ──────────────────────
 *
 * **Son choix du 8 septembre 2026 : la proposition C.** Il coche une fois,
 * comme avant, et c'est l'application qui retire le jour du congé et l'écrit —
 * « Julien ven. », sur une pastille cerclée au lieu d'être pleine.
 *
 * **Aucune migration sur les affectations, et c'est le point.** Le premier
 * chiffrage annonçait deux changements de base : un jour sur l'affectation,
 * une demi-journée sur l'absence. Le premier est inutile — l'exception se
 * DÉDUIT des congés, elle ne se saisit pas. Une colonne de moins, un geste
 * inchangé pour lui, et rien à ressaisir sur les chantiers déjà posés.
 *
 * Vide : cette personne ne vient aucun jour. L'écran ne doit alors pas écrire
 * « sauf tel jour » — c'est la coche entière qui n'a plus de sens.
 */
export function joursPresentsSurLeChantier(
  rang: number,
  chantier: ChantierPourAbsence,
  absences: readonly AbsenceDUneEquipe[],
  demi?: "matin" | "apres_midi"
): JourIso[] {
  return joursDuChantier(chantier).filter(
    (j) => !absenteCeCreneau(rang, j, demi, absences)
  );
}

/**
 * Absente sur CE créneau — la demi-journée quand on la connaît, la journée
 * entière sinon.
 *
 * **Depuis D2, une absence peut ne prendre qu'un matin** (8 septembre 2026).
 * La ligne « Matin » d'un chantier ne doit alors pas retirer le jour d'un congé
 * qui ne touche que l'après-midi : elle annoncerait un jour de moins que la
 * vérité, et le patron enverrait quelqu'un d'autre pour rien.
 *
 * Sans `demi`, on répond sur la journée : c'est ce qu'il faut pour un résumé
 * qui ne distingue pas les moitiés.
 */
export function absenteCeCreneau(
  rang: number,
  jour: JourIso,
  demi: "matin" | "apres_midi" | undefined,
  absences: readonly AbsenceDUneEquipe[]
): boolean {
  return absences.some((a) => {
    if (a.rang !== rang) return false;
    if (jour < a.premierJour || a.dernierJour < jour) return false;
    if (!demi) return true;
    // Les bornes ne rognent que le premier et le dernier jour de l'absence.
    if (jour === a.premierJour && a.premierDemi === "apres_midi" && demi === "matin") return false;
    if (jour === a.dernierJour && a.dernierDemi === "matin" && demi === "apres_midi") return false;
    return true;
  });
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
  const jours = joursDuChantier(chantier);
  // Pas encore posé : aucun jour traversé, rien à refuser.
  if (jours.length === 0) return false;
  // **On ne refuse QUE si elle n'est là aucun jour** — son choix C du
  // 8 septembre 2026, et c'est un assouplissement assumé de la règle du 286.
  //
  // Celle-ci refusait dès UN jour d'absence, faute de pouvoir exprimer
  // « Julien vendredi mais pas jeudi » : le modèle ne savait pas le dire, donc
  // on interdisait. C ne l'interdit plus, elle l'ÉCRIT — la pastille porte les
  // jours où il vient. Le contournement tombe avec la limite qu'il contournait.
  return joursPresentsSurLeChantier(rang, chantier, absences).length === 0;
}


/**
 * ─── CE QUE LA PASTILLE ÉCRIT SOUS LE NOM — sa proposition C ────────────────
 *
 * **Vide quand il n'y a rien à dire**, et c'est le cas de tous les jours : sur
 * un chantier d'un seul jour, ou sans aucun congé, la pastille reste ce qu'elle
 * a toujours été. Un écran qui écrirait « lun. mar. mer. » sur chaque coche
 * ferait payer à tous une précision qui ne sert qu'à quelques-uns.
 *
 * **Elle vit ici et pas dans l'écran** (`CLAUDE.md` §3) : la carte du jour, la
 * ligne des planifiés et la feuille du chantier montrent les mêmes pastilles,
 * et trois copies auraient fini par dire trois choses.
 *
 * **Elle NE dit pas les jours d'absence, mais les jours de PRÉSENCE.** « pas
 * jeudi » oblige à soustraire de tête pour savoir quand il vient ; « ven. »
 * répond directement. Sur un chantier de cinq jours dont trois de congé,
 * l'écart se voit.
 */
export function joursDeLaPastille(
  rang: number,
  chantier: ChantierPourAbsence,
  absences: readonly AbsenceDUneEquipe[],
  nomDuJour: (jour: JourIso) => string,
  demi?: "matin" | "apres_midi"
): string {
  const tous = joursDuChantier(chantier);
  // Un seul jour : la pastille est déjà datée par la journée qu'on regarde.
  if (tous.length <= 1) return "";
  const presents = joursPresentsSurLeChantier(rang, chantier, absences, demi);
  // Là tous les jours, ou là aucun : dans les deux cas, rien à préciser — le
  // second est déjà refusé à la coche, et l'annoncer serait redondant.
  if (presents.length === tous.length || presents.length === 0) return "";
  return presents.map(nomDuJour).join(" ");
}
