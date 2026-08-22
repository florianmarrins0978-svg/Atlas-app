// « Terminés » : le mois qu'on feuillette, et ce qui attend d'être facturé.
//
// **Des règles pures, testables sans base**, parce qu'elles décident de trois
// choses que l'œil ne rattrape pas : dans quel mois tombe un chantier, ce que
// ce mois totalise, et ce qui reste à facturer tous mois confondus.
//
// **Refait le 22 août 2026 sur la planche 86** (`appli/termines-simple.html`,
// proposition B), retenue par le patron : *« je choisis la B avec les
// modifications que je viens de te demander »*. L'écran d'avant empilait un fil
// par mois, chacun portant un volet replié ; celui-ci montre **un seul mois à
// la fois**, qu'on feuillette.
//
// **CE QUI RESTE À FACTURER NE SUIT PAS LE MOIS**, et c'est tout l'objet de sa
// demande : *« il faut pouvoir revenir dans le passé si jamais on a du retard
// sur la facturation »*. Un chantier de juillet jamais facturé doit rester sous
// ses yeux en août — sinon il faudrait déjà savoir qu'il existe pour aller le
// chercher. D'où `aFacturerPartout`, qui ignore délibérément le mois affiché.

/** Ce que l'écran reçoit du dépôt, réduit à ce dont la règle a besoin. */
export type LigneTerminee = {
  id: string;
  nom: string;
  clientNom: string | null;
  datePlanifiee: string | null;
  factureNumero: string | null;
  /** `AAAA-MM-JJ` — la date d'ÉMISSION de la facture, jamais celle du chantier. */
  factureDateEmission: string | null;
  /** `"emise"` quand la facture est partie chez le client. */
  factureStatut: string | null;
  /** Le total de la facture, quand elle existe. */
  totalTtc: string | null;
  /** Le total du dernier devis envoyé — le montant PRÉVU, pas encaissé. */
  devisTotalTtc: string | null;
};

export type LigneAffichee = LigneTerminee & {
  /** `true` tant qu'aucune facture n'a été émise pour ce chantier. */
  aFacturer: boolean;
  /** Le montant à montrer : celui de la facture, sinon celui du devis. */
  montant: number | null;
  /** `AAAA-MM`, ou `""` quand le chantier n'a pas de date. */
  cleMois: string;
};

/** Ce qu'un mois porte, une fois qu'on s'y est arrêté. */
export type ResumeMois = {
  /** `AAAA-MM` */
  cle: string;
  /** Tout ce que ce mois porte, du plus récent au plus ancien, les deux camps mêlés. */
  lignes: LigneAffichee[];
  /** Ce qui est facturé dans ce mois — le mois se solde avec ça. */
  facturees: LigneAffichee[];
  /** Ce qui attend DANS CE MOIS. La liste complète est `aFacturerPartout`. */
  aFacturer: LigneAffichee[];
  totalFacture: number;
  totalPrevu: number;
};

const MOIS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

/**
 * Le montant en euros, ou `null` quand rien n'est connu.
 *
 * **`null` et non zéro.** Un chantier dont le devis n'a pas de total n'attend
 * pas 0 € : on ne sait pas. Écrire « 0,00 € » à sa place serait inventer un
 * chiffre — et le patron a une vraie facture à 0,00 € dans ses données, qu'on
 * ne doit pas pouvoir confondre avec une absence.
 */
function euros(brut: string | null | undefined): number | null {
  if (brut == null || brut === "") return null;
  const n = Number(brut);
  return Number.isFinite(n) ? n : null;
}

/** Une facture émise, ou seulement préparée ? */
export function estFacture(l: Pick<LigneTerminee, "factureStatut">): boolean {
  return l.factureStatut === "emise";
}

/**
 * Décore les lignes et les range du plus récent au plus ancien.
 *
 * **Le comparateur rend 0 à dates égales.** Un comparateur qui répond « plus
 * petit » dans ce cas se contredit (`a<b` et `b<a` à la fois) et le tri rend
 * alors un ordre qu'aucune donnée n'explique : deux factures du même jour
 * sortaient à l'envers de ce que le patron voit sur son écran. Trouvé sur la
 * planche 86, où les deux factures du 19 août s'échangeaient.
 */
export function preparer(lignes: readonly LigneTerminee[]): LigneAffichee[] {
  return lignes
    .map((l): LigneAffichee => {
      const facture = estFacture(l);
      return {
        ...l,
        aFacturer: !facture,
        montant: facture ? euros(l.totalTtc) : euros(l.devisTotalTtc),
        cleMois: (l.datePlanifiee ?? "").slice(0, 7),
      };
    })
    .sort((a, b) => {
      const da = a.datePlanifiee ?? "";
      const db = b.datePlanifiee ?? "";
      if (da === db) return 0;
      // Un chantier sans date ne se range nulle part dans le temps : il passe
      // devant plutôt que de se perdre au fond de la liste.
      if (!da) return -1;
      if (!db) return 1;
      return da < db ? 1 : -1;
    });
}

/**
 * Le mois par lequel l'écran s'ouvre : le plus récent qui porte quelque chose.
 *
 * `null` quand il n'y a rien à montrer — l'écran dit alors autre chose, il ne
 * feuillette pas un calendrier vide.
 */
export function moisLePlusRecent(lignes: readonly LigneAffichee[]): string | null {
  let recent: string | null = null;
  for (const l of lignes) {
    if (!l.cleMois) continue;
    if (recent === null || l.cleMois > recent) recent = l.cleMois;
  }
  return recent;
}

/**
 * « 2026-08 » reculé de `n` mois — `n` négatif avance.
 *
 * **On se déplace sur le CALENDRIER, pas sur la liste des mois qui portent
 * quelque chose.** Sauter d'août à mai parce que juin et juillet sont vides
 * laisserait croire que juin n'existe pas ; l'écran doit pouvoir répondre
 * « aucune facture en juin », ce qui est une réponse.
 */
export function decalerMois(cle: string, n: number): string {
  let annee = Number(cle.slice(0, 4));
  let mois = Number(cle.slice(5, 7)) - n;
  while (mois < 1) { mois += 12; annee -= 1; }
  while (mois > 12) { mois -= 12; annee += 1; }
  return `${annee}-${String(mois).padStart(2, "0")}`;
}

/** « Août 2026 ». */
export function nomDuMois(cle: string): string {
  const nom = MOIS[Number(cle.slice(5, 7)) - 1];
  if (!nom) return "";
  return `${nom.charAt(0).toUpperCase()}${nom.slice(1)} ${cle.slice(0, 4)}`;
}

/** « août » — le mois seul, en minuscules, pour une phrase. */
export function moisSeul(cle: string): string {
  return MOIS[Number(cle.slice(5, 7)) - 1] ?? "";
}

/** Ce que porte un mois donné. */
export function resumeDuMois(lignes: readonly LigneAffichee[], cle: string): ResumeMois {
  const duMois = lignes.filter((l) => l.cleMois === cle);
  const facturees = duMois.filter((l) => !l.aFacturer);
  const aFacturer = duMois.filter((l) => l.aFacturer);
  return {
    cle,
    lignes: duMois,
    facturees,
    aFacturer,
    totalFacture: somme(facturees),
    totalPrevu: somme(aFacturer),
  };
}

/**
 * Tout ce qui attend d'être facturé, TOUS MOIS CONFONDUS.
 *
 * **Elle ignore le mois affiché, et c'est délibéré** — voir l'en-tête du
 * fichier : c'est la demande du patron sur le retard de facturation.
 */
export function aFacturerPartout(lignes: readonly LigneAffichee[]): LigneAffichee[] {
  return lignes.filter((l) => l.aFacturer);
}

/** Ce qui est facturé, tous mois confondus. */
export function factureesPartout(lignes: readonly LigneAffichee[]): LigneAffichee[] {
  return lignes.filter((l) => !l.aFacturer);
}

/** La somme des montants connus. Un montant inconnu ne vaut pas zéro : il ne compte pas. */
export function somme(lignes: readonly LigneAffichee[]): number {
  return lignes.reduce((t, l) => t + (l.montant ?? 0), 0);
}

/**
 * « 5 factures envoyées · et 2 040,00 € qui attendent leur facture. »
 *
 * **Le patron l'a demandée en noir gras le 22 août 2026** : c'est ce qu'il
 * vient chercher, pas une note de bas de page. La seconde moitié n'apparaît que
 * s'il y a quelque chose en attente DANS CE MOIS, et seulement si son montant
 * est connu — annoncer « 0,00 € qui attendent » là où on ne sait pas serait
 * dire qu'il n'y a rien à encaisser.
 */
export function libelleCompte(mois: ResumeMois): string {
  const n = mois.facturees.length;
  const debut = n === 0
    ? "Aucune facture envoyée"
    : `${n} facture${n > 1 ? "s" : ""} envoyée${n > 1 ? "s" : ""}`;
  const montantConnu = mois.aFacturer.some((l) => l.montant !== null);
  if (mois.aFacturer.length === 0 || !montantConnu) return `${debut}.`;
  return `${debut} · et ${formatEuros(mois.totalPrevu)} qui attendent leur facture.`;
}

/**
 * « Facture n° 5 » — le numéro qu'il lit à voix haute.
 *
 * **« F2026-0005 » ne se dit pas au téléphone**, et il ouvrait chaque ligne de
 * l'ancien écran, avant même le nom du client. On garde la fin du numéro, qui
 * est ce qui le distingue.
 *
 * On lit les chiffres de FIN, sans supposer où tombe le tiret : `slice(5)` avait
 * fait écrire « Facture n° -5 » sur la planche 86 — le tiret entrait dans le
 * nombre. Trouvé en regardant l'écran, par aucun contrôle.
 */
export function numeroCourt(numero: string): string {
  const fin = numero.match(/(\d+)\s*$/);
  return fin ? `Facture n° ${Number(fin[1])}` : `Facture ${numero}`;
}

/** « Facturé le 20 août », d'après la date d'émission — ou rien si on l'ignore. */
export function libelleFacturee(l: LigneAffichee): string {
  const jour = l.factureDateEmission;
  if (!jour) return l.factureNumero ? numeroCourt(l.factureNumero) : "Facturée";
  const quand = `Facturé le ${Number(jour.slice(8, 10))} ${moisSeul(jour.slice(0, 7))}`;
  return l.factureNumero ? `${quand} · ${numeroCourt(l.factureNumero)}` : quand;
}

const EUROS = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * « 1 240,00 € ».
 *
 * **Il vit ici et non dans le composant.** Exporté depuis un fichier
 * « use client », il n'était plus appelable depuis le serveur : la page entière
 * tombait sur « Attempted to call formatEuros() from the server ». Un
 * formateur n'a rien de client — il ne touche ni au DOM ni à l'état.
 */
export function formatEuros(n: number): string {
  return EUROS.format(n);
}
