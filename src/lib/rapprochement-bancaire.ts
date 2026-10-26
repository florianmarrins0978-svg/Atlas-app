/**
 * QUELLE FACTURE UN VIREMENT REÇU PAIE-T-IL ? — une PROPOSITION, jamais un fait.
 *
 * Sa demande du 21 octobre 2026 (`appli/banque-qui-previent.html`), son choix
 * de la banque du 14 août (`docs/QUESTIONS.md` §20), et sa demande du
 * 23 octobre : *« quand on envoie la facture au client, on lui demande qu'il
 * nous mette dans le libellé le numéro de la facture […] il peut aussi, s'il y
 * a le libellé de la facture, faire le rapprochement »*
 * (`appli/banque-numero-et-termines.html`).
 *
 * **Rien ici n'écrit nulle part** : un virement collé à la mauvaise facture
 * met la TVA dans le mauvais mois. Atlas propose, le patron dit oui.
 *
 * **LE NUMÉRO PASSE AVANT TOUT.** La facture le demande déjà au client
 * (`consigneDuLibelle`, `src/lib/modalites-paiement.ts`, 8 septembre 2026) :
 * c'est le seul indice qui désigne une facture au lieu de la deviner. Le
 * montant dit ensuite si c'est tout, une partie, ou plus que dû.
 *
 * | ce que la banque montre | ce qui est rendu |
 * |---|---|
 * | le numéro d'UNE facture | `juste`, `partie` ou `trop`, par le numéro |
 * | pas de numéro, une seule facture a ce reste dû | `juste` |
 * | pas de numéro, plusieurs, le nom n'en désigne qu'une | `juste` |
 * | pas de numéro, plusieurs, le nom ne tranche pas | `plusieurs` : il choisira |
 * | pas de numéro, une seule plus grande au nom du payeur | `partie` : un acompte probable |
 * | les numéros de PLUSIEURS factures | `aucune` : un virement pour deux factures se note à la main |
 * | rien de tout ça | `aucune` |
 *
 * Les montants se comparent en CENTIMES entiers : `0.1 + 0.2` ne vaut pas
 * `0.3`, et un virement de 120,00 € doit rencontrer un reste de « 120.00 ».
 */

export type VirementRecu = {
  /** « 2026-10-21 » : le jour où la banque l'a inscrit. */
  date: string;
  /** « 120.00 », positif : seuls les crédits arrivent ici. */
  montant: string;
  /** Le nom du payeur quand la banque le donne, sinon rien. */
  payeur: string | null;
  /** Le libellé tel que la banque l'écrit. */
  libelle: string;
};

export type FactureARapprocher = {
  id: string;
  numero: string;
  clientNom: string | null;
  /** Ce qui reste à recevoir, « 120.00 ». */
  reste: string;
  /** « 2026-10-20 ». */
  dateEmission: string;
};

/** Ce qui a fait proposer la facture — l'écran le dit, pour qu'il sache pourquoi. */
export type Indice = "numero" | "nom" | "montant";

export type Proposition =
  | { genre: "juste"; facture: FactureARapprocher; indice: Indice }
  | { genre: "partie"; facture: FactureARapprocher; indice: Indice }
  | { genre: "trop"; facture: FactureARapprocher; indice: "numero" }
  | { genre: "plusieurs"; factures: FactureARapprocher[] }
  | { genre: "aucune" };

/** « 120.00 », « 120,5 », « 120 » en centimes ; `null` pour ce qui n'est pas un montant. */
export function enCentimes(montant: string): number | null {
  const net = montant.trim().replace(",", ".");
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(net);
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
}

/** Majuscules sans accents, tout ce qui n'est pas une lettre devient un blanc. */
function aplatir(texte: string): string {
  return texte
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]+/g, " ")
    .trim();
}

/**
 * Le nom du client se lit-il dans ce que la banque écrit ?
 *
 * Mot par mot, et seulement les mots de trois lettres ou plus : « M », « DE »
 * ou « LA » se trouvent dans n'importe quel libellé, et feraient concorder
 * tout le monde avec tout le monde.
 */
export function nomConcorde(clientNom: string | null, virement: VirementRecu): boolean {
  if (!clientNom) return false;
  const mots = aplatir(clientNom)
    .split(" ")
    .filter((m) => m.length >= 3);
  if (mots.length === 0) return false;
  const lu = ` ${aplatir(`${virement.payeur ?? ""} ${virement.libelle}`)} `;
  return mots.some((m) => lu.includes(` ${m} `));
}

/**
 * Le numéro de cette facture est-il écrit dans le libellé ?
 *
 * Le client le tape à la main dans son appli : « F2026-000028 »,
 * « F2026000028 », « f 2026 000028 », « 2026-000028 ». On compare donc des
 * formes COMPACTES — majuscules, sans blanc ni tiret ni point —, avec ou sans
 * la lettre de tête.
 *
 * **Jamais un nombre court seul** : « 28 » se trouve dans n'importe quel
 * libellé (une date, une référence de banque) et ferait proposer la mauvaise
 * facture. L'année et le numéro complet sont exigés, et un chiffre collé avant
 * ou après refuse : « 120260000289 » n'est pas la facture 2026-000028.
 */
export function numeroLu(numeroFacture: string, virement: VirementRecu): boolean {
  const compact = (s: string) => s.toUpperCase().replace(/[\s\-._/]+/g, "");
  const sansLettre = compact(numeroFacture).replace(/^[A-Z]+/, "");
  // Moins de huit chiffres, ce n'est plus un numéro qu'on peut reconnaître sans
  // risque : on préfère ne rien lire.
  if (sansLettre.replace(/\D/g, "").length < 8) return false;
  const lu = compact(`${virement.libelle} ${virement.payeur ?? ""}`);
  const echapper = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<!\\d)${echapper(sansLettre)}(?!\\d)`).test(lu);
}

export function proposerFacture(virement: VirementRecu, factures: readonly FactureARapprocher[]): Proposition {
  const montant = enCentimes(virement.montant);
  if (montant === null || montant <= 0) return { genre: "aucune" };

  // Une facture émise APRÈS le virement ne peut pas être celle qu'il paie.
  const possibles = factures.filter((f) => f.dateEmission <= virement.date);

  // ── 1. Le numéro, s'il est écrit ──────────────────────────────────────────
  const parNumero = possibles.filter((f) => numeroLu(f.numero, virement));
  if (parNumero.length > 1) return { genre: "aucune" };
  if (parNumero.length === 1) {
    const [facture] = parNumero;
    const reste = enCentimes(facture.reste);
    if (reste === null) return { genre: "aucune" };
    if (montant === reste) return { genre: "juste", facture, indice: "numero" };
    if (montant < reste) return { genre: "partie", facture, indice: "numero" };
    return { genre: "trop", facture, indice: "numero" };
  }

  // ── 2. Sans numéro : le montant, puis le nom ──────────────────────────────
  const auMontant = possibles.filter((f) => enCentimes(f.reste) === montant);
  if (auMontant.length === 1) {
    const [facture] = auMontant;
    return { genre: "juste", facture, indice: nomConcorde(facture.clientNom, virement) ? "nom" : "montant" };
  }
  if (auMontant.length > 1) {
    const auNom = auMontant.filter((f) => nomConcorde(f.clientNom, virement));
    if (auNom.length === 1) return { genre: "juste", facture: auNom[0], indice: "nom" };
    return { genre: "plusieurs", factures: auMontant };
  }

  // Aucune au montant exact : un acompte, peut-être. Seulement si le NOM
  // désigne une seule facture plus grande — sans le nom, un montant plus petit
  // irait à toutes, et ce ne serait plus une proposition.
  const enPartie = possibles.filter((f) => {
    const reste = enCentimes(f.reste);
    return reste !== null && reste > montant && nomConcorde(f.clientNom, virement);
  });
  if (enPartie.length === 1) return { genre: "partie", facture: enPartie[0], indice: "nom" };

  return { genre: "aucune" };
}

/** Les factures qu'une proposition désigne — celles auxquelles un « oui » peut s'appliquer. */
export function facturesProposees(p: Proposition): FactureARapprocher[] {
  if (p.genre === "aucune") return [];
  if (p.genre === "plusieurs") return p.factures;
  return [p.facture];
}

/**
 * Combien noter sur la facture choisie, en centimes.
 *
 * **Jamais plus que ce qui reste dû** : au delà, le relevé de TVA compterait
 * une TVA que la facture ne porte pas. Le surplus d'un virement « trop »
 * reste à régler avec le client, et l'écran le dit.
 */
export function montantANoter(virement: Pick<VirementRecu, "montant">, facture: Pick<FactureARapprocher, "reste">): number | null {
  const montant = enCentimes(virement.montant);
  const reste = enCentimes(facture.reste);
  if (montant === null || reste === null) return null;
  return Math.min(montant, reste);
}
