/**
 * LE PLAFOND DE LA FRANCHISE EN BASE DE TVA : le compte de l'année, et ce
 * qu'il dit.
 *
 * Sa planche du 5 novembre 2026 (`appli/soignee/franchise-plafond.html`), A ET
 * B le 6 novembre : *« j'ai l'impression qu'il faut la A et la B »*. Un artisan
 * en franchise qui passe le plafond doit facturer la TVA ; Atlas a toutes ses
 * factures, et ne comptait rien.
 *
 * **Un seul calcul pour tous les chiffres** (`CLAUDE.md` §3) : la ligne de
 * Terminés, le compteur de Votre TVA, la feuille du compte ET l'arrêt de la
 * facture lisent ce fichier. La facture qui part refait le compte avec la
 * même fonction que l'écran qui l'annonce.
 *
 * Tout se compte en CENTIMES entiers : additionner des `Number` en euros rend
 * « 41249.999 », et c'est exactement à la frontière qu'on lit ce chiffre.
 */
import Decimal from "decimal.js";
import { enEurosEntiers } from "./euros";

/**
 * Les plafonds des PRESTATIONS DE SERVICES, article 293 B du CGI, lus le
 * 6 novembre 2026 :
 *   BOFiP, BOI-TVA-DECLA-40-10-10, version du 1er juillet 2026, dont l'exemple
 *   de 2026 : 37 500 € l'année d'avant, 41 250 € l'année en cours ; passé
 *   41 250 €, la franchise est perdue « à compter de la date à laquelle
 *   intervient ce dépassement » ; entre les deux, elle est gardée toute
 *   l'année et perdue au 1er janvier suivant ;
 *   impots.gouv.fr, « Les régimes d'imposition à la TVA » : 85 000 € et
 *   93 500 € pour les ventes, 37 500 € et 41 250 € pour les services ;
 *   loi n° 2025-1044 du 3 novembre 2025 (BOFiP ACTU-2025-00144) : le seuil
 *   unique de 25 000 € est abandonné, les seuils sont maintenus.
 *
 * **Pourquoi les SERVICES seulement.** L'appli ne sait pas quelle ligne est
 * une vente et laquelle un service. Comparer tout le chiffre au plafond des
 * services prévient tôt une activité mixte, jamais tard : le plafond le plus
 * bas est le côté sûr. Un artisan qui vend surtout des végétaux verra la ligne
 * plus tôt que nécessaire, et la feuille dit de quel plafond il s'agit.
 *
 * Ils sont révisés tous les trois ans : à relire à chaque loi de finances.
 */
export const PLAFOND_CENTIMES = 3_750_000;
export const PLAFOND_MAJORE_CENTIMES = 4_125_000;
/** La ligne de Terminés parle à partir de 80 % du plafond : muette avant. */
export const PART_QUI_PREVIENT = 80;

/** Ce que la base rend pour une année civile : des sommes décimales en chaîne. */
export type ChiffresDeLAnnee = {
  annee: number;
  factures: { nombre: number; totalHt: string };
  /** Les factures IMPORTÉES (migration 0136) : leur montant total, sans TVA en franchise. */
  importees: { nombre: number; total: string };
  avoirs: { nombre: number; totalHt: string };
};

export type EtatDuPlafond = "loin" | "proche" | "passe" | "majore_passe";

export type CompteDeLaFranchise = {
  annee: number;
  factures: { nombre: number; centimes: number };
  importees: { nombre: number; centimes: number };
  avoirs: { nombre: number; centimes: number };
  totalCentimes: number;
  etat: EtatDuPlafond;
  /** La part du plafond, de 0 à 100, arrondie vers le bas : la jauge ne dit jamais plein avant de l'être. */
  pourcent: number;
};

/** « 12345.67 » en 1 234 567 centimes. Un montant illisible n'est pas zéro : il arrête le compte. */
export function centimesDe(montant: string): number {
  const d = new Decimal(montant);
  const c = d.times(100);
  if (!c.isInteger()) throw new Error(`Montant au-delà du centime : « ${montant} ».`);
  return c.toNumber();
}

/**
 * Où en est un total, face aux deux plafonds.
 *
 * Le plafond se DÉPASSE : 37 500,00 € tout juste n'est pas passé, un centime
 * de plus l'est. Même règle au plafond majoré.
 */
export function etatDuPlafond(totalCentimes: number): EtatDuPlafond {
  if (totalCentimes > PLAFOND_MAJORE_CENTIMES) return "majore_passe";
  if (totalCentimes > PLAFOND_CENTIMES) return "passe";
  // 80 % se compare en entiers : `total × 100 ≥ plafond × 80`, sans division.
  if (totalCentimes * 100 >= PLAFOND_CENTIMES * PART_QUI_PREVIENT) return "proche";
  return "loin";
}

/** Le compte de l'année : factures envoyées, plus les importées, moins les avoirs. */
export function compterLaFranchise(c: ChiffresDeLAnnee): CompteDeLaFranchise {
  const factures = centimesDe(c.factures.totalHt);
  const importees = centimesDe(c.importees.total);
  const avoirs = centimesDe(c.avoirs.totalHt);
  const total = factures + importees - avoirs;
  return {
    annee: c.annee,
    factures: { nombre: c.factures.nombre, centimes: factures },
    importees: { nombre: c.importees.nombre, centimes: importees },
    avoirs: { nombre: c.avoirs.nombre, centimes: avoirs },
    totalCentimes: total,
    etat: etatDuPlafond(total),
    pourcent: Math.max(0, Math.min(100, Math.floor((total * 100) / PLAFOND_CENTIMES))),
  };
}

/** La ligne de Terminés (A) : rien tant qu'on est loin, une ligne de plus toute l'année ne se lit plus. */
export function ligneSurTermines(compte: CompteDeLaFranchise): boolean {
  return compte.etat !== "loin";
}

/** Le ton d'un compte : l'or loin du plafond, l'ambre tout près, le rouge passé. */
export function tonDuCompte(compte: CompteDeLaFranchise): "or" | "ambre" | "rouge" {
  if (compte.etat === "loin") return "or";
  if (compte.etat === "proche") return "ambre";
  return "rouge";
}

/** Des centimes en euros entiers, arrondis vers le bas : « 33 200 € », jamais un plafond atteint avant de l'être. */
export function eurosEntiers(centimes: number): string {
  return enEurosEntiers(Math.floor(centimes / 100));
}

/**
 * La phrase sous le compte, ses mots tels que la planche les porte.
 *
 * Passé le plafond, l'année suivante relève du comptable : la planche validée
 * le renvoie à lui, et c'est lui qui connaît l'activité entière.
 */
export function phraseDuCompte(compte: CompteDeLaFranchise): { ton: "or" | "ambre" | "rouge"; texte: string } {
  const ton = tonDuCompte(compte);
  if (compte.etat === "loin" || compte.etat === "proche") {
    return { ton, texte: `Encore ${eurosEntiers(PLAFOND_CENTIMES - compte.totalCentimes)} avant ${eurosEntiers(PLAFOND_CENTIMES)}.` };
  }
  if (compte.etat === "passe") {
    return {
      ton,
      texte:
        `Encore ${eurosEntiers(PLAFOND_MAJORE_CENTIMES - compte.totalCentimes)} avant ${eurosEntiers(PLAFOND_MAJORE_CENTIMES)}. ` +
        `Votre comptable vous dit ce que ça change pour ${compte.annee + 1}.`,
    };
  }
  return {
    ton,
    texte:
      `Plafond majoré passé de ${eurosEntiers(compte.totalCentimes - PLAFOND_MAJORE_CENTIMES)}. ` +
      "Votre comptable vous dit si la TVA est due.",
  };
}

/** Ce que l'arrêt de la facture montre : le total de l'année avec elle, et ce qu'il était avant. */
export type ArretDuPlafond = {
  compte: CompteDeLaFranchise;
  factureCentimes: number;
  avecElleCentimes: number;
  /** Vrai quand le plafond majoré était passé AVANT elle : l'arrêt ne dit plus « cette facture le passe ». */
  dejaPasse: boolean;
};

/**
 * Cette facture fait-elle passer le plafond majoré ?
 *
 * `null` : elle part comme aujourd'hui. Sinon, l'envoi s'arrête et DEMANDE :
 * il ne bloque pas (« L'envoyer sans TVA » reste un geste à lui). Le plafond de
 * base ne l'arrête pas : passé lui seul, la franchise tient jusqu'au 31 décembre.
 */
export function arretDeLaFacture(compte: CompteDeLaFranchise, factureTotalHt: string): ArretDuPlafond | null {
  const facture = centimesDe(factureTotalHt);
  const avecElle = compte.totalCentimes + facture;
  if (avecElle <= PLAFOND_MAJORE_CENTIMES) return null;
  return {
    compte,
    factureCentimes: facture,
    avecElleCentimes: avecElle,
    dejaPasse: compte.totalCentimes > PLAFOND_MAJORE_CENTIMES,
  };
}
