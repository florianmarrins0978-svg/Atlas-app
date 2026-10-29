import { normaliserPourRecherche } from "./recherche-client";
import { natureDeLaPiece, type PieceDuClient } from "./documents-du-client";
import { dateCitee } from "./mois";

/**
 * LA LOUPE DES PIÈCES D'UN CLIENT : un nom, un titre, un montant.
 *
 * **Sa demande du 28 octobre 2026** : *« il faut rajouter la loupe pour faire
 * une recherche par nom ou montant »*, puis la phrase qu'il veut lire dans la
 * case, *« Chercher un nom, un titre, un montant »*. Planches
 * `appli/soignee/client.html` et `appli/soignee/clients-importer.html`.
 *
 * **Règle pure** (`CLAUDE.md` §3) : la fiche d'un client et Vos clients s'en
 * servent, sans la réécrire. Deux loupes qui ne trouvent pas la même chose,
 * c'est lui qui le verrait.
 */

/** Sa phrase du 28 octobre 2026, la même dans les deux loupes. */
export const AIDE_DE_LA_LOUPE = "Chercher un nom, un titre, un montant";

/**
 * Ce qu'il tape est un montant : des chiffres, et rien que ce qui s'écrit dans
 * un prix (espaces, virgule, point, « € »).
 *
 * **Un numéro n'en est pas un** : « 2026-000024 » porte un tiret, et se cherche
 * comme un texte. Une année tapée seule (« 2026 ») est un montant : c'est la
 * règle de la planche, et un prix de 2 026 € existe.
 */
export function estUnMontant(saisie: string): boolean {
  const net = saisie.trim();
  return /\d/.test(net) && /^[\d\s  ,.€]+$/.test(net);
}

/**
 * Un montant répond à ce qu'il tape.
 *
 * Sans centimes, **le début des euros** : « 640 » trouve 640 € et 6 400 €, comme
 * on retrouve un prix dont on n'a en tête que le commencement. Avec centimes
 * (« 640,00 », « 6400.5 »), **le montant exact** et lui seul.
 */
export function montantRepond(montant: string | null | undefined, saisie: string): boolean {
  if (!montant) return false;
  const valeur = Number(montant);
  if (!Number.isFinite(valeur)) return false;
  const centimes = Math.round(valeur * 100);
  // Une virgule laissée en fin de frappe (« 1380, ») n'a encore rien dit.
  const net = saisie.replace(/[\s  €]/g, "").replace(/[,.]$/, "");
  if (!net) return false;
  if (/[,.]\d/.test(net)) return centimes === Math.round(Number(net.replace(",", ".")) * 100);
  return String(Math.floor(Math.abs(centimes) / 100)).startsWith(net);
}

type PieceCherchable = Pick<PieceDuClient, "titre" | "jour" | "objet" | "montant" | "format">;

/**
 * Les pièces qui répondent à ce qu'il tape, dans l'ordre où elles étaient.
 *
 * **Un texte se cherche mot à mot**, dans n'importe quel ordre, comme le nom
 * d'un client (`filtrerClientsParNom`) : dans le titre, dans le numéro, et dans
 * le nom du client lui-même, car la case dit « un nom ». Sur sa fiche, taper son
 * nom rend donc tout son dossier.
 *
 * **Une fiche se cherche aussi par son jour, écrit en entier.** L'écran porte
 * « 8 oct. 2026 » ; il tape « octobre ». Elle n'a pas de prix : un montant ne
 * la trouve jamais.
 *
 * Rien de tapé : tout reste.
 */
export function piecesQuiRepondent<T extends PieceCherchable>(pieces: readonly T[], saisie: string, nomClient: string): T[] {
  if (!saisie.trim()) return [...pieces];
  if (estUnMontant(saisie)) return pieces.filter((p) => montantRepond(p.montant, saisie));
  const mots = normaliserPourRecherche(saisie).split(" ").filter(Boolean);
  return pieces.filter((p) => {
    const jourEnEntier = p.format === "page" && p.jour ? dateCitee(p.jour) : "";
    const texte = normaliserPourRecherche([p.objet ?? "", p.titre, nomClient, jourEnEntier].join(" "));
    return mots.every((mot) => texte.includes(mot));
  });
}

/** Rien ne répond : la phrase cite ce qu'il a tapé, et la faute de frappe se voit. */
export function rienNeRepond(saisie: string): string {
  return `Rien ne répond à « ${saisie.trim()} ».`;
}

/** Le titre au-dessus des pièces trouvées : « 3 devis », « 1 facture », « 4 devis et factures ». */
export function compteDesPieces(pieces: readonly Pick<PieceDuClient, "href">[]): string {
  const factures = pieces.filter((p) => natureDeLaPiece(p.href) === "facture").length;
  const devis = pieces.length - factures;
  if (devis === 0) return `${factures} facture${factures > 1 ? "s" : ""}`;
  if (factures === 0) return `${devis} devis`;
  return `${pieces.length} devis et factures`;
}

/** L'onglet de la fiche qu'ouvre une pièce trouvée sur Vos clients. */
export function registreDeLaPiece(piece: Pick<PieceDuClient, "href">): "devis" | "factures" {
  return natureDeLaPiece(piece.href) === "facture" ? "factures" : "devis";
}
