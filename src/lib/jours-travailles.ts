// Les jours travaillés d'un salarié, sur un mois.
//
// **Sa demande du 5 novembre 2026** : *« pour le bilan comptable, même pour
// faire les payes, ils sont obligés de donner à chaque fois le nombre de jours
// travaillés par salarié »*, compté sur les absences notées, et *« le compteur
// ne doit pas être bloqué »* : 18 calculés, 15 vrais, il le change. Sa planche
// `appli/soignee/jours-travailles.html`, la A choisie : quand le chiffre bouge,
// un appui dit pourquoi.
//
// **LE CALCUL, et chacun de ses termes se lit à l'écran :**
//   les jours ouvrés du mois, du lundi au vendredi (comme le planning) ;
//   moins les fériés (`src/lib/jours-feries.ts`) ;
//   moins les absences notées, une demi-journée pour une demie, SAUF celles
//     qui comptent travaillées (déplacement, formation :
//     `src/lib/nature-absence.ts`).
// Une absence notée « week-ends compris » ne retire que ses jours ouvrés.
//
// **La correction ne défait pas le calcul** : les deux restent, et l'écran les
// montre ensemble. Une absence notée APRÈS une correction change le calcul,
// pas le chiffre saisi : il voit l'écart et décide.

import type { JourIso } from "@/lib/disponibilites";
import { libelleAbsence, momentDuJour, type AbsenceEquipe } from "@/lib/absences-equipe";
import { nomDuFerie } from "@/lib/jours-feries";
import { compteTravaille, type NatureAbsence } from "@/lib/nature-absence";

/** « 2026-11 ». */
export type MoisIso = string;

export function moisValide(mois: unknown): mois is MoisIso {
  if (typeof mois !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(mois)) return false;
  const annee = Number(mois.slice(0, 4));
  return annee >= 2000 && annee <= 2100;
}

export function moisDuJour(jour: JourIso): MoisIso {
  return jour.slice(0, 7);
}

/** Le mois d'avant ou d'après. */
export function moisVoisin(mois: MoisIso, pas: number): MoisIso {
  const d = new Date(Date.UTC(Number(mois.slice(0, 4)), Number(mois.slice(5, 7)) - 1 + pas, 1, 12));
  return d.toISOString().slice(0, 7);
}

/** Le premier et le dernier jour du mois. */
export function bornesDuMois(mois: MoisIso): { debut: JourIso; fin: JourIso } {
  const annee = Number(mois.slice(0, 4));
  const m = Number(mois.slice(5, 7));
  const fin = new Date(Date.UTC(annee, m, 0, 12)).toISOString().slice(0, 10);
  return { debut: `${mois}-01`, fin };
}

const MOIS_LONGS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

/** « novembre 2026 ». */
export function nomDuMois(mois: MoisIso): string {
  return `${MOIS_LONGS[Number(mois.slice(5, 7)) - 1]} ${mois.slice(0, 4)}`;
}

function joursDuMois(mois: MoisIso): JourIso[] {
  const { debut, fin } = bornesDuMois(mois);
  const jours: JourIso[] = [];
  for (let d = new Date(`${debut}T12:00:00Z`); d.toISOString().slice(0, 10) <= fin; d.setUTCDate(d.getUTCDate() + 1)) {
    jours.push(d.toISOString().slice(0, 10));
  }
  return jours;
}

function estWeekEnd(jour: JourIso): boolean {
  const j = new Date(`${jour}T12:00:00Z`).getUTCDay();
  return j === 0 || j === 6;
}

/**
 * Les jours ouvrés du mois, et les fériés qu'il a fallu retirer (ceux qui
 * tombent en semaine : un 1er novembre un dimanche ne retire rien).
 */
export function joursOuvresDuMois(mois: MoisIso, alsaceMoselle = false): { ouvres: JourIso[]; feries: { jour: JourIso; nom: string }[] } {
  const ouvres: JourIso[] = [];
  const feries: { jour: JourIso; nom: string }[] = [];
  for (const jour of joursDuMois(mois)) {
    if (estWeekEnd(jour)) continue;
    const nom = nomDuFerie(jour, alsaceMoselle);
    if (nom) feries.push({ jour, nom });
    else ouvres.push(jour);
  }
  return { ouvres, feries };
}

/** Ce qu'une absence retire d'un jour ouvré : 0, une demie ou la journée. */
function partDuJour(absence: AbsenceEquipe, jour: JourIso): number {
  const m = momentDuJour(absence, jour);
  return m === null ? 0 : m === "journee" ? 1 : 0.5;
}

export type AbsenceDuMois = {
  /** « du 23 au 24 novembre », « le 12 novembre au matin ». */
  dit: string;
  /** Les jours ouvrés qu'elle couvre, une demie comptant pour 0,5. */
  jours: number;
  nature: NatureAbsence | null;
  /** Déplacement ou formation : couverte, mais comptée travaillée. */
  travaillee: boolean;
};

export type CompteDuMois = {
  /** Les jours ouvrés du mois, fériés retirés. */
  ouvres: number;
  /** Le compte que l'appli fait seule. */
  calcul: number;
  absences: AbsenceDuMois[];
  /** Les jours d'absence dont personne n'a dit pourquoi. */
  sansNature: number;
  /**
   * Les jours ouvrés où il a travaillé au moins une demi-journée : ce que
   * comptent les zones de déplacement (une demi-journée de chantier vaut un
   * jour dans sa zone).
   */
  joursDeTravail: JourIso[];
};

/**
 * Le compte d'un mois pour UN salarié, à partir de SES absences.
 *
 * **Deux absences qui se chevauchent ne retirent pas deux fois le même jour** :
 * un jour ne peut pas être retiré de plus d'une journée.
 */
export function compteDuMois(mois: MoisIso, absences: readonly AbsenceEquipe[], alsaceMoselle = false): CompteDuMois {
  const { ouvres } = joursOuvresDuMois(mois, alsaceMoselle);
  const { debut, fin } = bornesDuMois(mois);
  let retire = 0;
  let sansNature = 0;
  const joursDeTravail: JourIso[] = [];
  for (const jour of ouvres) {
    let absentCeJour = 0;
    let sansNatureCeJour = 0;
    for (const a of absences) {
      const part = partDuJour(a, jour);
      if (part === 0 || compteTravaille(a.nature ?? null)) continue;
      absentCeJour += part;
      if (!a.nature) sansNatureCeJour += part;
    }
    const partRetiree = Math.min(1, absentCeJour);
    retire += partRetiree;
    sansNature += Math.min(partRetiree, sansNatureCeJour);
    if (partRetiree < 1) joursDeTravail.push(jour);
  }

  const lues: AbsenceDuMois[] = absences
    .filter((a) => a.premierJour <= fin && a.dernierJour >= debut)
    .map((a) => {
      const de = a.premierJour < debut ? debut : a.premierJour;
      const a2 = a.dernierJour > fin ? fin : a.dernierJour;
      const jours = ouvres.reduce((t, j) => t + partDuJour(a, j), 0);
      const seul = de === a2 ? momentDuJour(a, de) : "journee";
      const dit =
        de === a2
          ? `${libelleAbsence(de, de)}${seul === "matin" ? " au matin" : seul === "apres_midi" ? " l’après-midi" : ""}`
          : libelleAbsence(de, a2);
      return { de, dit, jours, nature: a.nature ?? null, travaillee: compteTravaille(a.nature ?? null) };
    })
    .filter((a) => a.jours > 0)
    // Dans l'ordre du mois : c'est l'ordre dans lequel il se souvient.
    .sort((x, y) => x.de.localeCompare(y.de))
    .map((x) => ({ dit: x.dit, jours: x.jours, nature: x.nature, travaillee: x.travaillee }));

  return { ouvres: ouvres.length, calcul: ouvres.length - retire, absences: lues, sansNature, joursDeTravail };
}

// ─── LA CORRECTION À LA MAIN ────────────────────────────────────────────────

/** Ce qui se dit quand le chiffre BAISSE, puis quand il MONTE (sa planche, la A). */
export const MOTIFS_EN_MOINS = ["conge", "maladie", "sans_solde", "autre"] as const;
export const MOTIFS_EN_PLUS = ["samedi", "ferie", "autre_plus"] as const;
export type MotifCorrection = (typeof MOTIFS_EN_MOINS)[number] | (typeof MOTIFS_EN_PLUS)[number];

export const LIBELLE_MOTIF_CORRECTION: Record<MotifCorrection, string> = {
  conge: "Congé",
  maladie: "Maladie",
  sans_solde: "Sans solde",
  autre: "Autre",
  samedi: "Samedi travaillé",
  ferie: "Férié travaillé",
  autre_plus: "Autre",
};

/** Un motif relu : il doit exister ET aller dans le sens de l'écart. */
export function motifCorrectionLu(valeur: unknown, ecart: number): MotifCorrection | null {
  if (typeof valeur !== "string" || ecart === 0) return null;
  const liste: readonly string[] = ecart < 0 ? MOTIFS_EN_MOINS : MOTIFS_EN_PLUS;
  return liste.includes(valeur) ? (valeur as MotifCorrection) : null;
}

/** Le plafond d'un mois : trente et un jours, samedis et dimanches compris. */
export const JOURS_MAX_DU_MOIS = 31;

/**
 * Un nombre de jours saisi, relu : « 19,5 » comme « 19.5 », par demi-journée,
 * entre 0 et 31. Autre chose ne vaut rien, plutôt que de s'arrondir en silence.
 */
export function joursSaisisLus(valeur: unknown): number | null {
  const n = typeof valeur === "number" ? valeur : typeof valeur === "string" ? Number(valeur.replace(",", ".").trim()) : NaN;
  if (typeof valeur === "string" && valeur.trim() === "") return null;
  if (!Number.isFinite(n) || n < 0 || n > JOURS_MAX_DU_MOIS) return null;
  return Number.isInteger(n * 2) ? n : null;
}

/** « 19,5 » : la virgule française, sans zéro inutile. */
export function nombreDeJours(n: number): string {
  return String(n).replace(".", ",");
}

/** « 1,5 jour », « 2 jours » : le pluriel français commence à deux. */
export function enJours(n: number): string {
  return `${nombreDeJours(n)} ${Math.abs(n) < 2 ? "jour" : "jours"}`;
}

// ─── CE QUI SE LIT, À L'ÉCRAN ET SUR LE PDF ─────────────────────────────────
//
// Une seule rédaction pour les deux : le comptable doit lire ce que le patron a
// vu sous le nom de son salarié.

const LIBELLE_NATURE_EN_TETE: Record<NatureAbsence, string> = {
  conge: "Congé",
  maladie: "Maladie",
  sans_solde: "Sans solde",
  deplacement: "Déplacement",
  formation: "Formation",
  autre: "Absent",
};

/** « Congé du 23 au 24 novembre », « Absent le 12 novembre au matin ». */
export function phraseDeLAbsence(a: AbsenceDuMois): string {
  const tete = a.nature ? LIBELLE_NATURE_EN_TETE[a.nature] : "Absent";
  return `${tete} ${a.dit}${a.travaillee ? ", compté travaillé" : ""}`;
}

/** Le chiffre du mois : celui saisi, sinon le calcul. */
export function valeurDuMois(compte: CompteDuMois, saisi: number | null): number {
  return saisi ?? compte.calcul;
}

/**
 * La correction, dite : « Maladie, 3 jours », « Samedi travaillé, 1 jour de
 * plus » ; `null` sans écart. Sans motif, `sansMotif` le dit, et l'écran
 * comme le PDF le montrent en couleur.
 */
export function phraseDeLaCorrection(
  compte: CompteDuMois,
  saisi: number | null,
  motif: MotifCorrection | null
): { texte: string; sansMotif: boolean } | null {
  const ecart = valeurDuMois(compte, saisi) - compte.calcul;
  if (ecart === 0) return null;
  if (motif) return { texte: `${LIBELLE_MOTIF_CORRECTION[motif]}, ${enJours(Math.abs(ecart))}${ecart > 0 ? " de plus" : ""}`, sansMotif: false };
  return { texte: `${enJours(Math.abs(ecart))} de ${ecart < 0 ? "moins" : "plus"} que le calcul, sans motif`, sansMotif: true };
}

/** « Mois en cours, 20 jours ouvrés, le 11 est férié. » */
export function resumeDuMois(mois: MoisIso, ouvres: number, feries: readonly { jour: JourIso }[], enCours: boolean): string {
  const jours = feries.map((f) => Number(f.jour.slice(8, 10)));
  const ferie =
    jours.length === 0
      ? ""
      : jours.length === 1
        ? `, le ${jours[0] === 1 ? "1ᵉʳ" : jours[0]} est férié`
        : `, ${jours.slice(0, -1).map((j) => (j === 1 ? "1ᵉʳ" : j)).join(", ")} et ${jours[jours.length - 1]} fériés`;
  return `${enCours ? "Mois en cours, " : ""}${ouvres} jours ouvrés${ferie}.`;
}
