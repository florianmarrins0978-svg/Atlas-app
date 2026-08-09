/**
 * Ce qu'un agenda extérieur occupe dans le planning d'Atlas.
 *
 * **Le manque, dans ses mots, le 9 août 2026 :** *« ce qui serait bien, c'est
 * que l'utilisateur puisse, s'il le souhaite ou non, connecter son planning à
 * son agenda Google. »*
 *
 * Jusqu'ici, Atlas déduisait les jours libres des **seuls chantiers qu'il
 * connaissait**. Un rendez-vous noté ailleurs était invisible : Atlas proposait
 * ce jour-là, le client le choisissait, et l'artisan découvrait le doublon le
 * matin même — le devis parti, la date acceptée, la promesse faite. C'est le
 * seul endroit du parcours où Atlas pouvait engager quelqu'un sur une
 * information qu'il n'avait pas ; partout ailleurs il s'arrête et demande.
 *
 * **Ce module ne parle à personne.** Il ne connaît ni Google, ni jeton, ni
 * réseau : il reçoit des périodes occupées et rend des créneaux. C'est ce qui
 * permet de l'éprouver entièrement ici, alors que le raccordement lui-même
 * demande un compte que l'environnement de développement n'a pas.
 */
import {
  cleCreneau,
  MOMENTS,
  versJourIso,
  type Creneau,
  type JourIso,
  type Moment,
} from "../server/disponibilites";

/**
 * Une période pendant laquelle l'artisan n'est pas disponible, telle qu'un
 * agenda la rend : deux instants, et rien d'autre.
 *
 * **Pas d'intitulé, pas de participants, et ce n'est pas un oubli.** Un agenda
 * personnel porte les rendez-vous médicaux, les vacances, la vie de la famille.
 * Savoir qu'une demi-journée est prise n'exige pas d'en connaître le contenu, et
 * ce type est l'endroit où cette limite se tient : ce qu'il ne peut pas porter
 * ne peut pas se retrouver ailleurs par distraction. Même règle qu'à la page du
 * client, qui reçoit des dates et rien d'autre (`docs/AGENT.md` §2.2 bis).
 */
export type PeriodeOccupee = {
  /** Instant de début, en UTC. */
  debut: Date;
  /** Instant de fin, en UTC. Exclusive : un rendez-vous 9h–12h finit à 12h00. */
  fin: Date;
};

/**
 * Où coupe la journée de travail, en heures locales de l'artisan.
 *
 * Le matin va de `DEBUT_MATIN` à `MIDI`, l'après-midi de `MIDI` à `FIN_JOURNEE`.
 * Ce qui tombe hors de ces bornes — un dîner à 20 h, un réveil à 6 h —
 * n'occupe rien : Atlas ne planifie pas de chantier à ces heures-là, et bloquer
 * une demi-journée pour un repas priverait l'artisan d'un créneau qu'il aurait
 * accepté.
 */
export const DEBUT_MATIN = 8;
export const MIDI = 13;
export const FIN_JOURNEE = 18;

/**
 * Le fuseau dans lequel les heures ci-dessus se lisent.
 *
 * **Ce n'est pas un détail cosmétique.** Un rendez-vous « 9 h – 10 h » posé à
 * Paris en été s'écrit `07:00Z`. Lu en UTC sans correction, il tomberait avant
 * `DEBUT_MATIN` et n'occuperait rien : l'artisan verrait sa matinée proposée au
 * client alors qu'il est chez le médecin. C'est exactement le défaut que tout ce
 * module existe pour empêcher, reproduit par une étourderie d'une ligne.
 */
export const FUSEAU_ARTISAN = "Europe/Paris";

/**
 * L'heure locale et le jour local d'un instant, dans le fuseau de l'artisan.
 *
 * Passe par `Intl` plutôt que par un décalage codé en dur : la France change
 * d'heure deux fois par an, et un `+1` figé se trompe la moitié de l'année.
 */
function localiser(instant: Date, fuseau: string): { jour: JourIso; heure: number; minute: number } {
  const parties = new Intl.DateTimeFormat("fr-CA", {
    timeZone: fuseau,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);

  const lire = (type: string) => parties.find((p) => p.type === type)?.value ?? "";
  return {
    // `fr-CA` rend « 2026-08-09 », déjà au format de PostgreSQL.
    jour: `${lire("year")}-${lire("month")}-${lire("day")}`,
    heure: Number(lire("hour")),
    minute: Number(lire("minute")),
  };
}

/** Les bornes d'un demi-journée, en minutes depuis minuit local. */
function bornes(moment: Moment): { debut: number; fin: number } {
  return moment === "matin"
    ? { debut: DEBUT_MATIN * 60, fin: MIDI * 60 }
    : { debut: MIDI * 60, fin: FIN_JOURNEE * 60 };
}

/**
 * Les demi-journées qu'une période occupée rend indisponibles.
 *
 * **Le moindre chevauchement suffit**, et c'est un choix, pas une approximation.
 * Un rendez-vous de trente minutes à 10 h ne laisse pas une matinée exploitable
 * à un élagueur : il faut charger le matériel, rouler, grimper, redescendre. Le
 * risque des deux côtés n'est pas symétrique — bloquer un peu trop coûte un
 * créneau proposé en moins, ne pas bloquer assez coûte un client à qui l'on a
 * promis une date qu'on ne tiendra pas.
 *
 * Une période qui s'étale sur plusieurs jours — des vacances, un stage — occupe
 * toutes les demi-journées qu'elle traverse, week-ends compris : la question
 * « suis-je là ? » ne connaît pas les jours ouvrés.
 */
export function creneauxOccupesPar(
  periode: PeriodeOccupee,
  fuseau: string = FUSEAU_ARTISAN
): Creneau[] {
  // Une période vide ou à l'envers n'occupe rien. Un agenda peut rendre l'une
  // comme l'autre ; les refuser en silence vaut mieux que de bloquer un jour
  // au hasard sur une donnée qui n'a pas de sens.
  if (!(periode.debut instanceof Date) || !(periode.fin instanceof Date)) return [];
  if (Number.isNaN(periode.debut.getTime()) || Number.isNaN(periode.fin.getTime())) return [];
  if (periode.fin.getTime() <= periode.debut.getTime()) return [];

  const depart = localiser(periode.debut, fuseau);
  const arrivee = localiser(periode.fin, fuseau);
  const minutesDepart = depart.heure * 60 + depart.minute;
  const minutesArrivee = arrivee.heure * 60 + arrivee.minute;

  const creneaux: Creneau[] = [];
  let jour = depart.jour;

  // Borne de sûreté : un agenda mal formé peut annoncer une période de dix ans.
  // Deux ans de demi-journées suffisent à couvrir tout horizon d'Atlas, et
  // évitent qu'une donnée absurde fasse tourner cette boucle indéfiniment.
  for (let garde = 0; garde <= 750 && jour <= arrivee.jour; garde++) {
    for (const moment of MOMENTS) {
      const b = bornes(moment);
      // Sur le premier jour, la période commence à son heure ; sur les jours
      // suivants elle couvre depuis minuit. Symétriquement pour le dernier.
      const debutIci = jour === depart.jour ? minutesDepart : 0;
      const finIci = jour === arrivee.jour ? minutesArrivee : 24 * 60;
      // Chevauchement strict : une réunion qui finit à 13 h 00 pile n'entame
      // pas l'après-midi, et une qui commence à 13 h 00 n'entame pas le matin.
      if (debutIci < b.fin && finIci > b.debut) creneaux.push({ jour, moment });
    }
    jour = ajouterUnJour(jour);
  }

  return creneaux;
}

/** Le lendemain, en date civile — sans passer par les fuseaux, la date suffit. */
function ajouterUnJour(jour: JourIso): JourIso {
  const d = new Date(`${jour}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return versJourIso(d);
}

/**
 * L'occupation d'Atlas, augmentée de celle de l'agenda extérieur.
 *
 * **Une seule carte d'occupation, jamais deux.** Le résultat repart dans
 * `jourRetenable`, `departPossible` et `joursSansPlace` sans qu'aucune d'elles
 * ne sache d'où vient l'occupation — c'est la règle du dépôt (`CLAUDE.md` §3 :
 * jamais de règle dupliquée entre l'affichage et la vérification). Un second
 * calcul posé à côté finirait par diverger du premier : c'est ce dédoublement
 * qui avait rangé un chantier dans deux onglets à la fois (`ARCHITECTURE.md`
 * §33).
 *
 * **Un créneau d'agenda SATURE le créneau**, là où un chantier n'y consomme
 * qu'une équipe. La différence est voulue : le nombre d'équipes dit combien de
 * chantiers peuvent tourner en parallèle, pas combien de fois l'artisan peut
 * être à deux endroits. Atlas ne sait pas si une équipe peut partir sans lui —
 * et le supposer, c'est reprendre le pari que ce module existe pour supprimer.
 * Le jour où l'artisan voudra la nuance, elle se réglera par un choix explicite
 * de sa part, pas par une hypothèse d'ici.
 *
 * La carte reçue n'est jamais modifiée : elle sert ailleurs, et une carte
 * mutée à distance est un défaut qu'on ne retrouve qu'au troisième écran.
 */
export function fusionnerOccupationExterne(
  occupation: ReadonlyMap<string, number>,
  periodes: readonly PeriodeOccupee[],
  nombreEquipes: number,
  fuseau: string = FUSEAU_ARTISAN
): Map<string, number> {
  const fusionnee = new Map(occupation);
  const equipes = Math.max(1, Math.trunc(nombreEquipes));

  for (const periode of periodes) {
    for (const creneau of creneauxOccupesPar(periode, fuseau)) {
      const cle = cleCreneau(creneau);
      // `Math.max` plutôt qu'une addition : deux rendez-vous le même matin ne
      // le rendent pas « deux fois indisponible », et l'écraser à `equipes`
      // effacerait un chantier déjà compté si l'agenda était plus permissif.
      fusionnee.set(cle, Math.max(fusionnee.get(cle) ?? 0, equipes));
    }
  }

  return fusionnee;
}

/**
 * Ce que l'écran de l'agenda annonce en titre.
 *
 * **Sortie du composant après avoir regardé une capture.** L'écran titrait
 * « Atlas tient compte de votre agenda » et démentait trois lignes plus bas par
 * « Atlas n'arrive plus à lire votre agenda » : la panne était traitée APRÈS le
 * cas « relié et actif », donc jamais. Aucun test ne l'avait vu, et aucun ne
 * pouvait le voir — la phrase vivait dans le JSX.
 *
 * Le titre est ce que l'artisan lit en premier, et souvent le seul. Il doit
 * porter l'état réel, pas l'intention. **L'ordre des cas EST la règle** :
 * la panne prime sur la pause, qui prime sur le fonctionnement nominal.
 */
export type EtatAffichableAgenda = {
  configure: boolean;
  relie: boolean;
  actif: boolean;
  derniereErreur: string | null;
};

export function titreEtatAgenda(etat: EtatAffichableAgenda): string {
  if (!etat.configure) return "Le raccordement n'est pas encore disponible";
  if (!etat.relie) return "Aucun agenda relié";
  if (etat.derniereErreur) return "Votre agenda n'est plus lu";
  if (!etat.actif) return "Agenda relié, mais en pause";
  return "Atlas tient compte de votre agenda";
}

/**
 * Atlas tient-il réellement compte de l'agenda, à cette seconde ?
 *
 * Sert à décider si la phrase rassurante s'affiche. Une panne doit la faire
 * taire : promettre « une demi-journée prise ne sera plus proposée » alors que
 * la lecture échoue est précisément le mensonge que cet écran doit empêcher.
 */
export function agendaPrisEnCompte(etat: EtatAffichableAgenda): boolean {
  return etat.configure && etat.relie && etat.actif && !etat.derniereErreur;
}
