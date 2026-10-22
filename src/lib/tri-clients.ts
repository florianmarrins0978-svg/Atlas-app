import type { TraceDuClient } from "./documents-du-client";
import { titreDeLaPeriode } from "./periode";

// LE FILTRE DE SES LISTES DE CLIENTS — sa demande du 22 octobre 2026
// (`appli/facture-mairie-chorus.html`) : *« quand ils vont avoir dix années de
// dossiers et qu'ils ont envie de retrouver un devis qu'ils ont fait en 2017,
// il faut qu'ils puissent avoir le filtre qu'on utilise dans l'application »*,
// puis *« quand c'est marqué par date, que je puisse cliquer et que le
// calendrier s'ouvre et que je puisse voyager dans le temps »*.
//
// Le bouton est celui de Terminés ; le volet a trois clés. « Nom du client »
// rend la liste de A à Z, comme aujourd'hui. Une date ouvre le calendrier :
// le jour choisi désigne son mois, et la liste ne montre plus que les clients
// qui ont une pièce ce mois-là, avec CETTE pièce sous leur nom. Une règle pure,
// pour que les trois listes (clients, entreprises, services publics) disent la
// même chose (`CLAUDE.md` §3).

export type DateDeTri = "devis" | "facture";
export type TriClients = { cle: "nom" } | { cle: DateDeTri; mois: string };

/** Les trois clés du volet, avec les mots de Terminés (`CLES_DE_TRI`). */
export const CLES_TRI_CLIENTS: readonly { cle: TriClients["cle"]; libelle: string }[] = [
  { cle: "nom", libelle: "Nom du client" },
  { cle: "devis", libelle: "Date du devis" },
  { cle: "facture", libelle: "Date de facturation" },
];

/** « 2017-06-12 » → « 2017-06 ». Ce qui n'est pas une date ne désigne aucun mois. */
export function moisDuJour(jour: string): string | null {
  return /^\d{4}-\d{2}-\d{2}$/.test(jour) ? jour.slice(0, 7) : null;
}

type AvecSesPieces = { nom: string; joursDevis: readonly string[]; joursFactures: readonly string[] };

/**
 * Les clients qui ont une pièce ce mois-là, la plus récente en haut.
 *
 * **La pièce montrée est celle du mois**, pas sa plus récente : un client revu
 * en 2024 apparaît en juin 2017 avec son devis de juin 2017, sinon la ligne
 * dirait 2024 sous un titre qui dit 2017.
 */
export function clientsDuMois<T extends AvecSesPieces>(
  clients: readonly T[],
  cle: DateDeTri,
  mois: string
): (T & { piece: TraceDuClient })[] {
  const quoi: TraceDuClient["quoi"] = cle === "devis" ? "Devis" : "Facture";
  const retenus: (T & { piece: TraceDuClient })[] = [];
  for (const c of clients) {
    const jours = (cle === "devis" ? c.joursDevis : c.joursFactures).filter((j) => j.startsWith(`${mois}-`));
    if (jours.length === 0) continue;
    const jour = jours.reduce((a, b) => (b > a ? b : a));
    retenus.push({ ...c, piece: { quoi, jour } });
  }
  return retenus.sort((a, b) => (a.piece.jour === b.piece.jour ? a.nom.localeCompare(b.nom, "fr") : a.piece.jour < b.piece.jour ? 1 : -1));
}

function moisEnToutesLettres(mois: string): string {
  return titreDeLaPeriode(mois).toLocaleLowerCase("fr");
}

/** « Devis de juin 2017 » au-dessus de la liste ; rien de A à Z. */
export function titreDuTri(tri: TriClients): string | null {
  if (tri.cle === "nom") return null;
  return `${tri.cle === "devis" ? "Devis" : "Factures"} de ${moisEnToutesLettres(tri.mois)}`;
}

/** Ce que l'écran dit quand le mois est vide : la pièce et le mois, cités. */
export function aucunePieceDuMois(tri: { cle: DateDeTri; mois: string }): string {
  return `${tri.cle === "devis" ? "Aucun devis" : "Aucune facture"} en ${moisEnToutesLettres(tri.mois)}.`;
}
