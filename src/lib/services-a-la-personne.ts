/**
 * LE CRÉDIT D'IMPÔT DE SES CLIENTS : les services à la personne, lot 1.
 *
 * Sa planche du 8 novembre 2026 (`appli/soignee/credit-d-impot.html`), écrans
 * « Mon entreprise », « Le devis », « La facture ». Le crédit d'impôt de
 * l'article 199 sexdecies du CGI rend à un particulier la moitié de ce qu'il
 * paie, si l'entreprise est déclarée (NOVA) et si la pièce le dit.
 *
 * **Une seule règle pour l'écran et pour le serveur** (`CLAUDE.md` §3) : le
 * numéro qui se refuse à la saisie se refuse aussi à l'enregistrement, la case
 * qui ne paraît pas à l'écran ne s'imprime pas non plus, et la mention de
 * l'écran est celle du papier.
 *
 * **Ce que ce fichier ne calcule PAS, et c'est délibéré** : le plafond de
 * 5 000 € de dépenses par an du petit jardinage. Il se compte par foyer, sur
 * TOUTES ses dépenses de l'année, chez tous ses prestataires : Atlas n'en voit
 * qu'une partie, et un chiffre partiel présenté comme un plafond serait faux
 * (`docs/AGENT.md` §3).
 */
import Decimal from "decimal.js";
import { avecCivilite, categorieDuClient, type CiviliteChoisie } from "./civilite";
import { enEuros } from "./euros";
import { centimesDe, eurosEntiers } from "./franchise-plafond";
import { jourDeLettre } from "./jour";

// ─── Le numéro de déclaration ────────────────────────────────────────────────

/**
 * « SAP » et neuf chiffres (le SIREN), ou « SIR » et quatorze (le SIRET) pour
 * un organisme qui déclare par établissement, une coopérative comme Unipros.
 * La même forme que la contrainte de la base (`entreprises_sap_numero_ck`) et
 * que le motif de l'API de l'Urssaf (`ARCHITECTURE.md` §569).
 */
const MOTIF_NUMERO_SAP = /^(SAP\d{9}|SIR\d{14})$/;

/**
 * La saisie telle qu'elle se range : sans blancs, en capitales. Il le recopie
 * de NOVA, d'un courrier, d'un téléphone : « sap 123 456 789 » est le même
 * numéro que « SAP123456789 ».
 */
export function numeroSapSaisi(saisie: string): string {
  return saisie.replace(/\s+/g, "").toUpperCase();
}

export function numeroSapValide(numero: string | null | undefined): numero is string {
  return typeof numero === "string" && MOTIF_NUMERO_SAP.test(numero);
}

/**
 * Le refus d'un numéro saisi, ou `null`. **Une case vide n'est pas refusée** :
 * elle efface, et l'écran dit alors en ambre ce qui manque.
 */
export function refusDuNumeroSap(saisie: string): string | null {
  const propre = numeroSapSaisi(saisie);
  if (propre === "" || numeroSapValide(propre)) return null;
  return "Le numéro s'écrit SAP puis 9 chiffres, ou SIR puis 14 chiffres.";
}

// ─── La date de la déclaration ───────────────────────────────────────────────

const MOTIF_JOUR = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Le refus d'une date de déclaration (« AAAA-MM-JJ »), ou `null`. Vide : elle efface. */
export function refusDeLaDateDeDeclaration(saisie: string, aujourdHui: string): string | null {
  if (saisie === "") return null;
  const m = MOTIF_JOUR.exec(saisie);
  if (!m) return "Cette date ne se lit pas.";
  const [a, mois, j] = [Number(m[1]), Number(m[2]), Number(m[3])];
  // Sans `new Date(iso)` lu dans un fuseau : un jour est un jour (`jour.ts`).
  const date = new Date(Date.UTC(a, mois - 1, j));
  if (date.getUTCFullYear() !== a || date.getUTCMonth() !== mois - 1 || date.getUTCDate() !== j) {
    return "Cette date n'existe pas.";
  }
  if (saisie > aujourdHui) return "Une déclaration ne peut pas dater de demain.";
  return null;
}

// ─── Les réglages de Mon entreprise ──────────────────────────────────────────

export type ReglagesServicesALaPersonne = {
  declaree: boolean;
  numero: string | null;
  declareeLe: string | null;
  activiteACote: boolean;
};

/** Ce que l'écran envoie : seulement ce qui a changé. */
export type SaisieServicesALaPersonne = Partial<{
  declaree: boolean;
  numero: string;
  declareeLe: string;
  activiteACote: boolean;
}>;

/**
 * La saisie relue, champ par champ, ou le premier refus.
 *
 * **Rien n'est cru sur parole** : une action serveur se tape, et un
 * interrupteur qui reçoit « oui » au lieu de `true` se refuse plutôt que de
 * s'allumer par accident. Un champ absent n'est pas touché.
 */
export function saisieServicesALaPersonneLue(
  saisie: SaisieServicesALaPersonne,
  aujourdHui: string
): { ok: true; valeurs: Partial<ReglagesServicesALaPersonne> } | { ok: false; raison: string } {
  const valeurs: Partial<ReglagesServicesALaPersonne> = {};
  for (const cle of ["declaree", "activiteACote"] as const) {
    const v = saisie[cle];
    if (v === undefined) continue;
    if (typeof v !== "boolean") return { ok: false, raison: "Ce réglage ne se lit pas." };
    valeurs[cle] = v;
  }
  if (saisie.numero !== undefined) {
    if (typeof saisie.numero !== "string") return { ok: false, raison: "Ce numéro ne se lit pas." };
    const refus = refusDuNumeroSap(saisie.numero);
    if (refus) return { ok: false, raison: refus };
    const propre = numeroSapSaisi(saisie.numero);
    valeurs.numero = propre === "" ? null : propre;
  }
  if (saisie.declareeLe !== undefined) {
    if (typeof saisie.declareeLe !== "string") return { ok: false, raison: "Cette date ne se lit pas." };
    const date = saisie.declareeLe.trim();
    const refus = refusDeLaDateDeDeclaration(date, aujourdHui);
    if (refus) return { ok: false, raison: refus };
    valeurs.declareeLe = date === "" ? null : date;
  }
  return { ok: true, valeurs };
}

/**
 * Ce qui manque à une entreprise déclarée pour que ses papiers portent ce que
 * la loi attend : le numéro (sans lui, aucune mention) et le logo
 * (R7232-19). La date, elle, s'imprime quand elle est là. Éteinte, rien ne
 * manque : elle ne promet rien à personne.
 */
export function ceQuiManqueALaDeclaration(r: {
  declaree: boolean;
  numero: string | null;
  logoDepose: boolean;
}): { numero: boolean; logo: boolean } {
  if (!r.declaree) return { numero: false, logo: false };
  return { numero: !numeroSapValide(r.numero), logo: !r.logoDepose };
}

// ─── La case du devis et de la facture ───────────────────────────────────────

/** La situation qui décide si la case paraît : l'entreprise, et le client du document. */
export type SituationDeLaCase = {
  declaree: boolean;
  clientNom: string | null | undefined;
  clientCivilite?: CiviliteChoisie;
};

/**
 * La case existe-t-elle ? Une entreprise déclarée, et un client PARTICULIER :
 * le crédit d'impôt est celui d'un foyer, une entreprise ou une mairie n'en a
 * pas. « Particulier » est la catégorie des listes de clients
 * (`categorieDuClient`), la même partout.
 */
export function laCaseExiste(s: SituationDeLaCase): boolean {
  return s.declaree && categorieDuClient(s.clientNom, s.clientCivilite) === "particulier";
}

/**
 * La case d'un document NEUF : cochée quand elle existe et que l'entreprise
 * ne fait que des services à la personne. Avec une activité à côté, rien ne
 * dit si ce chantier-ci en relève : la case part décochée, et c'est lui qui la
 * coche. Un devis corrigé, lui, garde le choix de sa version d'avant.
 */
export function caseParDefaut(s: SituationDeLaCase & { activiteACote: boolean }): boolean {
  return laCaseExiste(s) && !s.activiteACote;
}

/**
 * La case qui COMPTE : cochée, et toujours permise. Une case cochée avant que
 * le client devienne une entreprise, ou que la déclaration s'éteigne, ne
 * promet plus rien : elle ne s'imprime pas, et l'écran ne la montre pas.
 */
export function caseRetenue(coche: boolean, s: SituationDeLaCase): boolean {
  return coche && laCaseExiste(s);
}

/**
 * Ce que le client récupère sur ses impôts : la moitié du TTC qu'il paie,
 * **arrondie au centime inférieur**. Écrire un centime de trop serait
 * promettre ce que l'administration ne rendra pas.
 */
export function creditDImpot(totalTtc: string): string {
  const total = new Decimal(totalTtc);
  if (!total.isFinite() || total.isNegative()) return "0.00";
  return total.div(2).toDecimalPlaces(2, Decimal.ROUND_DOWN).toFixed(2);
}

/**
 * La ligne sous la case : « Mr. Lambert récupère 252,00 € sur ses impôts »,
 * ou « Devis normal » et « Facture normale ». Le nom avec sa civilité, comme
 * partout (`avecCivilite`) ; sans nom, « Votre client ».
 */
export function phraseSousLaCase(p: {
  coche: boolean;
  genre: "devis" | "facture";
  clientNom: string | null | undefined;
  clientCivilite?: CiviliteChoisie;
  totalTtc: string;
}): string {
  if (!p.coche) return p.genre === "devis" ? "Devis normal" : "Facture normale";
  const qui = avecCivilite(p.clientNom, p.clientCivilite) || "Votre client";
  return `${qui} récupère ${enEuros(creditDImpot(p.totalTtc))} sur ses impôts`;
}

// ─── Ce que le papier porte ──────────────────────────────────────────────────

export const MENTION_CREDIT_D_IMPOT =
  "Prestation de services à la personne ouvrant droit au crédit d'impôt de " +
  "l'article 199 sexdecies du code général des impôts.";

/**
 * La mention entière, la date en toutes lettres comme sur une lettre
 * (`jourDeLettre`). Sans date, la phrase s'arrête au numéro : une date absente
 * ne s'invente pas.
 */
export function mentionServicesALaPersonne(numero: string, declareeLe: string | null): string {
  const date = declareeLe ? ` du ${jourDeLettre(declareeLe)}` : "";
  return `${MENTION_CREDIT_D_IMPOT} Déclaration ${numero}${date}.`;
}

/**
 * La mention qu'une pièce imprime, ou `null` : la case retenue ET un numéro
 * valide. **Le numéro commande**, comme le nom de l'assureur pour la
 * décennale : une mention sans numéro ne se vérifie pas, et ne prouve rien.
 */
export function mentionSurLePapier(
  p: SituationDeLaCase & { coche: boolean; numero: string | null; declareeLe: string | null }
): string | null {
  if (!caseRetenue(p.coche, p) || !numeroSapValide(p.numero)) return null;
  return mentionServicesALaPersonne(p.numero, p.declareeLe);
}

// ─── L'activité à côté ───────────────────────────────────────────────────────

/**
 * Le plafond de l'activité hors services à la personne : 30 % du chiffre
 * d'affaires HT de l'année civile (décret n° 2024-851, FAQ et fascicule 2026
 * de servicesalapersonne.gouv.fr, lus le 9 octobre 2026, `TODO.md`).
 */
export const PART_HORS_SAP_MAX = 30;

/** Ce que la base rend pour une année civile : des sommes HT en chaîne décimale. */
export type ChiffresDeLActiviteACote = {
  annee: number;
  factures: { toutes: string; horsSap: string };
  avoirs: { tous: string; horsSap: string };
};

export type CompteDeLActiviteACote = {
  annee: number;
  horsSapCentimes: number;
  totalCentimes: number;
  /** La part hors services à la personne, en pour cent, arrondie VERS LE HAUT. */
  pourcent: number;
  /** La jauge, de 0 à 100 : la part rapportée aux 30 %. */
  jauge: number;
  depasse: boolean;
};

/**
 * Le compte de l'année : le HT des factures SANS la case, divisé par le HT de
 * toutes, avoirs déduits chacun du côté de sa facture.
 *
 * **Facturé, pas encaissé.** Le décret parle de chiffre d'affaires, et la
 * question « facturé ou encaissé » reste ouverte (`TODO.md`) : Atlas compte
 * ses pièces comme pour le plafond de la franchise, par l'année de la pièce.
 * Les pièces IMPORTÉES ne comptent pas : rien ne dit de quel côté elles sont.
 *
 * **La part s'arrondit vers le haut**, le côté sûr : 30,01 % s'écrit 31 %, et
 * le chiffre écrit dépasse 30 exactement quand le plafond est dépassé. Un
 * total négatif (un avoir de janvier sur une facture de décembre) se lit
 * zéro : une part d'un chiffre négatif ne veut rien dire.
 */
export function compterLActiviteACote(c: ChiffresDeLActiviteACote): CompteDeLActiviteACote {
  const total = Math.max(0, centimesDe(c.factures.toutes) - centimesDe(c.avoirs.tous));
  const hors = Math.min(total, Math.max(0, centimesDe(c.factures.horsSap) - centimesDe(c.avoirs.horsSap)));
  const pourcent = total === 0 ? 0 : Math.ceil((hors * 100) / total);
  return {
    annee: c.annee,
    horsSapCentimes: hors,
    totalCentimes: total,
    pourcent,
    jauge: Math.min(100, Math.round((pourcent * 100) / PART_HORS_SAP_MAX)),
    // En entiers, sans division : `hors × 100 > total × 30`.
    depasse: hors * 100 > total * PART_HORS_SAP_MAX,
  };
}

/** « 6 120 € sur 34 000 € cette année » : les deux montants, pour se recomposer à la main. */
export function phraseDuCompte(compte: CompteDeLActiviteACote): string {
  return `${eurosEntiers(compte.horsSapCentimes)} sur ${eurosEntiers(compte.totalCentimes)} cette année`;
}

// ─── Le numéro d'intervenant ─────────────────────────────────────────────────

/** Le patron : n° 0, qu'il ait des salariés ou qu'il travaille seul. */
export const NUMERO_DU_PATRON = 0;

/** « n° 3 » : le numéro tel qu'Équipe et l'attestation l'écrivent. */
export function libelleNumeroIntervenant(numero: number): string {
  return `n° ${numero}`;
}
