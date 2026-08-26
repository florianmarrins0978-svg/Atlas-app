import { lireCsv } from "../../lib/lire-csv";
import { lireTableau, type LectureTableau } from "../../lib/import-tarifs";
import { lireClasseur } from "./lire-classeur";

// Reconnaître le fichier que le patron dépose, et en tirer un tableau.
//
// **Un aiguillage, et rien de plus.** Chaque format a son lecteur, chacun sans
// dépendance et sans réseau ; ce qu'on fait ensuite des cellules est la même
// règle pour tous (`src/lib/import-tarifs.ts`). C'est ce qui permet d'ajouter un
// format sans toucher à la façon dont les prix sont compris.

export type ResultatLecture =
  | { statut: "lu"; lecture: LectureTableau; format: "csv" | "excel" }
  | { statut: "refuse"; raison: string };

/** Un `.xlsx` est un ZIP : ses quatre premiers octets ne trompent pas. */
function estClasseur(octets: Uint8Array): boolean {
  return octets[0] === 0x50 && octets[1] === 0x4b && octets[2] === 0x03 && octets[3] === 0x04;
}

/** Un PDF commence par `%PDF-`. */
function estPdf(octets: Uint8Array): boolean {
  return octets[0] === 0x25 && octets[1] === 0x50 && octets[2] === 0x44 && octets[3] === 0x46;
}

/**
 * Lit un fichier de tarifs, quel qu'en soit le nom.
 *
 * **On regarde le CONTENU, pas l'extension.** Un fichier renommé `.csv` alors
 * qu'il vient d'Excel est le cas le plus banal du monde ; le refuser sur son
 * nom donnerait au patron un « format non reconnu » parfaitement faux.
 */
export function lireFichierTarifs(nom: string, octets: Uint8Array): ResultatLecture {
  if (octets.length === 0) return { statut: "refuse", raison: "Ce fichier est vide." };

  if (estClasseur(octets)) {
    const cellules = lireClasseur(octets);
    if (cellules.length === 0) {
      return {
        statut: "refuse",
        raison:
          "Ce classeur n'a pas pu être ouvert. S'il vient de Numbers ou de LibreOffice, " +
          "réenregistrez-le au format Excel (.xlsx), ou exportez-le en CSV.",
      };
    }
    return { statut: "lu", lecture: lireTableau(cellules), format: "excel" };
  }

  if (estPdf(octets)) {
    // **Refusé, et on dit pourquoi plutôt que d'essayer.**
    //
    // Un PDF n'est pas un tableau : c'est une IMAGE de tableau. Les colonnes
    // n'y existent plus, seulement des morceaux de texte posés à des
    // coordonnées — et souvent avec un encodage propre au document, qui rend
    // les accents illisibles. On peut deviner ; deviner un PRIX est exactement
    // ce que ce produit ne fait jamais (`docs/AGENT.md` §3).
    //
    // La sortie est à deux gestes, et elle est sûre : dans Excel, « Fichier →
    // Enregistrer sous → CSV ». Voir `TODO.md` §0 sexies.
    return {
      statut: "refuse",
      raison:
        "Un PDF est une image de tableau : les colonnes n'y existent plus, et lire un prix " +
        "de travers est pire que ne pas le lire. Ouvrez la liste dans Excel puis " +
        "« Enregistrer sous », puis CSV, et redéposez-la ici.",
    };
  }

  // Tout le reste est traité comme du texte séparé : CSV, TSV, ou une liste
  // collée à la main. Le décodage est en UTF-8, avec repli Latin-1 — un CSV
  // enregistré par un Excel français ancien est encore souvent en Latin-1, et
  // le lire en UTF-8 rendrait « Élagage » en « �lagage ».
  const texte = decoder(octets);
  const cellules = lireCsv(texte);
  if (cellules.length === 0) return { statut: "refuse", raison: "Aucune ligne lisible dans ce fichier." };
  return { statut: "lu", lecture: lireTableau(cellules), format: "csv" };
}

function decoder(octets: Uint8Array): string {
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(octets);
  // Le caractère de remplacement signale un décodage raté : on retente en
  // Latin-1, qui ne peut pas échouer et rend les accents des vieux exports.
  if (!utf8.includes("�")) return utf8;
  return new TextDecoder("latin1").decode(octets);
}
