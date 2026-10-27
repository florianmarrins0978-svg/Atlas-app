import { cleCreneau, MOMENTS, type Creneau, type JourIso, type Moment } from "@/lib/disponibilites";

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
  /**
   * ─── DEPUIS LE 8 SEPTEMBRE 2026, UNE ABSENCE PEUT COMMENCER À MIDI ───────
   *
   * Sa question : *« je peux les mettre seulement le matin ou seulement
   * l'après-midi ? »* Elles sont **facultatives** ici, et c'est délibéré : des
   * dizaines d'appels construisent une absence à la main, et les rendre
   * obligatoires aurait forcé chaque appelant à répéter la journée entière.
   * Absentes, elles valent la journée — exactement ce que la base met par
   * défaut, et ce que toutes les absences d'avant signifiaient.
   */
  premierDemi?: Moment | string | null;
  dernierDemi?: Moment | string | null;
};

/** Ce que vaut une borne non renseignée : la journée entière. */
function borneDebut(a: Pick<AbsenceEquipe, "premierDemi">): Moment {
  return a.premierDemi === "apres_midi" ? "apres_midi" : "matin";
}
function borneFin(a: Pick<AbsenceEquipe, "dernierDemi">): Moment {
  return a.dernierDemi === "matin" ? "matin" : "apres_midi";
}

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

  // **Les bornes rognent le PREMIER et le DERNIER jour, jamais ceux du
  // milieu.** C'est tout le sens des deux colonnes : « du jeudi après-midi au
  // lundi matin » laisse le jeudi matin libre et le lundi après-midi libre,
  // mais occupe entièrement vendredi. Deux booléens appliqués à chaque jour
  // auraient retiré tous les matins de la période.
  const debut = borneDebut(absence);
  const fin = borneFin(absence);
  // Sur un seul jour, « de l'après-midi au matin » n'occupe rien. La base le
  // refuse (contrainte 0076) ; ici on refuse d'en déduire une absence vide,
  // qui retirerait zéro capacité en s'affichant comme une absence.
  if (premierJour === dernierJour && debut === "apres_midi" && fin === "matin") return [];

  const creneaux: Creneau[] = [];
  let jour = premierJour;
  for (let garde = 0; garde <= JOURS_MAX && jour <= dernierJour; garde++) {
    for (const moment of MOMENTS) {
      if (jour === premierJour && debut === "apres_midi" && moment === "matin") continue;
      if (jour === dernierJour && fin === "matin" && moment === "apres_midi") continue;
      creneaux.push({ jour, moment });
    }
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

/** Ce qu'une absence prend d'un jour : une moitié, ou la journée. */
export type MomentDuJour = Moment | "journee";

/** Ce que lisent les règles d'un jour : les dates et les bornes, pas l'équipe. */
type BornesAbsence = Omit<AbsenceEquipe, "equipeId">;

/** La veille, en UTC, comme `lendemain`. */
function veille(jour: JourIso): JourIso {
  const d = new Date(`${jour}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Ce qu'une absence prend de CE jour, ou `null` si elle ne le touche pas.
 *
 * **Les bornes ne rognent que le premier et le dernier jour** (comme
 * `creneauxOccupesParAbsence`) : un jeudi après-midi qui ouvre une semaine
 * d'absence se lit « après-midi » le jeudi, « journée » le vendredi. L'écran
 * lisait les bornes de la LIGNE, et disait donc « journée » le jeudi.
 */
export function momentDuJour(absence: BornesAbsence, jour: JourIso): MomentDuJour | null {
  if (jour < absence.premierJour || jour > absence.dernierJour) return null;
  const matin = !(jour === absence.premierJour && borneDebut(absence) === "apres_midi");
  const apresMidi = !(jour === absence.dernierJour && borneFin(absence) === "matin");
  if (matin && apresMidi) return "journee";
  if (matin) return "matin";
  if (apresMidi) return "apres_midi";
  return null;
}

/** Une absence à écrire : ses deux jours et ses deux bornes. */
export type PeriodeAbsence = {
  premierJour: JourIso;
  dernierJour: JourIso;
  premierDemi: Moment;
  dernierDemi: Moment;
};

/** Les bornes d'une absence d'un seul jour, pour un moment donné. */
export function periodeDuJour(jour: JourIso, moment: MomentDuJour): PeriodeAbsence {
  return {
    premierJour: jour,
    dernierJour: jour,
    premierDemi: moment === "apres_midi" ? "apres_midi" : "matin",
    dernierDemi: moment === "matin" ? "matin" : "apres_midi",
  };
}

/**
 * Ce qu'il reste d'une période quand on en retire UN jour : rien, un morceau
 * avant, un morceau après, ou les deux.
 *
 * **C'est la racine du défaut du 27 octobre 2026.** Le planning retirait la
 * ligne entière pour défaire un seul jour : une semaine notée dans Réglages,
 * Équipe disparaissait d'un appui, et ses dates redevenaient proposables au
 * client. Les bornes de la période se gardent aux deux bouts ; la coupure, elle,
 * tombe toujours entre deux journées entières.
 */
export function resteAutourDuJour(absence: AbsenceEquipe, jour: JourIso): PeriodeAbsence[] {
  if (jour < absence.premierJour || jour > absence.dernierJour) {
    return [
      {
        premierJour: absence.premierJour,
        dernierJour: absence.dernierJour,
        premierDemi: borneDebut(absence),
        dernierDemi: borneFin(absence),
      },
    ];
  }
  const reste: PeriodeAbsence[] = [];
  if (jour > absence.premierJour) {
    reste.push({ premierJour: absence.premierJour, dernierJour: veille(jour), premierDemi: borneDebut(absence), dernierDemi: "apres_midi" });
  }
  if (jour < absence.dernierJour) {
    reste.push({ premierJour: lendemain(jour), dernierJour: absence.dernierJour, premierDemi: "matin", dernierDemi: borneFin(absence) });
  }
  return reste;
}

/**
 * Le geste d'un jour, sur les absences d'une personne : ce qui se retire, ce
 * qui se pose. `moment` vaut `null` quand il la rend présente ce jour-là.
 *
 * **La même fonction sert à l'écran, qui devance le serveur, et au dépôt, qui
 * écrit** (`CLAUDE.md` §3). Seules les lignes qui touchent le jour bougent ;
 * les autres jours de leur période sont reposés tels quels.
 */
export function gesteDuJour<A extends AbsenceEquipe & { id: string }>(
  absences: readonly A[],
  jour: JourIso,
  moment: MomentDuJour | null
): { aRetirer: string[]; aPoser: (PeriodeAbsence & { depuis: A | null })[] } {
  const touchees = absences.filter((a) => a.premierJour <= jour && jour <= a.dernierJour);
  // `depuis` : la ligne d'où vient un morceau, pour qu'il garde son motif.
  const aPoser: (PeriodeAbsence & { depuis: A | null })[] = touchees.flatMap((a) =>
    resteAutourDuJour(a, jour).map((p) => ({ ...p, depuis: a }))
  );
  if (moment !== null) aPoser.push({ ...periodeDuJour(jour, moment), depuis: null });
  return { aRetirer: touchees.map((a) => a.id), aPoser };
}

/**
 * Ce que la feuille du planning écrit sous un nom : la période d'absence qui
 * entoure le jour, ou `null` s'il n'y en a pas.
 *
 * Une période qui traverse le jour se dit entière (« Du 26 au 30 octobre »).
 * Une fois le jour rendu ou réduit à une moitié, ce sont les morceaux qui le
 * touchent qui se disent (« Absent aussi le 26 octobre, et du 28 au 30
 * octobre ») : il voit que sa semaine n'a pas été effacée.
 */
export function phraseDeLaPeriode(absences: readonly BornesAbsence[], jour: JourIso): string | null {
  const longue = absences.find((a) => a.premierJour <= jour && jour <= a.dernierJour && a.premierJour < a.dernierJour);
  if (longue) {
    const texte = libelleAbsence(longue.premierJour, longue.dernierJour);
    return texte.charAt(0).toUpperCase() + texte.slice(1);
  }
  const avant = veille(jour);
  const apres = lendemain(jour);
  const voisines = absences
    .filter((a) => a.dernierJour === avant || a.premierJour === apres)
    .sort((x, y) => (x.premierJour < y.premierJour ? -1 : 1));
  if (voisines.length === 0) return null;
  const ceJour = absences.some((a) => momentDuJour(a, jour) !== null);
  return `${ceJour ? "Absent aussi" : "Absent"} ${voisines.map((a) => libelleAbsence(a.premierJour, a.dernierJour)).join(", et ")}`;
}

/** Les absences qui touchent le jour ou ses deux voisins : de quoi écrire `phraseDeLaPeriode`. */
export function autourDuJour<A extends AbsenceEquipe>(absences: readonly A[], jour: JourIso): A[] {
  const avant = veille(jour);
  const apres = lendemain(jour);
  return absences.filter((a) => a.premierJour <= apres && a.dernierJour >= avant);
}
