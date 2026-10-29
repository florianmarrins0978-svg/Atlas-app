import { lireClasseur } from "./lire-classeur";
import { entetePuisLignes, formatDuTableau, LIGNES_MAX, lireCsv, REFUS_XLS } from "@/lib/import-tableau";

/**
 * Les cellules d'un tableau de devis et factures, la ligne des titres en tête.
 *
 * **Le `.xlsx` passe par `lireClasseur`**, le lecteur maison déjà durci contre
 * la bombe de décompression et les références forgées (audits des 23 et
 * 29 août 2026) : aucune bibliothèque Office ne lit ici un fichier déposé.
 * **Le `.xls` est refusé en le disant** : il attend SheetJS, sa réponse du
 * 28 octobre, que le réseau de cette session n'a pas pu installer (`TODO.md`).
 */
export function grilleDuFichier(nom: string, octets: Uint8Array): { ok: true; grille: string[][] } | { ok: false; raison: string } {
  const format = formatDuTableau(nom);
  if (format === "xls") return { ok: false, raison: REFUS_XLS };
  if (!format) return { ok: false, raison: "Ce format ne se lit pas comme un tableau. Choisissez un fichier CSV ou Excel (.xlsx)." };
  const brute = format === "csv" ? lireCsv(octets) : lireClasseur(octets);
  const grille = entetePuisLignes(brute);
  if (grille.length < 2) return { ok: false, raison: "Ce tableau ne porte aucune ligne lisible." };
  if (grille.length > LIGNES_MAX + 1) {
    return {
      ok: false,
      raison: `Ce tableau a plus de ${LIGNES_MAX.toLocaleString("fr-FR")} lignes. Coupez-le en deux, par exemple cinq années par fichier.`,
    };
  }
  return { ok: true, grille };
}
