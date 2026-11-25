import { CLES_COMPTA, FAMILLES, familleDe, tvaDe, type CleCompta } from "./categories-comptables";

/**
 * LE DOSSIER DU COMPTABLE EN TROIS FICHIERS : ce que le PDF, l'Excel et le FEC
 * se partagent. Ses choix du 24 novembre 2026
 * (`appli/soignee/comptable-trois-fichiers.html`).
 *
 * **Une seule règle pour les trois.** Le numéro d'une pièce, le hors taxe et la
 * TVA d'une ligne, le reste dû d'une facture : calculés deux fois, ils
 * finiraient par différer d'un fichier à l'autre, et le comptable ne saurait
 * plus lequel croire (`CLAUDE.md` §3).
 *
 * **Tout se compte en centimes entiers** : un arrondi par ligne, jamais une
 * somme de flottants qui perd un centime au total.
 */

export const enCentimes = (m: string | number | null | undefined): number => (m == null || m === "" ? 0 : Math.round(Number(m) * 100));

// ─── Le numéro de la pièce ───────────────────────────────────────────────────

/** « A 041 » : trois chiffres au moins, quatre passé mille pièces dans l'année. */
export function numeroDePiece(rang: number): string {
  return `A ${String(rang).padStart(3, "0")}`;
}

/**
 * Le numéro de chaque pièce, imprimé dans les trois fichiers (son choix 5).
 *
 * Une ligne payée par une facture de Cause porte le numéro de LA FACTURE : le
 * comptable la retrouve sous ce numéro dans le registre, l'Excel et le FEC.
 * Toutes les autres prennent « A », dans l'ordre du relevé, et **la suite
 * repart à A 001 chaque 1er janvier** : un dossier d'octobre commence à A 181
 * parce que l'année en a déjà rangé 180 (`dejaRangees`, compté par l'appelant
 * sur les lignes de l'année qui précèdent le dossier).
 *
 * Un dossier ne se réécrit jamais (`dossiers_comptables`, 0144) : un numéro
 * donné l'est pour toujours.
 */
export function numerosDesPieces(
  lignes: readonly { jour: string; factureEmise: string | null }[],
  dejaRangees: Readonly<Record<string, number>>
): string[] {
  const compte = new Map<string, number>();
  return lignes.map((l) => {
    if (l.factureEmise !== null) return l.factureEmise;
    const annee = l.jour.slice(0, 4);
    const n = (compte.get(annee) ?? dejaRangees[annee] ?? 0) + 1;
    compte.set(annee, n);
    return numeroDePiece(n);
  });
}

/** Une ligne qui prend un numéro « A » : tout ce qu'aucune facture de Cause ne paie. */
export const prendUnNumeroA = (l: { factureEmise: string | null }) => l.factureEmise === null;

// ─── Le hors taxe et la TVA d'une ligne ──────────────────────────────────────

/** Ce que la pièce dit de ses chiffres, en centimes. */
export type ChiffresDeLaPiece =
  | { genre: "ticket"; tva: number | null; ttc: number | null }
  | { genre: "facture"; ht: number | null; ttc: number | null }
  /** Une pièce dont la TVA n'a pas été lue : une facture jointe sans ses totaux. */
  | { genre: "non-lue" }
  /** Pas de pièce chiffrée : un motif, un ticket perdu, le relevé lui-même. */
  | { genre: "aucune" };

export type MontantsDeLaLigne = { ht: number; tva: number; tvaNonLue: boolean };

/**
 * Le hors taxe et la TVA déductible d'une ligne de banque.
 *
 * **Le TTC est celui de la BANQUE** : c'est ce qui est sorti du compte. Quand
 * la pièce porte un autre total (un écart accepté), sa TVA se ramène au
 * prorata du payé, sans quoi l'entreprise déduirait une TVA qu'elle n'a pas
 * payée.
 *
 * **Rien ne se devine** (`docs/AGENT.md` §3) : une pièce dont la TVA n'a pas
 * été lue rend zéro, ET le dit (`tvaNonLue`), pour que le comptable la lise
 * sur la pièce. Zéro sans le dire serait une déduction perdue en silence.
 *
 * Ne déduisent jamais : une entrée, une entreprise en franchise, une catégorie
 * sans TVA (assurances, salaires, emprunt…), un ticket perdu.
 */
export function montantsDeLaLigne(a: {
  cle: CleCompta;
  sens: "entree" | "sortie";
  ttc: number;
  franchise: boolean;
  perdu: boolean;
  piece: ChiffresDeLaPiece;
}): MontantsDeLaLigne {
  const sans = { ht: a.ttc, tva: 0, tvaNonLue: false };
  if (a.sens === "entree" || a.franchise || a.perdu || tvaDe(a.cle) === null) return sans;
  const borne = (t: number) => Math.max(0, Math.min(a.ttc, t));
  const auPaye = (tva: number, ttcPiece: number | null) => (ttcPiece && ttcPiece > 0 && ttcPiece !== a.ttc ? Math.round((tva * a.ttc) / ttcPiece) : tva);
  switch (a.piece.genre) {
    case "ticket": {
      if (a.piece.tva === null) return { ...sans, tvaNonLue: true };
      const tva = borne(auPaye(a.piece.tva, a.piece.ttc));
      return { ht: a.ttc - tva, tva, tvaNonLue: false };
    }
    case "facture": {
      if (a.piece.ht === null || a.piece.ttc === null || a.piece.ttc <= 0) return { ...sans, tvaNonLue: true };
      const tva = borne(auPaye(a.piece.ttc - a.piece.ht, a.piece.ttc));
      return { ht: a.ttc - tva, tva, tvaNonLue: false };
    }
    case "non-lue":
      return { ...sans, tvaNonLue: true };
    case "aucune":
      return sans;
  }
}

/** Le compte de la TVA d'une ligne : celle d'un matériel qui s'amortit se range à part. */
export function cleDeLaTva(cle: CleCompta): "tvaDeductible" | "tvaImmobilisations" | null {
  const t = tvaDe(cle);
  return t === "immobilisation" ? "tvaImmobilisations" : t === "deductible" ? "tvaDeductible" : null;
}

// ─── L'ordre du dossier ──────────────────────────────────────────────────────

/**
 * L'ordre des catégories dans les trois fichiers : celui du réglage, famille
 * par famille. Les paiements des clients suivent le registre des ventes ; les
 * autres entrées viennent après les dépenses.
 */
export function ordreDesCategories(): CleCompta[] {
  const rang = (c: CleCompta) => (c === "clients" ? -1 : FAMILLES.indexOf(familleDe(c)));
  return [...CLES_COMPTA].sort((a, b) => rang(a) - rang(b) || CLES_COMPTA.indexOf(a) - CLES_COMPTA.indexOf(b));
}

// ─── Le registre des ventes ──────────────────────────────────────────────────

/** Ce qu'une facture porte à un taux, en centimes. */
export type PartDeTaux = { taux: string; ht: number; tva: number };

/** Une facture émise, telle que le dossier la lit : ses taux, ses avoirs, ses règlements. */
export type FactureDuDossier = {
  numero: string;
  date: string;
  client: string;
  chantier: string | null;
  parTaux: PartDeTaux[];
  ht: number;
  tva: number;
  ttc: number;
  avoirs: { numero: string; date: string; parTaux: PartDeTaux[]; ht: number; tva: number; ttc: number }[];
  /** Tous ses règlements, banque ou non : un chèque déposé, des espèces. */
  paiements: { date: string; montant: number }[];
};

/** Une rangée du registre : une facture, ou un avoir qui la corrige (en négatif). */
export type RangDuRegistre = {
  numero: string;
  genre: "facture" | "avoir";
  /** Pour un avoir : la facture qu'il corrige. */
  facture: string;
  date: string;
  client: string;
  chantier: string | null;
  parTaux: PartDeTaux[];
  ht: number;
  tva: number;
  ttc: number;
  /** Le dernier règlement reçu au plus tard le dernier jour du dossier. */
  payeeLe: string | null;
  enPartie: boolean;
  reste: number;
};

const dansLaPeriode = (j: string, du: string, au: string) => j >= du && j <= au;

/** Ce que la facture doit encore au dernier jour du dossier, avoirs et règlements de ce jour compris. */
function etatAu(f: FactureDuDossier, au: string): { payeeLe: string | null; reste: number } {
  const regles = f.paiements.filter((p) => p.date <= au);
  const corrige = f.avoirs.filter((a) => a.date <= au).reduce((s, a) => s + a.ttc, 0);
  const paye = regles.reduce((s, p) => s + p.montant, 0);
  const payeeLe = regles.length > 0 ? regles.map((p) => p.date).sort().at(-1)! : null;
  return { payeeLe, reste: Math.max(0, f.ttc - corrige - paye) };
}

/**
 * Le registre des ventes du dossier (son choix 1) : chaque facture de la
 * période, chaque avoir de la période en négatif, puis les factures d'avant
 * qu'un client a payées pendant la période.
 */
export function registreDesVentes(factures: readonly FactureDuDossier[], du: string, au: string): { periode: RangDuRegistre[]; avant: RangDuRegistre[] } {
  const periode: RangDuRegistre[] = [];
  const avant: RangDuRegistre[] = [];
  for (const f of factures) {
    const etat = etatAu(f, au);
    const commun = { facture: f.numero, client: f.client, chantier: f.chantier };
    if (dansLaPeriode(f.date, du, au)) {
      periode.push({ ...commun, numero: f.numero, genre: "facture", date: f.date, parTaux: f.parTaux, ht: f.ht, tva: f.tva, ttc: f.ttc, payeeLe: etat.payeeLe, enPartie: etat.payeeLe !== null && etat.reste > 0, reste: etat.reste });
    } else if (f.date < du && f.paiements.some((p) => dansLaPeriode(p.date, du, au))) {
      const dernier = f.paiements.filter((p) => dansLaPeriode(p.date, du, au)).map((p) => p.date).sort().at(-1)!;
      avant.push({ ...commun, numero: f.numero, genre: "facture", date: f.date, parTaux: f.parTaux, ht: f.ht, tva: f.tva, ttc: f.ttc, payeeLe: dernier, enPartie: etat.reste > 0, reste: etat.reste });
    }
    for (const a of f.avoirs.filter((x) => dansLaPeriode(x.date, du, au))) {
      periode.push({
        ...commun,
        numero: a.numero,
        genre: "avoir",
        date: a.date,
        parTaux: a.parTaux.map((t) => ({ taux: t.taux, ht: -t.ht, tva: -t.tva })),
        ht: -a.ht,
        tva: -a.tva,
        ttc: -a.ttc,
        payeeLe: null,
        enPartie: false,
        reste: 0,
      });
    }
  }
  const ordre = (a: RangDuRegistre, b: RangDuRegistre) => a.date.localeCompare(b.date) || a.numero.localeCompare(b.numero);
  return { periode: periode.sort(ordre), avant: avant.sort(ordre) };
}

/** Les taux de la période, du plus petit au plus grand : les colonnes du registre et de l'onglet Ventes. */
export function tauxDuRegistre(rangs: readonly RangDuRegistre[]): string[] {
  return [...new Set(rangs.flatMap((r) => r.parTaux.map((t) => t.taux)))].sort((a, b) => Number(a) - Number(b));
}

/** La TVA d'une rangée à un taux, zéro s'il n'y en a pas. */
export const tvaAuTaux = (r: RangDuRegistre, taux: string) => r.parTaux.filter((t) => t.taux === taux).reduce((s, t) => s + t.tva, 0);

/** « 10 % », « 5,5 % » : le taux tel qu'il s'imprime. */
export function tauxEnMots(taux: string): string {
  return `${String(Number(taux)).replace(".", ",")} %`;
}

// ─── Les codes des tiers ─────────────────────────────────────────────────────

/**
 * Le code d'un client ou d'un fournisseur pour le compte auxiliaire du FEC :
 * ses lettres et chiffres, sans accent, en capitales. « Mairie de Cholet »
 * devient « MAIRIEDECHOLET ». Le même nom donne toujours le même code : un
 * client se retrouve d'un dossier à l'autre.
 */
export function codeDuTiers(nom: string | null): string {
  const c = (nom ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/œ/gi, "OE")
    .replace(/æ/gi, "AE")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 17);
  return c || "DIVERS";
}

// ─── Une ligne de banque, telle que les trois fichiers la lisent ─────────────

export type Justificatif = "ticket" | "facture" | "facture-hors-cause" | "facture-emise" | "motif" | "perdu";

export type LigneComptable = {
  /** Le numéro de sa pièce : « A 041 », ou celui de la facture de Cause qu'elle paie. */
  ref: string;
  jour: string;
  libelle: string;
  sens: "entree" | "sortie";
  /** En centimes, positifs : le sens dit de quel côté. */
  ttc: number;
  ht: number;
  tva: number;
  tvaNonLue: boolean;
  cle: CleCompta;
  compte: string;
  /** Le compte de sa TVA, quand elle en déduit. */
  compteTva: string | null;
  /** Le fournisseur, la société ou le client qu'elle nomme. */
  tiers: string | null;
  /** Le jour de la pièce : un achat se date de sa facture. */
  pieceDate: string | null;
  /** Une facture de fournisseur : elle passe au journal des achats, puis se paie en banque. */
  achat: boolean;
  /** La facture de Cause que la ligne paie, ce qu'elle vaut après ses avoirs : sa part de TVA devient due. */
  facture: { numero: string; client: string; tva: number; ttc: number } | null;
  justificatif: Justificatif;
  /** Les mots du justificatif, pour l'onglet Achats : « Facture 2026-418 », « Par sa nature : un loyer ». */
  pieceEnMots: string;
};
