import { cleCreneau, MOMENTS, type Creneau, type JourIso } from "../server/disponibilites";

/**
 * Une équipe absente ne compte plus dans les dates proposées.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **Le patron, le 14 août 2026 :** *« Comment on fait si jamais il y a une
 * équipe qui doit partir en déplacement pour cinq jours ? Est-ce qu'il y a un
 * moyen de l'ajouter au planning ? »*
 *
 * Retenu sur maquette (`docs/maquettes/55`, proposition A) : les absences se
 * posent sous les noms, dans Réglages → Équipe.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **CE QUI EXISTAIT DÉJÀ, ET QU'IL NE FAUT PAS REFAIRE.** Si TOUTE l'entreprise
 * part, l'agenda extérieur relié suffit : une période de plusieurs jours occupe
 * toutes les demi-journées qu'elle traverse (`agenda-externe.ts`). Ce module
 * sert l'autre cas — **une équipe sur deux** —, où l'agenda bloquerait aussi
 * celle qui reste.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **L'IDÉE, ET POURQUOI ELLE NE CHANGE AUCUNE SIGNATURE.**
 *
 * On aurait pu faire varier le nombre d'équipes jour par jour, et passer une
 * fonction là où passe aujourd'hui un nombre. Il aurait fallu toucher
 * `departPossible`, `jourRetenable`, et leurs six appelants — c'est-à-dire les
 * trois chemins qui décident d'une date, dont la revérification de la réponse
 * du client. Beaucoup de surface pour un défaut qui ne se verrait qu'en
 * production, chez un client qui a retenu un jour impossible.
 *
 * **Une absence s'exprime bien plus simplement : comme une occupation.** Une
 * équipe qui n'est pas là occupe exactement la place qu'un chantier lui aurait
 * prise. La capacité restante se calcule alors toute seule, avec la même
 * comparaison qu'avant — `occupation < nombreEquipes` — et **les trois chemins
 * en héritent sans qu'aucun ne le sache**, puisqu'ils partagent déjà une seule
 * carte d'occupation (`envois-devis.ts`, `chargerContrainte`).
 *
 * C'est la même mécanique que l'agenda extérieur, à une différence près qui
 * compte : l'agenda pose `Math.max(…, nombreEquipes)` — il bloque TOUT LE
 * MONDE, faute de savoir qui part. Une absence, elle, sait de quelle équipe il
 * s'agit : elle **ajoute une unité**, et une seule.
 */

/** Une équipe qui n'est pas là, telle que la base la porte. */
export type AbsenceEquipe = {
  /** Quelle équipe — jamais lu par le calcul, mais nécessaire pour l'écran. */
  equipeId: string;
  /** Premier jour d'absence, inclus. « AAAA-MM-JJ ». */
  premierJour: JourIso;
  /** Dernier jour d'absence, inclus. */
  dernierJour: JourIso;
};

/** Deux ans de jours : au-delà, une donnée absurde ferait tourner la boucle. */
const JOURS_MAX = 750;

const EST_UN_JOUR = /^\d{4}-\d{2}-\d{2}$/;

/** Le lendemain, en UTC — comme partout où l'application manipule des jours. */
function lendemain(jour: JourIso): JourIso {
  const d = new Date(`${jour}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Les demi-journées qu'une absence retire.
 *
 * **Bornes incluses des deux côtés**, et week-ends compris : la question « mon
 * équipe est-elle là ? » ne connaît pas les jours ouvrés, exactement comme pour
 * l'agenda extérieur. Une absence d'un seul jour porte deux fois la même date —
 * c'est le cas ordinaire, pas une erreur de saisie.
 *
 * Une absence illisible ou à l'envers n'occupe **rien**. Bloquer un jour au
 * hasard sur une donnée qui n'a pas de sens coûterait un créneau que le patron
 * ne comprendrait pas avoir perdu.
 */
export function creneauxOccupesParAbsence(absence: AbsenceEquipe): Creneau[] {
  const { premierJour, dernierJour } = absence;
  if (!EST_UN_JOUR.test(premierJour) || !EST_UN_JOUR.test(dernierJour)) return [];
  if (dernierJour < premierJour) return [];

  const creneaux: Creneau[] = [];
  let jour = premierJour;
  for (let garde = 0; garde <= JOURS_MAX && jour <= dernierJour; garde++) {
    for (const moment of MOMENTS) creneaux.push({ jour, moment });
    jour = lendemain(jour);
  }
  return creneaux;
}

/**
 * L'occupation, une fois les équipes absentes retirées de la capacité.
 *
 * **On AJOUTE une unité par équipe absente, on n'écrase pas.** Deux équipes
 * parties la même semaine retirent deux unités, et un chantier déjà posé ce
 * jour-là garde la sienne : additionner est la seule opération qui dise la
 * vérité sur la place restante.
 *
 * **Le total est borné au nombre d'équipes.** Sans cela, trois absences dans
 * une entreprise qui en compte deux laisseraient une occupation de trois —
 * inoffensive pour la comparaison, mais fausse pour tout écran qui voudrait un
 * jour lire cette carte pour dire « il reste combien de place ». Une donnée
 * juste vaut mieux qu'une donnée qui se trouve avoir le bon effet.
 *
 * La carte reçue n'est jamais modifiée : elle sert ailleurs, et une carte mutée
 * à distance est un défaut qu'on ne retrouve qu'au troisième écran.
 */
export function fusionnerAbsences(
  occupation: ReadonlyMap<string, number>,
  absences: readonly AbsenceEquipe[],
  nombreEquipes: number
): Map<string, number> {
  const fusionnee = new Map(occupation);
  const equipes = Math.max(1, Math.trunc(nombreEquipes));

  for (const absence of absences) {
    for (const creneau of creneauxOccupesParAbsence(absence)) {
      const cle = cleCreneau(creneau);
      fusionnee.set(cle, Math.min(equipes, (fusionnee.get(cle) ?? 0) + 1));
    }
  }

  return fusionnee;
}

/**
 * Cette absence croise-t-elle la fenêtre regardée ?
 *
 * Sert à ne charger que ce qui compte. Deux périodes se croisent dès que l'une
 * commence avant que l'autre ne finisse — la comparaison de chaînes suffit, le
 * format « AAAA-MM-JJ » se triant comme une date.
 */
export function croiseLaFenetre(
  absence: AbsenceEquipe,
  debut: JourIso,
  fin: JourIso
): boolean {
  return absence.premierJour <= fin && absence.dernierJour >= debut;
}

/** Ce qu'une saisie d'absence a de fautif, ou `null` si elle tient. */
export type RefusAbsence = "jour_illisible" | "a_l_envers" | "trop_longue";

/** Au-delà, c'est une saisie fautive plutôt qu'un déplacement. */
export const DUREE_ABSENCE_MAX_JOURS = 366;

/**
 * Vérifier une absence avant de l'écrire.
 *
 * **La même fonction sert à l'écran et au serveur** — jamais deux règles qui
 * finiraient par diverger (`CLAUDE.md` §3). L'écran s'en sert pour éteindre son
 * bouton ; l'action serveur la rejoue, parce qu'un écran n'est pas une garde.
 */
export function refusDeLAbsence(premierJour: string, dernierJour: string): RefusAbsence | null {
  if (!EST_UN_JOUR.test(premierJour) || !EST_UN_JOUR.test(dernierJour)) return "jour_illisible";
  if (dernierJour < premierJour) return "a_l_envers";

  const jours =
    (Date.parse(`${dernierJour}T00:00:00Z`) - Date.parse(`${premierJour}T00:00:00Z`)) / 86_400_000 + 1;
  if (!Number.isFinite(jours) || jours > DUREE_ABSENCE_MAX_JOURS) return "trop_longue";
  return null;
}

/** La phrase à montrer au patron. Une par refus, jamais un « réessayez ». */
export function phraseDuRefus(refus: RefusAbsence): string {
  switch (refus) {
    case "jour_illisible":
      return "Les dates ne sont pas lisibles.";
    case "a_l_envers":
      return "Le dernier jour tombe avant le premier.";
    case "trop_longue":
      return "Plus d’un an d’absence : vérifiez les dates.";
  }
}

/**
 * « du 8 au 12 septembre », ou « le 8 septembre » quand c'est un seul jour.
 *
 * **Ce n'est pas une coquetterie.** « du 8 septembre au 8 septembre » se lit
 * comme une erreur de l'application, et le patron chercherait ce qu'il a mal
 * saisi. Le mois n'est écrit qu'une fois quand les deux jours le partagent :
 * « du 8 septembre au 12 septembre » est plus long à lire pour rien.
 */
export function libelleAbsence(premierJour: JourIso, dernierJour: JourIso): string {
  const format = (jour: JourIso, avecMois: boolean) =>
    new Date(`${jour}T12:00:00Z`).toLocaleDateString("fr-FR", {
      day: "numeric",
      ...(avecMois ? { month: "long" as const } : {}),
      timeZone: "UTC",
    });

  if (premierJour === dernierJour) return `le ${format(premierJour, true)}`;
  const memeMois = premierJour.slice(0, 7) === dernierJour.slice(0, 7);
  return `du ${format(premierJour, !memeMois)} au ${format(dernierJour, true)}`;
}
