import { auJourParHomme } from "./tarif-main-oeuvre";
import { tarifsCorrespondants } from "./tarifs-correspondants";

/**
 * VOS PRIX, dans Mon année : ce que rapporte une journée d'équipe, tarif par
 * tarif, face à ce qu'il en faut pour l'objectif ; et la part des devis signés.
 * Sa planche du 8 novembre 2026 (`appli/soignee/mon-annee.html`).
 *
 * **Rangé par SES tarifs** (Réglages, Tarifs & catalogue), jamais par une
 * liste de métiers : sa question du même jour, *« si c'est un électricien et
 * qu'il a marqué tableau électrique, la nomenclature va changer ? »*.
 *
 * **Le tarif d'une ligne se lit sur son libellé, par `tarifsCorrespondants`**,
 * la règle même du chiffrage (une ligne née d'un tarif porte son intitulé).
 * Une ligne qui répond à plusieurs tarifs, ou à aucun, n'est à personne :
 * rien ne se devine. Ce qui a été écarté, et pourquoi : faire retenir le
 * tarif à la naissance de chaque ligne demandait de toucher le moteur de
 * chiffrage à cinq endroits, et n'aurait rangé que les devis à venir ; la
 * lecture du libellé range aussi tout l'historique.
 *
 * **Un conseil est un compte, jamais un prix proposé** (`docs/AGENT.md` §3) :
 * l'appli montre, il décide.
 *
 * En centimes entiers, comme `mon-annee.ts`.
 */

export type TarifPourPrix = { id: string; intitule: string; prix: string; unite: string | null };

export type LignePourPrix = { libelle: string; centimes: number; mainDoeuvre: boolean };

export type ChantierPourPrix = {
  lignes: LignePourPrix[];
  /** Le HT de sa facture ÉMISE dans l'année, ou `null` : pas encore facturé cette année. */
  factureHt: number | null;
  /** La durée réservée au planning, en demi-journées ; `null` : pas posée. */
  demiJournees: number | null;
  /** La réponse à son DERNIER devis envoyé dans l'année ; `undefined` : aucun envoi. */
  reponse?: "acceptee" | "refusee" | "correction" | null;
};

export type PrixDuTarif = {
  tarifId: string;
  intitule: string;
  /** Les chantiers facturés dans l'année dont ce tarif fait plus de la moitié. */
  chantiers: number;
  /** Leur HT facturé, en centimes. */
  facture: number;
  /** Ce que rapporte une journée d'équipe ; `null` sans un chantier dont la durée est posée. */
  parJournee: number | null;
  signes: number;
  envoyes: number;
};

/** Les tarifs qui rangent : pas celui de la main d'œuvre au jour, qui va avec tous les travaux. */
function tarifsDeTravaux(tarifs: readonly TarifPourPrix[]): TarifPourPrix[] {
  return tarifs.filter((t) => t.intitule.trim() !== "" && !auJourParHomme(t.unite));
}

/** Le tarif d'une ligne : le seul qui réponde à son libellé, sinon personne. */
export function tarifDeLaLigne(libelle: string, tarifs: readonly TarifPourPrix[]): string | null {
  const trouves = tarifsCorrespondants(tarifsDeTravaux(tarifs), [libelle]);
  return trouves.length === 1 ? trouves[0].tarifId : null;
}

/**
 * Le tarif d'un chantier : celui qui fait PLUS de la moitié de son montant,
 * main d'œuvre comprise dans le total. Sinon aucun : un chantier partagé
 * entre trois travaux ne dit rien du prix de l'un d'eux.
 */
export function tarifDuChantier(lignes: readonly LignePourPrix[], tarifs: readonly TarifPourPrix[]): string | null {
  const total = lignes.reduce((t, l) => t + Math.max(0, l.centimes), 0);
  if (total <= 0) return null;
  const parTarif = new Map<string, number>();
  for (const l of lignes) {
    if (l.mainDoeuvre) continue;
    const id = tarifDeLaLigne(l.libelle, tarifs);
    if (id) parTarif.set(id, (parTarif.get(id) ?? 0) + Math.max(0, l.centimes));
  }
  for (const [id, c] of parTarif) if (c * 2 > total) return id;
  return null;
}

export function prixParTarif(chantiers: readonly ChantierPourPrix[], tarifs: readonly TarifPourPrix[]): PrixDuTarif[] {
  const acc = new Map<string, PrixDuTarif & { demiJournees: number; factureAvecDuree: number }>();
  const intitules = new Map(tarifs.map((t) => [t.id, t.intitule.trim()]));
  for (const c of chantiers) {
    const id = tarifDuChantier(c.lignes, tarifs);
    if (!id) continue;
    let p = acc.get(id);
    if (!p) {
      p = { tarifId: id, intitule: intitules.get(id) ?? "", chantiers: 0, facture: 0, parJournee: null, signes: 0, envoyes: 0, demiJournees: 0, factureAvecDuree: 0 };
      acc.set(id, p);
    }
    if (c.factureHt !== null) {
      p.chantiers++;
      p.facture += c.factureHt;
      if (c.demiJournees && c.demiJournees > 0) {
        p.demiJournees += c.demiJournees;
        p.factureAvecDuree += c.factureHt;
      }
    }
    if (c.reponse !== undefined) {
      p.envoyes++;
      if (c.reponse === "acceptee") p.signes++;
    }
  }
  return [...acc.values()]
    .map(({ demiJournees, factureAvecDuree, ...p }) => ({
      ...p,
      parJournee: demiJournees > 0 ? Math.round((factureAvecDuree * 2) / demiJournees) : null,
    }))
    .sort((a, b) => b.facture - a.facture || a.intitule.localeCompare(b.intitule));
}

/**
 * Ce qu'une journée d'équipe doit rapporter pour l'objectif : l'objectif sur
 * les jours ouvrés de l'année, fois ses équipes. `null` sans objectif.
 */
export function parJourneeNecessaire(objectif: number | null, joursOuvresAnnee: number, equipes: number): number | null {
  if (objectif === null || joursOuvresAnnee <= 0 || equipes <= 0) return null;
  return Math.round(objectif / (joursOuvresAnnee * equipes));
}

/** Presque tous signés, c'est souvent un prix trop bas : 90 %, sur huit envois au moins. */
export const PART_PRESQUE_TOUT = 0.9;
export const ENVOIS_POUR_CONCLURE = 8;

export function presqueToutSigne(p: PrixDuTarif): boolean {
  return p.envoyes >= ENVOIS_POUR_CONCLURE && p.signes >= p.envoyes * PART_PRESQUE_TOUT;
}

export type ConseilsDePrix = {
  /** Le tarif qui rapporte le moins par journée, sous ce qu'il en faut. */
  bas: PrixDuTarif | null;
  /** Parmi les AUTRES, celui dont presque tous les devis sont signés. */
  signe: PrixDuTarif | null;
};

/**
 * Deux conseils au plus, ceux de la planche. Quand les deux signaux tombent
 * sur le même tarif, ils se disent ensemble sur lui (l'écran le lit par
 * `presqueToutSigne`) : c'est le cas le plus net d'un prix trop bas.
 */
export function conseilsDePrix(prix: readonly PrixDuTarif[], parJournee: number | null): ConseilsDePrix {
  const bas =
    parJournee === null
      ? null
      : ([...prix].filter((p) => p.parJournee !== null && p.parJournee < parJournee).sort((a, b) => a.parJournee! - b.parJournee!)[0] ?? null);
  const signe =
    [...prix].filter((p) => p !== bas && presqueToutSigne(p)).sort((a, b) => b.signes / b.envoyes - a.signes / a.envoyes)[0] ?? null;
  return { bas, signe };
}

/** Dix pour cent plus cher, au même nombre de chantiers : ce que ça rapporterait sur l'année. */
export function dixPourCentDePlus(p: PrixDuTarif): number {
  return Math.round(p.facture / 10);
}
