// Disponibilités du patron — voir docs/AGENT.md §2.2 bis.
//
// Ce module ne fait qu'une chose, et c'est voulu : dire quels JOURS sont
// occupés. Il ne renvoie jamais ce qui les occupe. La page du client reçoit
// des dates, rien d'autre — aucun intitulé de chantier, aucun nom, aucune
// adresse, aucune durée. Le client apprend que le patron n'est pas libre le 24,
// exactement ce qu'il aurait appris en téléphonant.

/** Fenêtre par défaut sur laquelle un client peut proposer une date. */
export const FENETRE_PROPOSITION_JOURS = 90;

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

  // « demi-journée », « une demi journée », « 1/2 journée »
  if (/(?:demi[\s-]*journ[ée]e|1\s*\/\s*2\s*journ[ée]e)/.test(t)) return 1;

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
  if (demiJournees % 2 === 0) return `${demiJournees / 2} jours`;
  return `${Math.floor(demiJournees / 2)} jours et demi`;
}

/** Libellé du moment, pour l'écran du patron — jamais pour le client. */
export const LIBELLE_MOMENT: Record<Moment, string> = {
  matin: "matin",
  apres_midi: "après-midi",
};
