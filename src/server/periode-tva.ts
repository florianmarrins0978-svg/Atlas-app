// Le découpage de l'année pour le relevé de TVA — au mois ou au trimestre.
//
// **Pourquoi les deux, et pourquoi le mois d'abord.** Jusqu'au 12 août 2026 cet
// écran ne connaissait que le trimestre, posé par défaut sans qu'aucune ligne
// du dépôt n'explique pourquoi. Le patron a soulevé le point : *« la TVA
// collectée, ça doit être mois par mois et pas trimestre par trimestre […]
// renseigne-toi d'abord »*. Il avait raison.
//
// La déclaration au régime réel normal (formulaire CA3) est **mensuelle par
// défaut**. Le trimestre est une OPTION, ouverte seulement quand la TVA due de
// l'année précédente est inférieure à 4 000 € ; au-delà, on repasse au mois.
// Le régime réel simplifié — déclaration annuelle et deux acomptes — disparaît
// au 1er janvier 2027 (article 38 de la loi de finances pour 2025, loi
// n° 2025-127 du 14 février 2025) : à partir de là, « mensuel ou trimestriel »
// est la seule question qui se pose.
//
// **Ce que cette application ne fera JAMAIS : décider lequel s'applique.** Le
// seuil des 4 000 € porte sur la TVA *due* — collectée moins déductible. Atlas
// ne connaît que la collectée : il ne voit ni le gazole, ni la tronçonneuse, ni
// l'assurance. Il ne peut donc pas calculer le droit au trimestre, et il ne
// doit pas le laisser croire (`CLAUDE.md` §4). Le patron indique sa
// périodicité dans Réglages, sur la foi de son comptable ; l'écran obéit.
//
// Fonctions pures, sans accès base : vérifiables sans monter une facture. Le
// calcul se fait en UTC de bout en bout, comme partout où l'application
// manipule des jours (`src/lib/jour.ts`) — passer par le fuseau local
// décalerait le 1er janvier au 31 décembre pour tout l'ouest de Greenwich, et
// rangerait une facture dans la mauvaise période.

/** Ce que le patron a choisi dans Réglages. Le mois est le défaut légal. */
export type PeriodiciteTva = "mensuelle" | "trimestrielle";

export const PERIODICITE_TVA_PAR_DEFAUT: PeriodiciteTva = "mensuelle";

export type PeriodeTva = {
  periodicite: PeriodiciteTva;
  annee: number;
  /** 1 à 12 en mensuel, 1 à 4 en trimestriel. */
  numero: number;
  /** Premier jour inclus, au format AAAA-MM-JJ. */
  debut: string;
  /** Dernier jour inclus, au format AAAA-MM-JJ. */
  fin: string;
};

const MOIS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

/** Combien de numéros compte une année, selon la périodicité. */
export function nombreDePeriodes(periodicite: PeriodiciteTva): number {
  return periodicite === "mensuelle" ? 12 : 4;
}

function jourIso(annee: number, moisZeroBase: number, jour: number) {
  return new Date(Date.UTC(annee, moisZeroBase, jour)).toISOString().slice(0, 10);
}

export function periodeTva(periodicite: PeriodiciteTva, annee: number, numero: number): PeriodeTva {
  const combien = nombreDePeriodes(periodicite);
  const n = Math.min(combien, Math.max(1, Math.trunc(numero)));
  const pas = periodicite === "mensuelle" ? 1 : 3;
  const premierMois = (n - 1) * pas;
  return {
    periodicite,
    annee,
    numero: n,
    debut: jourIso(annee, premierMois, 1),
    // Le jour 0 du mois suivant est le dernier du mois courant — ce qui évite
    // d'avoir à connaître les longueurs de mois et les années bissextiles.
    fin: jourIso(annee, premierMois + pas, 0),
  };
}

export function periodeCourante(periodicite: PeriodiciteTva, maintenant: Date = new Date()): PeriodeTva {
  const mois = maintenant.getUTCMonth();
  const numero = periodicite === "mensuelle" ? mois + 1 : Math.floor(mois / 3) + 1;
  return periodeTva(periodicite, maintenant.getUTCFullYear(), numero);
}

export function periodePrecedente(p: PeriodeTva): PeriodeTva {
  return p.numero === 1
    ? periodeTva(p.periodicite, p.annee - 1, nombreDePeriodes(p.periodicite))
    : periodeTva(p.periodicite, p.annee, p.numero - 1);
}

export function periodeSuivante(p: PeriodeTva): PeriodeTva {
  return p.numero === nombreDePeriodes(p.periodicite)
    ? periodeTva(p.periodicite, p.annee + 1, 1)
    : periodeTva(p.periodicite, p.annee, p.numero + 1);
}

/** « Août 2026 » ou « 3e trimestre 2026 ». */
export function libellePeriode(p: PeriodeTva): string {
  if (p.periodicite === "mensuelle") {
    const nom = MOIS[p.numero - 1];
    return `${nom.slice(0, 1).toUpperCase()}${nom.slice(1)} ${p.annee}`;
  }
  return `${p.numero === 1 ? "1er" : `${p.numero}e`} trimestre ${p.annee}`;
}

/** « Août » ou « 3e trimestre » — sans l'année, pour le calendrier. */
export function libelleCourt(periodicite: PeriodiciteTva, numero: number): string {
  if (periodicite === "mensuelle") {
    const nom = MOIS[numero - 1];
    return `${nom.slice(0, 1).toUpperCase()}${nom.slice(1)}`;
  }
  return numero === 1 ? "1er trimestre" : `${numero}e trimestre`;
}

/**
 * « juil. – sept. » sous un trimestre, et rien sous un mois.
 *
 * Un mois n'a pas besoin qu'on lui explique de quels mois il est fait ; un
 * trimestre, si — « 3e trimestre » ne dit pas à quelqu'un qui cherche une
 * facture d'août que c'est là qu'il doit regarder.
 */
export function moisDuNumero(periodicite: PeriodiciteTva, numero: number): string | null {
  if (periodicite === "mensuelle") return null;
  const courts = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  const premier = (numero - 1) * 3;
  return `${courts[premier]} – ${courts[premier + 2]}`;
}

/**
 * Ce que valent une année et un numéro venus de la barre d'adresse.
 *
 * Rend `null` sur tout ce qui n'est pas lisible — l'écran retombe alors sur la
 * période courante. Un paramètre bricolé à la main ne doit pas produire un
 * écran vide et inexplicable, ni une période de l'an 40 000.
 */
export function lirePeriode(
  periodicite: PeriodiciteTva,
  annee: string | undefined,
  numero: string | undefined
): PeriodeTva | null {
  const a = Number(annee);
  const n = Number(numero);
  if (!Number.isInteger(a) || a < 2000 || a > 2200) return null;
  if (!Number.isInteger(n) || n < 1 || n > nombreDePeriodes(periodicite)) return null;
  return periodeTva(periodicite, a, n);
}

/**
 * Dans quelle période tombe un jour donné.
 *
 * **Née d'un défaut réel, le 13 août 2026.** Le patron scanne un ticket de
 * gazole du 24 juillet depuis l'écran d'août : l'achat est enregistré — au bon
 * endroit, dans juillet — et **disparaît de sa vue**. La TVA déductible d'août
 * ne bouge pas, et il conclut, à raison de son point de vue, que rien n'a été
 * pris.
 *
 * L'écran ne montrait qu'une période et n'avait aucun moyen de dire « c'est
 * rangé, mais ailleurs ». Cette fonction lui donne ce moyen : elle dit où un
 * achat atterrit, avant de le confirmer comme après.
 */
export function periodeContenant(periodicite: PeriodiciteTva, jourIso: string): PeriodeTva | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(jourIso)) return null;
  const annee = Number(jourIso.slice(0, 4));
  const mois = Number(jourIso.slice(5, 7));
  if (!Number.isInteger(annee) || mois < 1 || mois > 12) return null;
  const numero = periodicite === "mensuelle" ? mois : Math.floor((mois - 1) / 3) + 1;
  return periodeTva(periodicite, annee, numero);
}

/** Ce jour tombe-t-il dans cette période ? Bornes incluses des deux côtés. */
export function dansLaPeriode(p: PeriodeTva, jourIso: string): boolean {
  return jourIso >= p.debut && jourIso <= p.fin;
}
