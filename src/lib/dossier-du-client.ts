import type { PieceDuClient } from "./documents-du-client";
import { nomDuFichierDeLaPiece } from "./documents-du-client";
import { cheminAutorise, type Role } from "./acces-roles";
import { rapportDansLAppli } from "./rapport-dans-l-appli";
import { jourDeLettre } from "./jour";

/**
 * TOUT TÉLÉCHARGER D'UN CLIENT : ce qui entre dans le fichier, et où.
 *
 * **Sa demande du 22 octobre 2026** : *« que l'utilisateur puisse télécharger
 * tous ses devis et toutes ses factures en même temps, en un seul clic, et
 * toutes ses fiches »*. Planche `appli/telecharger-un-client.html`, sa réponse :
 * « la A, et tout en PDF ».
 *
 * **Le fichier contient exactement les registres de la fiche**, pas une
 * seconde liste : les pièces viennent de `chargerFicheClient`, celle qui
 * dessine les onglets. Ce qu'il voit, il l'emporte (`CLAUDE.md` §3).
 *
 * **Et rien de ce qu'il ne pourrait pas ouvrir une pièce à la fois.** Un
 * commercial ne lit pas les factures (`acces-roles.ts`) : le dossier les lui
 * retire, par la MÊME règle que celle qui refuse leur adresse. Un fichier zip
 * qui contournerait la porte de chaque pièce serait une porte dérobée.
 *
 * Règle pure, sans base : le dépôt lit, la route écrit l'archive.
 */

export type Registre = "devis" | "factures" | "fiches" | "avoirs";

/** L'ordre des onglets de la fiche, et les dossiers qui portent leur nom. */
export const DOSSIER_DU_REGISTRE: Record<Registre, string> = {
  devis: "Devis",
  factures: "Factures",
  fiches: "Fiches",
  avoirs: "Avoirs",
};

export type PieceDuDossier = { registre: Registre; piece: PieceDuClient };

/**
 * L'adresse qui garde la pièce dans l'application. Une fiche d'entretien porte
 * l'adresse que le CLIENT a reçue, publique ; dans l'application elle se relit
 * sous `/documents/entretien`, et c'est cette porte-là que le rôle doit avoir.
 */
function porteDeLaPiece(piece: PieceDuClient): string {
  return rapportDansLAppli(piece.href) ?? piece.href;
}

/** Les pièces que ce rôle ouvre déjà une à une, dans l'ordre des onglets. */
export function piecesOuvertes(role: Role, pieces: readonly PieceDuDossier[]): PieceDuDossier[] {
  const ordre = Object.keys(DOSSIER_DU_REGISTRE) as Registre[];
  return pieces
    .filter((p) => cheminAutorise(role, porteDeLaPiece(p.piece)))
    .sort((a, b) => ordre.indexOf(a.registre) - ordre.indexOf(b.registre));
}

/**
 * Le chemin de chaque pièce dans le fichier : `Devis/devis-2026-0031.pdf`.
 *
 * Le NOM est celui que la pièce porte quand on la télécharge seule
 * (`nomDuFichierDeLaPiece`) : un même document sous deux noms ne se retrouve
 * plus. Deux fiches du même jour sont numérotées, sans quoi l'une écraserait
 * l'autre à l'extraction.
 */
export function cheminsDuDossier(pieces: readonly PieceDuDossier[]): string[] {
  const pris = new Set<string>();
  return pieces.map(({ registre, piece }) => {
    const dossier = DOSSIER_DU_REGISTRE[registre];
    const nom = nomDuFichierDeLaPiece(piece);
    const base = nom.replace(/\.pdf$/, "");
    let chemin = `${dossier}/${nom}`;
    for (let n = 2; pris.has(chemin.toLowerCase()); n++) chemin = `${dossier}/${base} (${n}).pdf`;
    pris.add(chemin.toLowerCase());
    return chemin;
  });
}

/**
 * « Bernard, 22 octobre 2026.zip » : le client, et le jour où le dossier a été
 * pris. Les caractères que Windows refuse partent ; les accents restent.
 */
export function nomDuDossierClient(nomClient: string, jour: string): string {
  const nom =
    nomClient
      .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 60)
      .trim() || "Client";
  return `${nom}, ${jourDeLettre(jour)}.zip`;
}
