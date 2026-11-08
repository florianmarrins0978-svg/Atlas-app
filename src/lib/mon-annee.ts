import { feriesDeLAnnee } from "./jours-feries";

/**
 * MON ANNÉE : l'objectif de l'année, sa saison, et l'an dernier au même jour.
 *
 * Sa planche du 8 novembre 2026 (`appli/soignee/mon-annee.html`), puis son
 * « tu peux coder ça » du même jour. Des règles pures : la base lit, ces
 * fonctions décident, l'écran montre (`CLAUDE.md` §3).
 *
 * **Tout se compte en CENTIMES entiers** : additionner des euros en `Number`
 * rend « 41249.999 », et c'est à l'écart près qu'on lit ces chiffres.
 *
 * **Les jours sont des chaînes « AAAA-MM-JJ »**, comme partout dans le dépôt
 * (`jourIso`) : comparées en chaîne, elles se rangent dans l'ordre.
 *
 * Ses règles, toutes dites sur la planche :
 *
 *   · **le rythme suit SA saison** : la part de chaque mois dans l'an dernier.
 *     À parts égales, un paysagiste serait « en retard » tout l'hiver et « en
 *     avance » tout le printemps. Sans an dernier dans l'appli, ni trait ni
 *     retard : rien ne s'invente (`docs/AGENT.md` §3) ;
 *   · **face à l'an dernier, le jour même, puis du 1er à aujourd'hui** (sa
 *     correction du 8 novembre : *« si on est le 8 novembre, je veux savoir ce
 *     que j'ai fait le 8 novembre de l'année dernière. Et ensuite le mois en
 *     cours »*). Le mois en cours se compare AU MÊME JOUR : huit jours contre
 *     tout novembre, chaque début de mois paraîtrait en retard ;
 *   · **le bénéfice ne se compte qu'avec toutes les dépenses** : la banque
 *     reliée, jamais les seuls tickets, qui oublient salaires et loyer.
 */

export type JourIso = string;

/** Une pièce qui fait le chiffre d'affaires : une facture (+), un avoir (−). En HT. */
export type Piece = { jour: JourIso; centimes: number };

export const NOMS_DES_MOIS = [
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
] as const;

// ─── Le calendrier ──────────────────────────────────────────────────────────

function enUtc(jour: JourIso): number {
  const [a, m, j] = jour.split("-").map(Number);
  return Date.UTC(a, m - 1, j);
}

function depuisUtc(t: number): JourIso {
  return new Date(t).toISOString().slice(0, 10);
}

const UN_JOUR = 86_400_000;

export function anneeDe(jour: JourIso): number {
  return Number(jour.slice(0, 4));
}

/** Le mois d'un jour, de 0 (janvier) à 11. */
export function moisDe(jour: JourIso): number {
  return Number(jour.slice(5, 7)) - 1;
}

export function quantiemeDe(jour: JourIso): number {
  return Number(jour.slice(8, 10));
}

export function premierDuMois(annee: number, mois: number): JourIso {
  return depuisUtc(Date.UTC(annee, mois, 1));
}

export function dernierDuMois(annee: number, mois: number): JourIso {
  return depuisUtc(Date.UTC(annee, mois + 1, 0));
}

/**
 * Le même jour, l'an dernier. **Le 29 février tombe le 28** : un jour qui
 * n'existe pas l'année d'avant ne se compare pas au 1er mars, qui est un autre
 * mois.
 */
export function memeJourAnDernier(jour: JourIso): JourIso {
  const annee = anneeDe(jour) - 1;
  const mois = moisDe(jour);
  const fin = quantiemeDe(dernierDuMois(annee, mois));
  return depuisUtc(Date.UTC(annee, mois, Math.min(quantiemeDe(jour), fin)));
}

/**
 * Un jour ouvré : du lundi au vendredi, fériés retirés — comme le planning et
 * les jours travaillés (`src/lib/jours-travailles.ts`).
 */
export function joursOuvres(du: JourIso, au: JourIso, alsaceMoselle = false): number {
  if (au < du) return 0;
  const feries = new Map<number, ReadonlyMap<string, string>>();
  let n = 0;
  for (let t = enUtc(du); t <= enUtc(au); t += UN_JOUR) {
    const semaine = new Date(t).getUTCDay();
    if (semaine === 0 || semaine === 6) continue;
    const jour = depuisUtc(t);
    const a = anneeDe(jour);
    if (!feries.has(a)) feries.set(a, feriesDeLAnnee(a, alsaceMoselle));
    if (feries.get(a)!.has(jour)) continue;
    n++;
  }
  return n;
}

// ─── Les sommes ─────────────────────────────────────────────────────────────

/** Ce qui a été facturé entre deux jours, bornes comprises. */
export function totalEntre(pieces: readonly Piece[], du: JourIso, au: JourIso): number {
  let total = 0;
  for (const p of pieces) if (p.jour >= du && p.jour <= au) total += p.centimes;
  return total;
}

/** Les douze mois d'une année. */
export function totalParMois(pieces: readonly Piece[], annee: number): number[] {
  const mois = Array.from({ length: 12 }, () => 0);
  for (const p of pieces) if (anneeDe(p.jour) === annee) mois[moisDe(p.jour)] += p.centimes;
  return mois;
}

// ─── Face à l'an dernier ────────────────────────────────────────────────────

export type Comparaison = { cetteAnnee: number; anDernier: number };

export type MoisCompare = Comparaison & {
  mois: number;
  /** Le mois en cours : comparé du 1er au même jour, et non au mois entier. */
  jusquAu: number | null;
};

export type FaceAnDernier = {
  leJour: Comparaison;
  /** `null` le 1er du mois : le jour même dit déjà tout. */
  duPremier: Comparaison | null;
  /** De janvier au mois en cours, le plus récent en premier : c'est lui qu'on vient lire. */
  mois: MoisCompare[];
};

export function faceAnDernier(pieces: readonly Piece[], aujourdHui: JourIso): FaceAnDernier {
  const annee = anneeDe(aujourdHui);
  const mois = moisDe(aujourdHui);
  const jour = quantiemeDe(aujourdHui);
  const avant = memeJourAnDernier(aujourdHui);
  const leJour = { cetteAnnee: totalEntre(pieces, aujourdHui, aujourdHui), anDernier: totalEntre(pieces, avant, avant) };
  const duPremier =
    jour === 1
      ? null
      : {
          cetteAnnee: totalEntre(pieces, premierDuMois(annee, mois), aujourdHui),
          anDernier: totalEntre(pieces, premierDuMois(annee - 1, mois), avant),
        };
  const liste: MoisCompare[] = [];
  for (let m = mois; m >= 0; m--) {
    const enCours = m === mois && aujourdHui !== dernierDuMois(annee, mois);
    liste.push({
      mois: m,
      jusquAu: enCours ? jour : null,
      cetteAnnee: totalEntre(pieces, premierDuMois(annee, m), enCours ? aujourdHui : dernierDuMois(annee, m)),
      anDernier: totalEntre(pieces, premierDuMois(annee - 1, m), enCours ? avant : dernierDuMois(annee - 1, m)),
    });
  }
  return { leJour, duPremier, mois: liste };
}

/** Le sens d'un écart, au CENTIME : « pareil » ne se dit que de deux montants égaux. */
export function sensDeLEcart(c: Comparaison): "plus" | "moins" | "pareil" {
  if (c.cetteAnnee > c.anDernier) return "plus";
  if (c.cetteAnnee < c.anDernier) return "moins";
  return "pareil";
}

// ─── La saison et le trait ──────────────────────────────────────────────────

/**
 * La part de chaque mois dans l'an dernier, de 0 à 1. **`null` sans an
 * dernier** — rien de facturé, ou plus d'avoirs que de factures : une saison
 * qui ne se lit pas ne se devine pas.
 */
export function saisonDe(moisAnDernier: readonly number[]): number[] | null {
  if (moisAnDernier.length !== 12 || moisAnDernier.some((c) => c < 0)) return null;
  const total = moisAnDernier.reduce((t, c) => t + c, 0);
  if (total <= 0) return null;
  return moisAnDernier.map((c) => c / total);
}

/**
 * La part de l'année que la saison avait faite à ce jour : les mois passés en
 * entier, le mois en cours au prorata de ses jours ouvrés.
 */
export function partDeLAnneeFaite(aujourdHui: JourIso, saison: readonly number[], alsaceMoselle = false): number {
  const annee = anneeDe(aujourdHui);
  const mois = moisDe(aujourdHui);
  let part = 0;
  for (let m = 0; m < mois; m++) part += saison[m];
  const ouvresDuMois = joursOuvres(premierDuMois(annee, mois), dernierDuMois(annee, mois), alsaceMoselle);
  if (ouvresDuMois > 0) {
    part += (saison[mois] * joursOuvres(premierDuMois(annee, mois), aujourdHui, alsaceMoselle)) / ouvresDuMois;
  }
  return part;
}

export type EtatDeLObjectif = {
  objectif: number;
  fait: number;
  /** Ce qu'il reste à facturer ; 0 une fois l'objectif passé. */
  reste: number;
  passe: boolean;
  /** Où le trait se pose, de 0 à 1 ; `null` sans saison. */
  trait: number | null;
  /** Fait moins attendu : négatif en retard. `null` sans saison. */
  ecart: number | null;
};

export function etatDeLObjectif(
  objectif: number,
  fait: number,
  aujourdHui: JourIso,
  saison: readonly number[] | null,
  alsaceMoselle = false
): EtatDeLObjectif {
  const trait = saison ? partDeLAnneeFaite(aujourdHui, saison, alsaceMoselle) : null;
  return {
    objectif,
    fait,
    reste: Math.max(0, objectif - fait),
    passe: fait >= objectif,
    trait,
    ecart: trait === null ? null : fait - Math.round(objectif * trait),
  };
}

/** Y a-t-il une année d'avant dans l'appli ? Sans elle, ni saison ni Face à l'an dernier. */
export function aUnAnDernier(pieces: readonly Piece[], annee: number): boolean {
  return pieces.some((p) => anneeDe(p.jour) === annee - 1);
}

/**
 * Le chiffre d'affaires de l'année face à son objectif : UNE règle pour
 * l'écran de Réglages et pour la ligne de Terminés, qui montrent la même
 * jauge et le même trait (`CLAUDE.md` §3).
 */
export function etatDeLAnnee(
  objectif: number,
  pieces: readonly Piece[],
  aujourdHui: JourIso,
  alsaceMoselle = false
): EtatDeLObjectif {
  const annee = anneeDe(aujourdHui);
  const fait = totalEntre(pieces, `${annee}-01-01`, aujourdHui);
  return etatDeLObjectif(objectif, fait, aujourdHui, saisonDe(totalParMois(pieces, annee - 1)), alsaceMoselle);
}

/**
 * Le ton de la jauge : vert en avance ou objectif passé, ambre en retard sur
 * la saison. Sans saison, vert : rien ne dit qu'il est en retard.
 */
export function tonDeLAnnee(etat: EtatDeLObjectif): "vert" | "ambre" {
  return etat.passe || (etat.ecart ?? 0) >= 0 ? "vert" : "ambre";
}

// ─── Ce qu'il reste à facturer, mois par mois ──────────────────────────────

export type MoisRestant = {
  mois: number;
  /** Le mois en cours ne compte que ses jours APRÈS aujourd'hui. */
  enCours: boolean;
  joursOuvres: number;
  centimes: number;
};

/**
 * Le reste, réparti sur les mois qui viennent : comme la saison de l'an
 * dernier quand elle existe, sinon sur les jours ouvrés. Aujourd'hui est
 * compté comme fait : ce qui se facture ce soir entre déjà dans le compte.
 *
 * **La somme tombe juste au centime** : l'arrondi de chaque mois laisse un
 * reste, et c'est le dernier mois qui le porte.
 */
export function resteMoisParMois(
  reste: number,
  aujourdHui: JourIso,
  saison: readonly number[] | null,
  alsaceMoselle = false
): MoisRestant[] {
  if (reste <= 0) return [];
  const annee = anneeDe(aujourdHui);
  const mois = moisDe(aujourdHui);
  const lendemain = depuisUtc(enUtc(aujourdHui) + UN_JOUR);
  const liste: (MoisRestant & { poids: number })[] = [];
  for (let m = mois; m < 12; m++) {
    const debut = m === mois ? lendemain : premierDuMois(annee, m);
    const jours = joursOuvres(debut, dernierDuMois(annee, m), alsaceMoselle);
    if (jours === 0) continue;
    const joursDuMois = joursOuvres(premierDuMois(annee, m), dernierDuMois(annee, m), alsaceMoselle);
    const poids = saison ? (saison[m] * jours) / joursDuMois : jours;
    liste.push({ mois: m, enCours: m === mois, joursOuvres: jours, centimes: 0, poids });
  }
  const total = liste.reduce((t, x) => t + x.poids, 0);
  if (total <= 0) return [];
  let reparti = 0;
  liste.forEach((x, i) => {
    x.centimes = i === liste.length - 1 ? reste - reparti : Math.round((reste * x.poids) / total);
    reparti += x.centimes;
  });
  return liste.map((x) => ({ mois: x.mois, enCours: x.enCours, joursOuvres: x.joursOuvres, centimes: x.centimes }));
}

/**
 * Ce qu'il manque encore de NOUVEAUX devis signés pour l'objectif, une fois
 * facturés les chantiers finis et faits les devis déjà signés. Zéro : ce qui
 * est en main suffit. Les devis sans réponse n'y entrent pas : rien ne dit
 * qu'ils seront signés.
 */
export function manqueEncore(reste: number, aFacturer: number, signes: number): number {
  return Math.max(0, reste - aFacturer - signes);
}

// ─── Le bénéfice estimé, sur la banque reliée ───────────────────────────────

export type MouvementPourBenefice = {
  jour: JourIso;
  centimes: number;
  sens: "entree" | "sortie";
  motif: string | null;
  justification: string | null;
};

export type BeneficeEstime = {
  /** Le premier jour lu dans l'année : la banque a pu être reliée en cours d'année. */
  depuis: JourIso;
  encaisse: number;
  fournisseurs: number;
  salaires: number;
  loyer: number;
  impots: number;
  /** Les sorties qui attendent encore leur pièce : comptées, puisqu'elles sont parties. */
  aJustifier: number;
  benefice: number;
};

/**
 * Ce qui entre et ne vient pas d'un client : un prêt, son argent perso, un
 * virement entre ses comptes, un remboursement, une aide. Les mêmes valeurs
 * que `MOTIFS_RECUS` (`src/lib/pour-mon-comptable.ts`), qui les fait choisir.
 */
const ENTREES_SANS_CHIFFRE = new Set(["remboursement", "perso", "pret", "aide", "entre_comptes"]);
/** Ce qui sort et n'est pas une dépense de l'entreprise. */
const SORTIES_HORS_DEPENSES = new Set(["perso", "pret"]);

/**
 * Encaissé moins dépenses, sur les lignes du relevé de l'année. `null` sans
 * une seule ligne : sans la banque, l'appli ne voit pas les dépenses, et un
 * bénéfice sans elles serait faux.
 *
 * **Les prêts ne comptent pas** : la banque ne sépare pas le capital, qui
 * n'est pas une charge, des intérêts, qui en sont une. Le vrai chiffre reste
 * celui du comptable — l'écran le dit.
 */
export function beneficeEstime(mouvements: readonly MouvementPourBenefice[], annee: number): BeneficeEstime | null {
  const lignes = mouvements.filter((m) => anneeDe(m.jour) === annee).sort((a, b) => a.jour.localeCompare(b.jour));
  if (lignes.length === 0) return null;
  const b: BeneficeEstime = {
    depuis: lignes[0].jour,
    encaisse: 0,
    fournisseurs: 0,
    salaires: 0,
    loyer: 0,
    impots: 0,
    aJustifier: 0,
    benefice: 0,
  };
  for (const m of lignes) {
    if (m.sens === "entree") {
      if (!m.motif || !ENTREES_SANS_CHIFFRE.has(m.motif)) b.encaisse += m.centimes;
      continue;
    }
    if (m.motif && SORTIES_HORS_DEPENSES.has(m.motif)) continue;
    if (m.motif === "salaire") b.salaires += m.centimes;
    else if (m.motif === "loyer") b.loyer += m.centimes;
    else if (m.motif === "impots") b.impots += m.centimes;
    else if (m.motif === "fournisseur" || m.justification) b.fournisseurs += m.centimes;
    else b.aJustifier += m.centimes;
  }
  b.benefice = b.encaisse - b.fournisseurs - b.salaires - b.loyer - b.impots - b.aJustifier;
  return b;
}

/**
 * Sur 1 000 € encaissés, combien d'euros restent (sa question du 8 novembre :
 * *« c'est-à-dire quoi, sur 100 euros encaissés il vous reste 14,51 ? »*).
 * En euros ronds : des centimes sur 100 € ne se lisaient pas.
 */
export function resteSurMilleEuros(benefice: number, encaisse: number): number | null {
  if (encaisse <= 0) return null;
  return Math.round((benefice * 1000) / encaisse);
}

// ─── L'objectif saisi ──────────────────────────────────────────────────────

/** 999 999 999 € : la colonne en tient dix chiffres avant la virgule. */
export const OBJECTIF_MAX_CENTIMES = 99_999_999_900;

/**
 * Un montant tapé à la main, en centimes : « 300 000 », « 300000 », « 300 000,50 ».
 * `null` pour du vide ; `NaN` pour ce qui ne se lit pas comme un montant.
 */
export function lireEurosSaisis(texte: string): number | null {
  const propre = texte.replace(/[\s  €]/g, "").replace(",", ".");
  if (propre === "") return null;
  if (!/^\d+(\.\d{1,2})?$/.test(propre)) return Number.NaN;
  const [entiers, decimales = ""] = propre.split(".");
  return Number(entiers) * 100 + Number(decimales.padEnd(2, "0"));
}

export type ObjectifLu = { ok: true; chiffreAffaires: number; benefice: number | null } | { ok: false; raison: string };

/** Les mêmes bornes que les CHECK de la migration 0176. */
export function objectifValide(chiffreAffaires: string, benefice: string): ObjectifLu {
  const ca = lireEurosSaisis(chiffreAffaires);
  if (ca === null) return { ok: false, raison: "Le chiffre d'affaires manque." };
  if (Number.isNaN(ca) || ca <= 0 || ca > OBJECTIF_MAX_CENTIMES) {
    return { ok: false, raison: "Ce chiffre d'affaires ne se lit pas." };
  }
  const b = lireEurosSaisis(benefice);
  if (b === null) return { ok: true, chiffreAffaires: ca, benefice: null };
  if (Number.isNaN(b) || b > OBJECTIF_MAX_CENTIMES) return { ok: false, raison: "Ce bénéfice ne se lit pas." };
  if (b > ca) return { ok: false, raison: "Le bénéfice ne peut pas dépasser le chiffre d'affaires." };
  return { ok: true, chiffreAffaires: ca, benefice: b };
}

/** Des centimes en décimal pour la base : 30000000 → « 300000.00 ». */
export function enDecimal(centimes: number): string {
  const signe = centimes < 0 ? "-" : "";
  const a = Math.abs(centimes);
  return `${signe}${Math.floor(a / 100)}.${String(a % 100).padStart(2, "0")}`;
}

/** Arrondi d'un montant à montrer comme une cible : à la centaine d'euros. */
export function aLaCentaine(centimes: number): number {
  return Math.round(centimes / 10_000) * 10_000;
}
