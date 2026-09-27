import { Decimal } from "decimal.js";
import { chiffreCanonique } from "./chiffre-saisi";
import { MOIS_LONGS } from "./mois";
import { libelleNettoye } from "./prestations-entretien";

/**
 * LE CONTRAT D'ENTRETIEN : ses règles, et l'unique endroit où elles vivent.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **Sa demande du 26 septembre 2026**, planches `appli/contrat-d-entretien.html`
 * (128) et `appli/contrat-d-entretien-vert.html` (129, la retenue). Ses
 * réponses du même soir, et ce fichier les tient toutes :
 *
 * | | |
 * |---|---|
 * | une prestation | ses mois, son nombre de passages par mois (+ et −), son prix du passage HT |
 * | la période | un mois de début et une durée en mois, reconductible |
 * | la facturation | A (chaque mois le même montant) ou B (après chaque passage), au choix, B d'office |
 * | l'automatisme | en B seulement : la facture part AVEC le compte rendu, jamais à une date |
 * | le planning | les passages d'un mois arrivent dans « Sans date » le 20 du mois d'avant |
 *
 * **Une seule implémentation pour l'écran, l'enregistrement et le PDF**
 * (`CLAUDE.md` §3) : l'écran calcule ses totaux ici, le serveur revalide ici
 * ce qu'il reçoit, et le document les relit ici. Deux calculs du même montant
 * finissent toujours par diverger, et celui-ci décide de ce que le client paie.
 *
 * **`Decimal`, jamais les nombres du langage**, et un seul arrondi à la fin :
 * la même règle que `montant-de-ligne.ts`.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Un mois de calendrier, compté de 1 (janvier) à 12 (décembre), comme en base. */
export type MoisCalendrier = { annee: number; mois: number };

export type FacturationContrat = "passage" | "mois";

/** Au-delà, ce n'est plus un planning d'entretien : un mois compte 31 jours. */
export const MAX_PASSAGES_PAR_MOIS = 31;
/** Trois ans : la borne du compteur, pas une règle de métier. */
export const MAX_DUREE_MOIS = 36;
/** Au-delà, l'écran cesse d'être lisible au pouce, comme la fiche d'entretien. */
export const MAX_PRESTATIONS_CONTRAT = 30;
/** Le jour du mois d'AVANT où les passages arrivent dans « Sans date ». */
export const JOUR_D_ARRIVEE = 20;

/** Une prestation telle que le contrat la porte. */
export type PrestationContrat = {
  libelle: string;
  famille: string | null;
  /** Les mois où elle se fait, de 1 à 12, sans doublon, triés. */
  mois: number[];
  foisParMois: number;
  /** Le prix d'UN passage, HT, en chaîne décimale (« 45.00 »). NULL : à chiffrer. */
  prixPassageHt: string | null;
};

export type PeriodeContrat = {
  /** Le premier jour du premier mois, « 2027-03-01 ». */
  debut: string;
  dureeMois: number;
};

/** Le mois de début d'une période, lu sur sa date. */
function moisDeDebut(debut: string): MoisCalendrier {
  return { annee: Number(debut.slice(0, 4)), mois: Number(debut.slice(5, 7)) };
}

/**
 * Les mois de la période, dans l'ordre. Un contrat de 18 mois compte deux mai :
 * c'est ce qui fait qu'une durée ne se résume pas à « les mois cochés ».
 */
export function moisDeLaPeriode(periode: PeriodeContrat): MoisCalendrier[] {
  const depart = moisDeDebut(periode.debut);
  return Array.from({ length: periode.dureeMois }, (_, i) => {
    const n = depart.mois - 1 + i;
    return { annee: depart.annee + Math.floor(n / 12), mois: (n % 12) + 1 };
  });
}

function deuxChiffres(n: number): string {
  return String(n).padStart(2, "0");
}

/** Le dernier jour de la période, « 2028-02-29 » : le calendrier le donne, pas un calcul à la main. */
export function finDeLaPeriode(periode: PeriodeContrat): string {
  return dernierJourDuMois(moisDeLaPeriode(periode).at(-1) ?? moisDeDebut(periode.debut));
}

function jourEnLettres(iso: string): string {
  const jour = Number(iso.slice(8, 10));
  return `${jour === 1 ? "1er" : jour} ${MOIS_LONGS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
}

/** « Du 1er mars 2027 au 29 février 2028 » : ce que l'écran et le PDF écrivent. */
export function periodeEnLettres(periode: PeriodeContrat): string {
  return `Du ${jourEnLettres(periode.debut)} au ${jourEnLettres(finDeLaPeriode(periode))}`;
}

/** Combien de passages une prestation fait sur la période. */
export function passagesDeLaPrestation(p: PrestationContrat, periode: PeriodeContrat): number {
  return moisDeLaPeriode(periode).filter((m) => p.mois.includes(m.mois)).length * p.foisParMois;
}

/** Ce que pèse une prestation sur la période, HT. NULL tant que son prix manque. */
export function montantDeLaPrestation(p: PrestationContrat, periode: PeriodeContrat): string | null {
  const prix = chiffreCanonique(p.prixPassageHt);
  if (prix === null) return null;
  return new Decimal(prix).times(passagesDeLaPrestation(p, periode)).toFixed(2);
}

export type TotauxContrat = {
  passages: number;
  totalHt: string;
  totalTva: string;
  totalTtc: string;
};

/**
 * Les totaux du contrat. La TVA se calcule sur le total HT, une fois, comme
 * un devis à un seul taux : c'est ce que le PDF imprime, ligne par ligne.
 */
export function totauxDuContrat(
  prestations: readonly PrestationContrat[],
  periode: PeriodeContrat,
  tauxTva: string
): TotauxContrat {
  let passages = 0;
  let ht = new Decimal(0);
  for (const p of prestations) {
    passages += passagesDeLaPrestation(p, periode);
    const m = montantDeLaPrestation(p, periode);
    if (m !== null) ht = ht.plus(m);
  }
  const tva = ht.times(new Decimal(chiffreCanonique(tauxTva) ?? "0")).dividedBy(100).toDecimalPlaces(2);
  return {
    passages,
    totalHt: ht.toFixed(2),
    totalTva: tva.toFixed(2),
    totalTtc: ht.plus(tva).toFixed(2),
  };
}

/**
 * Facturation A : le montant en autant de mensualités que de mois, au
 * centime ; ce qui reste de l'arrondi va sur la DERNIÈRE, pour que la somme
 * retombe exactement sur le total. Le client relit la somme, jamais la
 * division.
 */
export function mensualites(total: string, dureeMois: number): { nombre: number; montant: string; derniere: string } {
  const t = new Decimal(total);
  const montant = t.dividedBy(dureeMois).toDecimalPlaces(2, Decimal.ROUND_DOWN);
  const derniere = t.minus(montant.times(dureeMois - 1));
  return { nombre: dureeMois, montant: montant.toFixed(2), derniere: derniere.toFixed(2) };
}

/**
 * Le jour où les passages d'un mois arrivent dans « Sans date » : le 20 du
 * mois d'AVANT. Sa réponse du 26 septembre 2026 : le 1er, ceux de la
 * première semaine arrivaient le jour même, sans qu'il ait pu l'organiser.
 */
export function jourDArrivee(m: MoisCalendrier): string {
  const avant = m.mois === 1 ? { annee: m.annee - 1, mois: 12 } : { annee: m.annee, mois: m.mois - 1 };
  return `${avant.annee}-${deuxChiffres(avant.mois)}-${JOUR_D_ARRIVEE}`;
}

function dernierJourDuMois(m: MoisCalendrier): string {
  const jour = new Date(Date.UTC(m.annee, m.mois, 0)).getUTCDate();
  return `${m.annee}-${deuxChiffres(m.mois)}-${deuxChiffres(jour)}`;
}

/** La clé d'un passage sur son chantier : « prestation-année-mois-rang ». */
export function clePassage(p: PassageDu): string {
  return `${p.prestation}-${p.annee}-${deuxChiffres(p.mois)}-${p.rang}`;
}

/** L'inverse de `clePassage` : la prestation, le mois et le rang. NULL si la clé ne se lit pas. */
export function lirePassage(cle: string): PassageDu | null {
  const m = /^(\d+)-(\d{4})-(\d{2})-(\d+)$/.exec(cle);
  if (!m) return null;
  return { prestation: Number(m[1]), annee: Number(m[2]), mois: Number(m[3]), rang: Number(m[4]) };
}

/**
 * LA LIGNE DE FACTURE D'UN PASSAGE (lot 2, facturation B) : sa prestation, au
 * prix du contrat. « Tonte et ébarbage, passage du 29 septembre 2026 » quand
 * le passage a son jour, « …, passage d'octobre 2026 » sinon.
 *
 * **Le prix est celui que le client a ACCEPTÉ** : c'est ce qui fait qu'une
 * facture de passage naît remplie, là où une facture sans devis naît vide.
 * NULL quand la clé ne désigne plus rien ou que le prix manque : on ne facture
 * pas un montant supposé (`CLAUDE.md` §4).
 */
export function ligneDuPassage(
  prestations: readonly PrestationContrat[],
  cle: string,
  jour: string | null
): { libelle: string; prixUnitaireHt: string } | null {
  const lu = lirePassage(cle);
  const p = lu ? prestations[lu.prestation] : undefined;
  if (!lu || !p || p.prixPassageHt === null) return null;
  const quand = jour
    ? `passage du ${jourEnLettres(jour)}`
    : `passage ${deOuD(MOIS_LONGS[lu.mois - 1])} ${lu.annee}`;
  return { libelle: `${p.libelle}, ${quand}`, prixUnitaireHt: p.prixPassageHt };
}

/** Ce qu'un passage coûtera au client, TTC : le montant PRÉVU que Terminés annonce. */
export function ttcDuPassage(prestations: readonly PrestationContrat[], cle: string, tauxTva: string): string | null {
  const ligne = ligneDuPassage(prestations, cle, null);
  if (!ligne) return null;
  const ht = new Decimal(ligne.prixUnitaireHt);
  const tva = ht.times(new Decimal(chiffreCanonique(tauxTva) ?? "0")).dividedBy(100).toDecimalPlaces(2);
  return ht.plus(tva).toFixed(2);
}

/** Un passage à poser : sa prestation, son mois, et son rang dans le mois. */
export type PassageDu = { prestation: number; annee: number; mois: number; rang: number };

/**
 * Les passages ARRIVÉS au jour dit : ceux des mois de la période dont le 20
 * du mois d'avant est passé. `prestation` est l'indice dans la liste.
 *
 * **Un mois déjà fini au jour de l'accord n'en donne aucun** (`accepteLe`) : un
 * contrat de mars accepté en juin ne doit pas déverser trois mois de tontes
 * passées dans « Sans date ». Mais un mois fini APRÈS l'accord garde les
 * siens, même si le planning n'a pas été ouvert entre-temps : un passage dû ne
 * disparaît pas parce que personne n'a regardé.
 *
 * **La clé (prestation, année, mois, rang) est ce qui rend la pose
 * idempotente** : la base la tient unique, si bien que rejouer l'arrivée
 * (deux ouvertures du planning, deux serveurs) ne pose jamais un passage deux
 * fois.
 */
export function passagesArrives(
  prestations: readonly PrestationContrat[],
  periode: PeriodeContrat,
  aujourdhui: string,
  accepteLe: string
): PassageDu[] {
  const dus: PassageDu[] = [];
  for (const m of moisDeLaPeriode(periode)) {
    if (jourDArrivee(m) > aujourdhui) continue;
    if (dernierJourDuMois(m) < accepteLe) continue;
    prestations.forEach((p, prestation) => {
      if (!p.mois.includes(m.mois)) return;
      for (let rang = 1; rang <= p.foisParMois; rang++) dus.push({ prestation, annee: m.annee, mois: m.mois, rang });
    });
  }
  return dus;
}

/** Ce qu'un écran envoie, avant toute relecture. */
export type ContratSaisi = {
  prestations: {
    libelle: string;
    famille?: string | null;
    mois: number[];
    foisParMois: number;
    prixPassageHt: string | null;
  }[];
  debut: string;
  dureeMois: number;
  reconduit: boolean;
  facturation: FacturationContrat;
  avecCompteRendu: boolean;
};

export type ContratRelu = {
  prestations: PrestationContrat[];
  periode: PeriodeContrat;
  reconduit: boolean;
  facturation: FacturationContrat;
  avecCompteRendu: boolean;
};

/**
 * Relit ce que l'écran envoie, et le REFUSE en le disant plutôt que de le
 * corriger en silence. Un brouillon peut porter des prix à chiffrer ; un
 * contrat qu'on envoie, non (`pretAPartir`).
 */
export function relireContrat(saisi: ContratSaisi): { ok: true; contrat: ContratRelu } | { ok: false; refus: string } {
  if (!/^\d{4}-\d{2}-01$/.test(saisi.debut)) return { ok: false, refus: "Le début du contrat se choisit sur un mois." };
  const moisDebut = Number(saisi.debut.slice(5, 7));
  if (moisDebut < 1 || moisDebut > 12) return { ok: false, refus: "Le début du contrat se choisit sur un mois." };
  if (!Number.isInteger(saisi.dureeMois) || saisi.dureeMois < 1 || saisi.dureeMois > MAX_DUREE_MOIS) {
    return { ok: false, refus: `La durée va de 1 à ${MAX_DUREE_MOIS} mois.` };
  }
  if (saisi.facturation !== "passage" && saisi.facturation !== "mois") {
    return { ok: false, refus: "Choisissez comment le contrat se facture." };
  }
  if (saisi.prestations.length > MAX_PRESTATIONS_CONTRAT) {
    return { ok: false, refus: `Un contrat porte au plus ${MAX_PRESTATIONS_CONTRAT} prestations.` };
  }
  const prestations: PrestationContrat[] = [];
  for (const brute of saisi.prestations) {
    const libelle = libelleNettoye(brute.libelle);
    if (libelle === null) return { ok: false, refus: "Une prestation n'a pas de nom." };
    const mois = [...new Set(brute.mois)].sort((a, b) => a - b);
    if (mois.some((m) => !Number.isInteger(m) || m < 1 || m > 12)) {
      return { ok: false, refus: `Les mois de « ${libelle} » ne se lisent pas.` };
    }
    if (!Number.isInteger(brute.foisParMois) || brute.foisParMois < 1 || brute.foisParMois > MAX_PASSAGES_PAR_MOIS) {
      return { ok: false, refus: `« ${libelle} » : de 1 à ${MAX_PASSAGES_PAR_MOIS} passages par mois.` };
    }
    let prix: string | null = null;
    if (brute.prixPassageHt !== null && String(brute.prixPassageHt).trim() !== "") {
      const lu = chiffreCanonique(brute.prixPassageHt);
      if (lu === null || new Decimal(lu).isNegative()) {
        return { ok: false, refus: `Le prix de « ${libelle} » ne se lit pas.` };
      }
      prix = new Decimal(lu).toFixed(2);
    }
    prestations.push({
      libelle,
      famille: libelleNettoye(brute.famille ?? null),
      mois,
      foisParMois: brute.foisParMois,
      prixPassageHt: prix,
    });
  }
  return {
    ok: true,
    contrat: {
      prestations,
      periode: { debut: saisi.debut, dureeMois: saisi.dureeMois },
      reconduit: Boolean(saisi.reconduit),
      facturation: saisi.facturation,
      // L'automatisme n'existe qu'en B : en A, la facture du mois ne dépend
      // d'aucun compte rendu, et garder l'interrupteur allumé ferait croire
      // qu'il agit.
      avecCompteRendu: saisi.facturation === "passage" && Boolean(saisi.avecCompteRendu),
    },
  };
}

/**
 * Ce qui manque pour ENVOYER, écrit avant l'appui (sa règle : « ce qui manque
 * est écrit avant l'appui, jamais après »). NULL : il peut partir.
 */
export function ceQuiManque(prestations: readonly PrestationContrat[], periode: PeriodeContrat): string | null {
  if (prestations.length === 0) return "Ajoutez une prestation.";
  const incompletes = prestations
    .filter((p) => passagesDeLaPrestation(p, periode) === 0 || p.prixPassageHt === null)
    .map((p) => p.libelle);
  return incompletes.length ? `À compléter : ${incompletes.join(", ")}.` : null;
}

/** La désignation d'une prestation sur le PDF : « Tonte et ébarbage, 2 passages par mois, d'avril à octobre ». */
export function designationSurLePapier(p: PrestationContrat): string {
  const noms = p.mois.map((m) => MOIS_LONGS[m - 1]);
  const quand =
    noms.length === 1
      ? `en ${noms[0]}`
      : estSuite(p.mois)
        ? `${deOuD(noms[0])} à ${noms.at(-1)}`
        : `en ${noms.slice(0, -1).join(", ")} et ${noms.at(-1)}`;
  const rythme = p.foisParMois === 1 ? "" : `, ${p.foisParMois} passages par mois`;
  return `${p.libelle}${rythme}, ${quand}`;
}

function estSuite(mois: readonly number[]): boolean {
  return mois.length > 2 && mois.every((m, i) => i === 0 || m === mois[i - 1] + 1);
}

/** « d'octobre », « de mars » : l'élision devant une voyelle. */
export function deOuD(mot: string): string {
  return /^[aeiouyéèêàâî]/i.test(mot) ? `d'${mot}` : `de ${mot}`;
}

