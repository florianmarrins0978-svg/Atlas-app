/**
 * LES HEURES DU RETOUR DU JOUR : le crédit d'impôt de ses clients, lot 2.
 *
 * Sa planche du 8 novembre 2026 (`appli/soignee/credit-d-impot.html`, écran
 * « Retour du jour ») : « Combien d'heures ? », une ligne par intervenant, deux
 * roulettes, « Pour l'attestation de Mr. X. » dessous. Ses règles, tranchées
 * dans `TODO.md` :
 *
 * | | |
 * |---|---|
 * | **quand** | LE JOUR de l'intervention, au retour : un chiffre tapé le soir même est juste, retrouvé huit mois plus tard il ne l'est pas (9 octobre 2026) |
 * | **qui** | les salariés cochés sur la demi-journée ; le patron seulement s'il n'a aucun salarié (*« le patron n'est pas sur le chantier »*) |
 * | **combien** | de 0 à 24 h, et les minutes une par une, de 00 à 59 (*« il faut pouvoir mettre n'importe quel nombre d'heures »*, 8 novembre 2026) |
 *
 * **Une seule règle pour l'écran et le serveur** (`CLAUDE.md` §3) : la liste
 * des intervenants que l'écran montre est celle que l'action accepte, et la
 * roulette qui s'arrête à 24 h 59 est la borne que le serveur relit.
 *
 * **Qui est sur le chantier ce jour-là ne se décide pas ici** : c'est la
 * lecture du planning des jours travaillés (`partsAuPlanning`), coches datées
 * ou non, absences comprises. Une seconde lecture aurait fini par dire autre
 * chose que la première : un salarié en congé ce matin-là taperait des heures
 * que son bulletin ne compte pas.
 */
import type { AbsenceEquipe } from "./absences-equipe";
import { avecCivilite, type CiviliteChoisie } from "./civilite";
import type { Creneau, JourIso } from "./disponibilites";
import { libelleSalarie, MAX_SALARIES } from "./equipes";
import { caseParDefaut, caseRetenue, NUMERO_DU_PATRON } from "./services-a-la-personne";
import { partsAuPlanning, type Coche } from "./zones-deplacement";

// ─── La durée ────────────────────────────────────────────────────────────────

/** 24 h 59 : la dernière valeur des deux roulettes. */
export const MINUTES_MAX = 24 * 60 + 59;

/** Les deux roulettes, une valeur par cran : 0 à 24 h, puis 00 à 59. */
export const HEURES_PROPOSEES: readonly number[] = Array.from({ length: 25 }, (_, i) => i);
export const MINUTES_PROPOSEES: readonly number[] = Array.from({ length: 60 }, (_, i) => i);

/** « 3 h » sur la roulette des heures. */
export function libelleHeures(heures: number): string {
  return `${heures} h`;
}

/** « 05 » sur la roulette des minutes : deux chiffres, comme une horloge. */
export function libelleMinutes(minutes: number): string {
  return String(minutes).padStart(2, "0");
}

/** Une durée en minutes, rendue aux deux roulettes. Hors bornes, elle se ramène à 0 h 00. */
export function enHeuresEtMinutes(total: number): { heures: number; minutes: number } {
  if (!Number.isInteger(total) || total < 0 || total > MINUTES_MAX) return { heures: 0, minutes: 0 };
  return { heures: Math.floor(total / 60), minutes: total % 60 };
}

/** Les deux roulettes, rendues en minutes, ou `null` si l'une sort de ses crans. */
export function minutesDe(heures: number, minutes: number): number | null {
  if (!Number.isInteger(heures) || heures < 0 || heures > 24) return null;
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 59) return null;
  return heures * 60 + minutes;
}

/**
 * « 2 h 30 », « 3 h », « 0 h 45 » : la durée telle que l'attestation l'écrit.
 * Les minutes en deux chiffres (« 2 h 05 ») : « 2 h 5 » se lit cinquante.
 */
export function dureeLisible(total: number): string {
  const { heures, minutes } = enHeuresEtMinutes(total);
  return minutes === 0 ? `${heures} h` : `${heures} h ${libelleMinutes(minutes)}`;
}

// ─── La case du chantier ─────────────────────────────────────────────────────

/**
 * Le chantier relève-t-il des services à la personne ? La case de SA pièce, et
 * la règle du lot 1 pour la retenir (`caseRetenue` : entreprise déclarée,
 * client particulier).
 *
 * **La pièce qui compte, dans l'ordre** : la facture si elle existe (c'est elle
 * que l'attestation lira), sinon la dernière version du devis, sinon la règle
 * d'une pièce neuve (`caseParDefaut`). Le dernier cas n'est pas un repli : un
 * passage d'entretien n'a jamais de devis, et c'est la prestation la plus
 * courante des services à la personne au jardin. Sa facture prendra justement
 * cette règle-là (`ARCHITECTURE.md` §570) : les heures se tapent donc pour la
 * case que la facture portera.
 */
export function caseDuChantier(p: {
  facture: boolean | null;
  devis: boolean | null;
  declaree: boolean;
  activiteACote: boolean;
  clientNom: string | null | undefined;
  clientCivilite?: CiviliteChoisie;
}): boolean {
  const situation = { declaree: p.declaree, clientNom: p.clientNom, clientCivilite: p.clientCivilite };
  const coche = p.facture !== null ? p.facture : p.devis !== null ? p.devis : caseParDefaut({ ...situation, activiteACote: p.activiteACote });
  return caseRetenue(coche, situation);
}

/** « Pour l'attestation de Mr. Lambert. » : le nom avec sa civilité, comme la case du devis. */
export function phrasePourLAttestation(clientNom: string | null | undefined, clientCivilite?: CiviliteChoisie): string {
  const qui = avecCivilite(clientNom, clientCivilite);
  return qui ? `Pour l'attestation de ${qui}.` : "Pour l'attestation du client.";
}

// ─── Qui tape ses heures ─────────────────────────────────────────────────────

/** Une ligne d'Équipe, telle que la base la porte. */
export type SalarieDeLEquipe = { rang: number; nom: string | null; numero: number | null };

/**
 * Une ligne de « Combien d'heures ? ».
 *
 * `nom` est ce qui est ÉCRIT (dans Équipe, ou le nom de son compte pour le
 * patron), `null` sinon : c'est lui qui part sur l'attestation. `libelle` est
 * ce que l'écran montre, repli compris (« Salarié 3 », « Vous ») : un repli
 * s'affiche, il ne s'imprime jamais sur un papier fiscal.
 */
export type IntervenantDuJour = { numero: number; nom: string | null; libelle: string };

/**
 * Les intervenants de ce chantier, ce jour-là.
 *
 * - **le chantier n'est pas posé ce jour-là** : personne. Pas d'intervention,
 *   pas d'heures ;
 * - **aucun salarié** : le patron, n° 0, seul intervenant possible ;
 * - **des salariés** : ceux que le planning met sur le chantier ce jour-là
 *   (`partsAuPlanning`), dans l'ordre des rangs. Le patron n'y est pas, sa
 *   règle du 9 octobre 2026. Un salarié sans numéro (entreprise en lecture
 *   seule, ligne jamais numérotée) n'a pas de ligne : une heure sans numéro ne
 *   servirait à aucune attestation.
 */
export function intervenantsDuJour(p: {
  jour: JourIso;
  chantier: { id: string; nom: string; creneaux: readonly Creneau[] };
  coches: readonly Coche[];
  absences: readonly (AbsenceEquipe & { rang: number })[];
  nombreSalaries: number;
  salaries: readonly SalarieDeLEquipe[];
  /** Le nom écrit du patron (`nomAffiche`), ou `null`. */
  patron: string | null;
}): IntervenantDuJour[] {
  if (!p.chantier.creneaux.some((c) => c.jour === p.jour)) return [];
  const nombre = Number.isFinite(p.nombreSalaries) ? Math.min(MAX_SALARIES, Math.max(0, Math.trunc(p.nombreSalaries))) : 0;
  if (nombre === 0) {
    const nom = p.patron?.trim() || null;
    return [{ numero: NUMERO_DU_PATRON, nom, libelle: nom ?? "Vous" }];
  }
  const pose = { id: p.chantier.id, nom: p.chantier.nom, adresse: null, position: null, creneaux: p.chantier.creneaux };
  const parRang = new Map(p.salaries.map((s) => [s.rang, s]));
  const intervenants: IntervenantDuJour[] = [];
  for (let rang = 1; rang <= nombre; rang++) {
    const siennes = p.absences.filter((a) => a.rang === rang);
    if (!partsAuPlanning(rang, [p.jour], [pose], p.coches, siennes).has(p.jour)) continue;
    const salarie = parRang.get(rang);
    if (!salarie || salarie.numero === null) continue;
    const nom = salarie.nom?.trim() || null;
    intervenants.push({ numero: salarie.numero, nom, libelle: libelleSalarie(salarie, nombre) ?? `Salarié ${rang}` });
  }
  return intervenants;
}

// ─── Ce que l'action reçoit ──────────────────────────────────────────────────

/** Ce qui part de l'écran : un numéro et une durée par ligne. */
export type HeuresSaisies = readonly { numero: number; minutes: number }[];

/** Ce qui s'écrit : la durée, et le nom tel qu'il est écrit ce jour-là. */
export type HeureAEcrire = { numero: number; nom: string | null; minutes: number };

/**
 * Les heures reçues, relues contre la liste du jour, ou le premier refus.
 *
 * **Rien n'est cru sur parole** : une action serveur se tape à la main. Un
 * numéro qui n'est pas sur le chantier ce jour-là est refusé (il n'aurait pas
 * dû paraître à l'écran), une durée hors des roulettes aussi. Un intervenant
 * absent de la saisie vaut zéro : ses heures du jour s'effacent.
 */
export function heuresRecues(
  saisie: unknown,
  permis: readonly IntervenantDuJour[]
): { ok: true; lignes: HeureAEcrire[] } | { ok: false; raison: string } {
  const illisible = { ok: false as const, raison: "Ces heures ne se lisent pas." };
  if (!Array.isArray(saisie) || saisie.length > permis.length) return illisible;
  const parNumero = new Map(permis.map((i) => [i.numero, i]));
  const vus = new Set<number>();
  const lignes: HeureAEcrire[] = [];
  for (const ligne of saisie as unknown[]) {
    if (typeof ligne !== "object" || ligne === null) return illisible;
    const { numero, minutes } = ligne as { numero?: unknown; minutes?: unknown };
    if (typeof numero !== "number" || !Number.isInteger(numero) || vus.has(numero)) return illisible;
    if (typeof minutes !== "number" || !Number.isInteger(minutes) || minutes < 0 || minutes > MINUTES_MAX) {
      return { ok: false, raison: "Une durée va de 0 h à 24 h 59." };
    }
    const intervenant = parNumero.get(numero);
    if (!intervenant) return { ok: false, raison: "La liste des intervenants a changé : rouvrez la fiche." };
    vus.add(numero);
    lignes.push({ numero, nom: intervenant.nom, minutes });
  }
  return { ok: true, lignes };
}
