// Disponibilités du patron — voir docs/AGENT.md §2.2 bis.
//
// Ce module ne fait qu'une chose, et c'est voulu : dire quels JOURS sont
// occupés. Il ne renvoie jamais ce qui les occupe. La page du client reçoit
// des dates, rien d'autre — aucun intitulé de chantier, aucun nom, aucune
// adresse, aucune durée. Le client apprend que le patron n'est pas libre le 24,
// exactement ce qu'il aurait appris en téléphonant.

// La liste des durées qu'il déroule pour choisir. Elle est importée plutôt que
// recopiée : l'écran du choix et la ligne du planning doivent dire le même mot,
// et deux copies finissent toujours par diverger — voir `libelleDureeCourt`.
import { DUREES } from "@/lib/durees-chantier";

/** Fenêtre par défaut sur laquelle un client peut proposer une date. */
export const FENETRE_PROPOSITION_JOURS = 90;

/**
 * Jusqu'où le calendrier DU PATRON connaît ses jours déjà pris.
 *
 * **Sa réponse du 9 août 2026 :** *« tu peux aller jusqu'à douze mois
 * d'occupation. »* Il répondait à une réserve posée la veille : son calendrier
 * ne barrait ses journées complètes que sur trois mois, et au-delà il pouvait
 * proposer un jour déjà pris — le serveur le refusait ensuite, mais après coup.
 *
 * **À ne surtout pas confondre avec `FENETRE_PROPOSITION_JOURS`.** Celle-ci
 * borne ce que voit LE CLIENT, et elle ne bouge pas : lui livrer douze mois de
 * jours occupés reviendrait à lui donner le carnet de commandes
 * (`docs/AGENT.md` §2.2 bis). Les deux nombres décrivent deux personnes, et les
 * réunir un jour « pour simplifier » ouvrirait le planning à des inconnus.
 *
 * **Pourquoi douze et non dix-huit**, alors que l'horizon de proposition va à
 * dix-huit mois : c'est le chiffre qu'il a donné. Au-delà, le calendrier ne
 * barre rien et le serveur tranche — c'est le fonctionnement d'avant, conservé
 * pour la queue rare de l'horizon.
 */
export const HORIZON_OCCUPATION_PATRON_JOURS = 365;

/**
 * Jusqu'où LE PATRON peut proposer une date — dix-huit mois.
 *
 * **Le manque, dans ses mots, le 8 août 2026 :** *« la proposition des dates au
 * client, on a une visibilité que sur une semaine. Comment je fais si je dois
 * lui proposer une date dans six mois ? »* Il avait raison, et c'était pire
 * qu'il ne le disait : l'écran suggérait les six prochains jours ouvrés, et
 * **aucun autre choix n'existait**.
 *
 * Dix-huit mois, et pas six : l'élagage est saisonnier. Un client qui appelle
 * en août pour une haie « à la fin de l'hiver prochain » demande quatorze mois.
 * Un horizon qui s'arrête à douze le renverrait à un coup de téléphone —
 * exactement ce que ce parcours existe pour supprimer.
 *
 * **Ce n'est PAS ce que le client voit.** Les deux horizons sont volontairement
 * distincts : voir `fenetrePourDates`.
 */
export const HORIZON_PATRON_JOURS = 550;

/**
 * Marge laissée au client autour d'une date lointaine, pour en proposer une
 * autre.
 *
 * Trois semaines : assez pour « plutôt la semaine d'après », trop peu pour
 * livrer un semestre de planning à quelqu'un qui n'a rien signé.
 */
export const MARGE_AUTOUR_PROPOSITION_JOURS = 21;

/**
 * Délai minimal entre aujourd'hui et une date proposable. Proposer le jour même
 * n'a aucun sens pour un chantier, et proposer demain met le patron en défaut.
 */
export const DELAI_MINIMAL_JOURS = 2;

/** Format `AAAA-MM-JJ`, celui de PostgreSQL pour le type `date`. */
export type JourIso = string;

export function versJourIso(d: Date): JourIso {
  return d.toISOString().slice(0, 10);
}

export function ajouterJours(depuis: Date, jours: number): Date {
  const d = new Date(depuis.getTime());
  d.setUTCDate(d.getUTCDate() + jours);
  return d;
}

export type FenetreProposition = { debut: JourIso; fin: JourIso };

/**
 * Bornes de la fenêtre pendant laquelle un client peut retenir une date.
 *
 * Bornée des deux côtés : sans borne haute, la liste des jours occupés
 * exposerait le planning du patron bien au-delà de toute utilité.
 */
export function fenetreProposition(
  aujourdHui: Date,
  fenetreJours: number = FENETRE_PROPOSITION_JOURS
): FenetreProposition {
  return {
    debut: versJourIso(ajouterJours(aujourdHui, DELAI_MINIMAL_JOURS)),
    fin: versJourIso(ajouterJours(aujourdHui, fenetreJours)),
  };
}

/**
 * Ce que LE PATRON peut retenir : de après-demain à dix-huit mois.
 *
 * Sert à valider son choix, jamais à composer ce que le client verra.
 */
export function fenetrePatron(aujourdHui: Date): FenetreProposition {
  return {
    debut: versJourIso(ajouterJours(aujourdHui, DELAI_MINIMAL_JOURS)),
    fin: versJourIso(ajouterJours(aujourdHui, HORIZON_PATRON_JOURS)),
  };
}

/**
 * Ce que LE CLIENT voit — et c'est délibérément autre chose.
 *
 * **Les deux horizons sont séparés, et c'est la décision qui compte ici.** Le
 * patron peut proposer à dix-huit mois ; livrer dix-huit mois de jours occupés
 * à quelqu'un qui n'a rien signé serait lui donner le carnet de commandes. La
 * règle de ce module tient en une phrase (`docs/AGENT.md` §2.2 bis) : le client
 * apprend ce qu'il aurait appris en téléphonant, pas davantage.
 *
 * Deux cas, et un seul change quelque chose :
 *
 * - **dates proches** (dans les trois mois) : fenêtre inchangée, de
 *   après-demain à trois mois. C'est le cas ordinaire, et il ne bouge pas ;
 * - **date lointaine** : la fenêtre se déplace AUTOUR de la proposition, trois
 *   semaines de part et d'autre. Le client peut répondre « plutôt la semaine
 *   suivante » sans qu'on lui montre le semestre.
 *
 * Un client qui voudrait bien plus tôt garde deux issues : refuser, ou l'écrire
 * dans sa précision — le patron la lit.
 */
export function bandesVisibles(
  aujourdHui: Date,
  datesProposees: readonly JourIso[]
): FenetreProposition[] {
  const ordinaire = fenetreProposition(aujourdHui);
  const retenues = [...datesProposees].filter(Boolean).sort();
  const lointaines = retenues.filter((d) => d > ordinaire.fin);

  // Rien de lointain : le cas ordinaire, et il ne bouge pas d'un jour.
  if (lointaines.length === 0) return [ordinaire];

  const marge = (jour: JourIso, sens: 1 | -1) =>
    versJourIso(ajouterJours(new Date(`${jour}T12:00:00Z`), sens * MARGE_AUTOUR_PROPOSITION_JOURS));

  const bandes: FenetreProposition[] = [];
  // La bande ordinaire n'est conservée que si le patron a AUSSI proposé une
  // date proche : « soit jeudi, soit à la Toussaint ». S'il ne propose que la
  // Toussaint, montrer les trois prochains mois inviterait à une
  // contre-proposition qu'il n'a pas voulue — et livrerait un trimestre de
  // planning pour rien.
  if (retenues.some((d) => d <= ordinaire.fin)) bandes.push(ordinaire);

  for (const date of lointaines) {
    const debut = marge(date, -1);
    bandes.push({
      debut: debut < ordinaire.debut ? ordinaire.debut : debut,
      fin: marge(date, 1),
    });
  }

  // Deux bandes qui se touchent n'en font qu'une : sans cette fusion, un jour
  // situé dans les deux serait compté deux fois dans la liste des jours
  // occupés, et le client verrait la même date écrite en double.
  bandes.sort((a, b) => (a.debut < b.debut ? -1 : 1));
  const fusionnees: FenetreProposition[] = [];
  for (const bande of bandes) {
    const derniere = fusionnees[fusionnees.length - 1];
    if (derniere && bande.debut <= derniere.fin) {
      if (bande.fin > derniere.fin) derniere.fin = bande.fin;
      continue;
    }
    fusionnees.push({ ...bande });
  }
  return fusionnees;
}

/**
 * L'enveloppe des bandes : de la première à la dernière.
 *
 * C'est elle qui dit si une date **est recevable**. Elle peut être bien plus
 * large que ce que le client voit — « jeudi ou à la Toussaint » la fait courir
 * sur six mois — et c'est voulu : les deux dates proposées doivent rester
 * retenables, tandis que les jours occupés du milieu, eux, ne se montrent pas.
 */
export function fenetrePourDates(
  aujourdHui: Date,
  datesProposees: readonly JourIso[]
): FenetreProposition {
  const bandes = bandesVisibles(aujourdHui, datesProposees);
  return { debut: bandes[0].debut, fin: bandes[bandes.length - 1].fin };
}

/** Ce jour figure-t-il dans une bande montrable au client ? */
export function jourVisible(jour: JourIso, bandes: readonly FenetreProposition[]): boolean {
  return bandes.some((b) => jour >= b.debut && jour <= b.fin);
}

// ---------------------------------------------------------------------------
// Demi-journées et équipes
// ---------------------------------------------------------------------------
//
// **Ce que le patron a demandé, le 3 août 2026.**
//
// > « J'ai déjà un chantier le 6 août, donc on ne propose pas le 6 août. Mais si
// > mon 1er chantier du 6 ne dure que le matin, je ne peux pas caler une autre
// > demi-journée l'après-midi. »
// > « Si j'ai deux équipes dans ma boîte, je peux avoir deux chantiers, voire
// > plus, le 6 août. »
//
// Un jour n'est donc plus pris ou libre : il porte **deux demi-journées**, et
// chacune tient autant de chantiers que l'entreprise a d'équipes.
//
// **Et un troisième défaut que personne n'avait signalé** : la durée dictée
// (« 2 jours ») n'entrait nulle part dans la planification. Un chantier de deux
// jours calé le 6 laissait le 7 proposable au client suivant. Elle est
// désormais lue, et un chantier occupe autant de demi-journées qu'il en dure.
//
// **Ce que le client voit ne change pas d'un iota**, et c'est une consigne
// explicite du patron : « mon client ne doit pas être informé de la
// demi-journée, seulement moi ; lui verra le 6 août ». Toutes les fonctions
// ci-dessous vivent côté patron ; la page publique continue de ne recevoir que
// des DATES.

/**
 * Motif du refus, pour un message utile au client plutôt qu'un « date
 * invalide » qui ne lui apprend rien.
 *
 * `jour_occupe` recouvre désormais « plus de place ce jour-là pour ce
 * chantier » : ni le client ni le message ne distinguent une journée pleine
 * d'une demi-journée déjà prise — c'est la consigne du patron.
 */
export type MotifRefusDate = "hors_fenetre" | "jour_occupe";

/** Les deux moitiés d'une journée de travail. */
export type Moment = "matin" | "apres_midi";
export const MOMENTS: readonly Moment[] = ["matin", "apres_midi"];

/** Un chantier sans durée connue occupe une journée entière. */
export const DUREE_PAR_DEFAUT_DEMI_JOURNEES = 2;

export type Creneau = { jour: JourIso; moment: Moment };

/** Clé de comparaison d'un créneau — « 2026-08-06:matin ». */
export function cleCreneau(c: Creneau): string {
  return `${c.jour}:${c.moment}`;
}

function estWeekEnd(jour: JourIso): boolean {
  const j = new Date(`${jour}T12:00:00Z`).getUTCDay();
  return j === 0 || j === 6;
}

function jourSuivantOuvre(jour: JourIso): JourIso {
  let suivant = versJourIso(ajouterJours(new Date(`${jour}T12:00:00Z`), 1));
  while (estWeekEnd(suivant)) {
    suivant = versJourIso(ajouterJours(new Date(`${suivant}T12:00:00Z`), 1));
  }
  return suivant;
}

/**
 * Les créneaux qu'occupe un chantier, à partir de son départ et de sa durée.
 *
 * L'enchaînement **saute les samedis et dimanches** : un chantier de deux jours
 * commencé un vendredi matin se termine le lundi, pas le samedi. C'est la même
 * hypothèse que `premiersJoursLibres`, qui n'a jamais proposé de week-end — les
 * deux doivent dire la même chose, sinon un chantier réserverait un jour qu'on
 * ne propose jamais.
 */
export function creneauxDuChantier(depart: Creneau, dureeDemiJournees: number): Creneau[] {
  const total = Math.max(1, Math.trunc(dureeDemiJournees));
  const creneaux: Creneau[] = [];
  let jour = depart.jour;
  let moment = depart.moment;

  for (let i = 0; i < total; i++) {
    creneaux.push({ jour, moment });
    if (moment === "matin") {
      moment = "apres_midi";
    } else {
      moment = "matin";
      jour = jourSuivantOuvre(jour);
    }
  }
  return creneaux;
}

export type ChantierPlanifie = {
  jour: JourIso;
  /** Absent sur les chantiers planifiés avant l'existence des créneaux. */
  moment: Moment | null;
  /** Absente si jamais renseignée — une journée entière est alors supposée. */
  dureeDemiJournees: number | null;
};

/**
 * Combien de chantiers occupent chaque demi-journée.
 *
 * Un chantier planifié avant l'arrivée des créneaux n'a ni moment ni durée : il
 * est traité comme une **journée entière à partir du matin**, exactement le
 * comportement qu'il avait. Ne rien supposer d'autre est ce qui garantit qu'une
 * migration ne libère pas, du jour au lendemain, des après-midis déjà pris.
 */
export function compterOccupation(planifies: readonly ChantierPlanifie[]): Map<string, number> {
  const compte = new Map<string, number>();
  for (const p of planifies) {
    const depart: Creneau = { jour: p.jour, moment: p.moment ?? "matin" };
    const duree = p.dureeDemiJournees ?? DUREE_PAR_DEFAUT_DEMI_JOURNEES;
    for (const c of creneauxDuChantier(depart, duree)) {
      const cle = cleCreneau(c);
      compte.set(cle, (compte.get(cle) ?? 0) + 1);
    }
  }
  return compte;
}

/**
 * À quel moment de ce jour un chantier de cette durée peut-il commencer ?
 *
 * Renvoie `"matin"` de préférence — commencer tôt laisse la fin de journée
 * libre — puis `"apres_midi"`, puis `null` si le jour ne peut pas l'accueillir.
 * C'est cette fonction qui rend au patron l'après-midi du 6 août.
 */
export function departPossible(
  jour: JourIso,
  dureeDemiJournees: number,
  occupation: ReadonlyMap<string, number>,
  nombreEquipes: number
): Moment | null {
  const equipes = Math.max(1, Math.trunc(nombreEquipes));
  for (const moment of MOMENTS) {
    const tient = creneauxDuChantier({ jour, moment }, dureeDemiJournees).every(
      (c) => (occupation.get(cleCreneau(c)) ?? 0) < equipes
    );
    if (tient) return moment;
  }
  return null;
}

/**
 * Un jour est-il retenable pour un chantier de cette durée ?
 *
 * Elle sert à la fois à construire la liste proposée ET à revérifier la réponse
 * du client — une seule règle, jamais deux implémentations (`CLAUDE.md` §3).
 */
export function jourRetenable(
  jour: JourIso,
  dureeDemiJournees: number,
  occupation: ReadonlyMap<string, number>,
  nombreEquipes: number,
  fenetre: FenetreProposition
): boolean {
  if (jour < fenetre.debut || jour > fenetre.fin) return false;
  // **Le week-end n'est PAS refusé ici, et c'est délibéré.** Il est seulement
  // écarté des jours *suggérés* (`premiersJoursLibres`) : proposer un dimanche
  // à un particulier n'est presque jamais ce que veut l'artisan, mais un client
  // qui demande expressément un samedi doit pouvoir l'obtenir.
  //
  // L'avoir refusé ici a cassé deux suites d'un coup, sur des dates qui
  // tombaient un samedi. Le contrôle qui l'a vu n'était pas celui qui visait ce
  // comportement — raison de plus pour l'écrire noir sur blanc.
  return departPossible(jour, dureeDemiJournees, occupation, nombreEquipes) !== null;
}

/**
 * Traduit la durée dictée (« 2 jours », « une demi-journée ») en demi-journées.
 *
 * Renvoie `null` quand le texte ne dit rien d'exploitable : l'appelant décide
 * alors d'appliquer la journée par défaut, plutôt que de laisser cette fonction
 * inventer un chiffre (`CLAUDE.md` §4 — un champ sans source fiable reste vide).
 *
 * **Sur une fourchette, on retient le majorant.** « 2 à 3 jours » vaut six
 * demi-journées : sous-réserver ferait accepter au client une date où le patron
 * n'a pas la place, et c'est exactement ce que ce parcours doit supprimer.
 */
export function dureeEnDemiJournees(texte: string | null | undefined): number | null {
  if (!texte) return null;
  const t = texte.toLowerCase().replace(/ /g, " ");

  // « demi-journée », « une demi journée », « 1/2 journée », « ½ journée »
  //
  // **« ½ » a été ajouté le 16 août 2026, et ce n'était pas cosmétique.** C'est
  // le libellé que la molette affiche au patron (`src/lib/durees-chantier.ts`),
  // donc celui qu'il redit et qu'il dicte. Sans ce caractère, la phrase tombait
  // sur la règle suivante — « journée » sans chiffre reconnu — et rendait DEUX
  // demi-journées : une demi-journée dictée réservait la journée entière, sans
  // qu'aucun écran ne le signale.
  if (/(?:demi[\s-]*journ[ée]e|(?:1\s*\/\s*2|½)\s*journ[ée]e)/.test(t)) return 1;

  const MOTS: Record<string, number> = {
    un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5,
    six: 6, sept: 7, huit: 8, neuf: 9, dix: 10,
  };
  const nombre = (brut: string): number | null => {
    const n = Number(brut.replace(",", "."));
    if (Number.isFinite(n) && n > 0) return n;
    return MOTS[brut] ?? null;
  };

  const unite = "(?:jours?|journ[ée]es?)";
  const chiffre = "(\\d+(?:[.,]\\d+)?|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix)";

  // Fourchette : « 2 à 3 jours », « 2-3 jours ».
  const plage = t.match(new RegExp(`${chiffre}\\s*(?:[àa]|-|/)\\s*${chiffre}\\s*${unite}`));
  if (plage) {
    const hauts = [nombre(plage[1]), nombre(plage[2])].filter((n): n is number => n !== null);
    if (hauts.length > 0) return Math.max(1, Math.round(Math.max(...hauts) * 2));
  }

  const simple = t.match(new RegExp(`${chiffre}\\s*${unite}`));
  if (simple) {
    const n = nombre(simple[1]);
    if (n !== null) return Math.max(1, Math.round(n * 2));
  }

  // « une journée » sans chiffre reconnu par les motifs ci-dessus.
  if (new RegExp(`\\b${unite}\\b`).test(t)) return DUREE_PAR_DEFAUT_DEMI_JOURNEES;

  return null;
}

/** Libellé lisible d'une durée, pour l'écran du patron. */
export function libelleDuree(demiJournees: number): string {
  if (demiJournees === 1) return "une demi-journée";
  if (demiJournees === 2) return "une journée";
  // « une journée et demie », pas « 1 jours et demi » : le cas d'une journée
  // et demie tombait dans la règle du pluriel et produisait une faute
  // d'accord, à côté d'un « 1 » qui n'a rien à faire là.
  if (demiJournees === 3) return "une journée et demie";
  if (demiJournees % 2 === 0) return `${demiJournees / 2} jours`;
  return `${Math.floor(demiJournees / 2)} jours et demi`;
}

/**
 * La durée **en abrégé**, dans les mots de la liste où il la choisit.
 *
 * **Deux registres, et c'est délibéré.** `libelleDuree` écrit de la prose —
 * « une journée ne tient pas ce jour-là » — et se lit dans une phrase.
 * Celle-ci écrit une ÉTIQUETTE, sur une ligne de 204 px : « ½ journée »,
 * « 1 journée », « 3 jours ». Fondre les deux donnerait « une journée » sur une
 * ligne où l'on compte, ou « 1 journée » au milieu d'une phrase.
 *
 * **Les mots viennent de `DUREES`, jamais d'ici.** C'est la liste qu'il déroule
 * pour choisir la durée d'un chantier : l'écran de la ligne et l'écran du choix
 * doivent dire le même mot, sans quoi il choisit « 1 journée » et lit autre
 * chose le lendemain. Le 4 août 2026, il avait déjà corrigé « 1 jour » en
 * « 1 journée » ; le 15 août, une maquette écrivait de nouveau « ½ jour » et il
 * a dû le redire. Recopier ces mots à la main, c'est reprogrammer cet
 * aller-retour.
 *
 * **Le repli n'est pas décoratif.** `DUREES` ne propose que la demi-journée
 * puis des jours entiers, mais `dureeEnDemiJournees` peut rendre un nombre
 * IMPAIR à partir d'une durée dictée (« une journée et demie » → 3). Une durée
 * impossible à choisir reste possible à recevoir, et une ligne muette vaudrait
 * pire qu'un mot approximatif.
 */
export function libelleDureeCourt(demiJournees: number): string {
  const n = Math.max(1, Math.trunc(demiJournees));
  const dansLaListe = DUREES.find((d) => d.demiJournees === n);
  if (dansLaListe) return dansLaListe.libelle;
  const jours = Math.floor(n / 2);
  return `${jours} ${jours > 1 ? "jours" : "journée"} ½`;
}

/** Libellé du moment, pour l'écran du patron — jamais pour le client. */
export const LIBELLE_MOMENT: Record<Moment, string> = {
  matin: "matin",
  apres_midi: "après-midi",
};

/**
 * Ce qu'un chantier OCCUPE, dit en toutes lettres.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * **LE DÉFAUT QUE CETTE FONCTION REMPLACE, ET POURQUOI IL COMPTAIT.**
 *
 * La ligne du planning écrivait `creneauDebut` — la demi-journée de DÉPART —
 * et rien d'autre. Or `DUREE_PAR_DEFAUT_DEMI_JOURNEES` vaut 2 : un chantier
 * posé prend la journée entière. **Le cas le plus courant du produit était
 * donc celui qui mentait**, et un chantier de trois jours annonçait « matin ».
 *
 * Le patron, capture à l'appui le 13 août 2026 : *« ça laisse à penser que
 * juste le matin est bloqué alors que c'est la journée »*.
 *
 * **Ce qui n'était PAS en cause :** `compterOccupation()` parcourt déjà
 * `creneauxDuChantier(départ, durée)`. Les pastilles du calendrier et la
 * réservation ont toujours compté juste — seule la phrase se trompait. Aucune
 * donnée n'a été touchée, aucune migration.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * **La règle vient des créneaux, jamais d'un calcul refait à côté.** On
 * demande à `creneauxDuChantier` ce que le chantier occupe vraiment — c'est
 * elle qui saute les week-ends — puis on compte les jours distincts. Refaire
 * l'arithmétique ici produirait deux vérités : celle de l'écran et celle de la
 * réservation, qui finiraient par diverger un vendredi.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * **CE QUE LE PATRON A ARRÊTÉ LE 15 AOÛT 2026, ET QUI REMPLACE LA VEILLE.**
 *
 * Sur `docs/maquettes/59-la-ligne-qui-dit-tout.html` : *« je veux journée et
 * toute la ligne »*, après avoir demandé *« il doit y avoir le nombre de jour,
 * le matin, l'après-midi et la journée comme infos possible »*.
 *
 * La ligne porte donc **le moment de départ ET la durée** :
 *
 *   · une journée pleine partie le matin → « journée », seule. Le mot porte la
 *     durée à lui seul ; « journée · 1 journée » aurait dit deux fois la même
 *     chose sur une ligne de 204 px ;
 *   · une vraie demi-journée → « matin · ½ journée » ;
 *   · tout le reste → « matin · 3 jours », « après-midi · 1 journée ».
 *
 * **« du 21 au 25 août » est retiré**, alors qu'il l'avait choisi la veille sur
 * la planche 53. Ce qui se perd est réel et doit être su : la ligne ne dit plus
 * QUAND le chantier finit, et « 3 jours » partis un vendredi finissent le mardi
 * — les week-ends étant sautés, il ne peut pas le recalculer de tête. Ce qui se
 * gagne est ce qu'il a demandé : le nombre de jours, qu'aucune plage de dates
 * ne donnait.
 *
 * **L'INVARIANT À NE JAMAIS PERDRE, et il n'est pas d'écriture.** « matin » ne
 * s'écrit JAMAIS sans sa durée. Seul, il redit exactement le défaut qu'il a
 * signalé le 13 août — *« ça laisse à penser que juste le matin est bloqué »*.
 * C'est le nombre accolé qui le rend honnête : « matin · 3 jours » ne se lit
 * pas comme une demi-journée. Alléger la ligne un jour en retirant la durée
 * rouvrirait ce défaut sans que rien ne le dise — `test-libelle-occupation.ts`
 * le garde.
 * ─────────────────────────────────────────────────────────────────────────
 */
export type Occupation = {
  /** « journée », « matin · ½ journée », « après-midi · 1 journée ». */
  texte: string;
};

export function libelleOccupation(
  jour: JourIso,
  moment: Moment | null,
  dureeDemiJournees: number | null
): Occupation {
  // Un chantier posé avant l'existence des créneaux n'a ni moment ni durée :
  // il est traité comme une journée entière à partir du matin, exactement le
  // comportement qu'il avait. C'est la même hypothèse que `compterOccupation`,
  // et elle doit le rester.
  const depart: Creneau = { jour, moment: moment === "apres_midi" ? "apres_midi" : "matin" };
  const duree = Math.max(1, Math.trunc(dureeDemiJournees ?? DUREE_PAR_DEFAUT_DEMI_JOURNEES));
  const creneaux = creneauxDuChantier(depart, duree);

  const jours = [...new Set(creneaux.map((c) => c.jour))];

  // **La journée pleine, et elle seule, se passe de durée** : le mot la porte.
  // Le test est bien « un seul jour ET deux créneaux » — deux demi-journées
  // parties l'APRÈS-MIDI n'en sont pas une : elles occupent cet après-midi et
  // la matinée du lendemain, et écrire « journée » ferait croire à l'artisan
  // que sa matinée du lendemain est libre.
  if (jours.length === 1 && creneaux.length === 2) return { texte: "journée" };

  return { texte: `${LIBELLE_MOMENT[depart.moment]} · ${libelleDureeCourt(duree)}` };
}
