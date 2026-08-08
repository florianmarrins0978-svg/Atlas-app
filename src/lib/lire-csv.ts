// Lire un CSV tel qu'un tableur français en produit.
//
// **Pourquoi à la main, encore.** Même raison que l'archive ZIP
// (`src/lib/archive-zip.ts`) : le format tient en trente lignes, il est figé, et
// une dépendance de plus coûterait davantage en surface d'attaque et en
// entretien qu'elle ne ferait gagner.
//
// **Les trois pièges d'un CSV français**, et ce sont eux qui font tout le
// travail ci-dessous :
//
//   1. **le séparateur est un point-virgule**, parce que la virgule est déjà
//      prise par les décimales. Excel en français exporte ainsi ;
//   2. **le fichier commence souvent par un BOM** (`﻿`) — invisible, il
//      colle à la première cellule et fait rater l'en-tête « Intitulé » ;
//   3. **une cellule entre guillemets peut contenir le séparateur**, un
//      retour à la ligne, et des guillemets doublés.

/** Le séparateur le plus probable, décidé sur la première ligne. */
function separateur(texte: string): string {
  const premiere = texte.split(/\r?\n/, 1)[0] ?? "";
  // Comptés HORS guillemets : « Abattage; démontage » ne doit pas faire pencher
  // la balance vers le point-virgule à lui seul.
  let dansGuillemets = false;
  const compte: Record<string, number> = { ";": 0, ",": 0, "\t": 0 };
  for (const c of premiere) {
    if (c === '"') dansGuillemets = !dansGuillemets;
    else if (!dansGuillemets && c in compte) compte[c]++;
  }
  const meilleur = Object.entries(compte).sort((a, b) => b[1] - a[1])[0]!;
  return meilleur[1] > 0 ? meilleur[0] : ";";
}

/**
 * Découpe un CSV en lignes de cellules.
 *
 * Rend toujours un tableau, jamais une erreur : un fichier illisible donne des
 * lignes bizarres, que `lireTableau` écartera en disant pourquoi. Une exception
 * ici se présenterait au patron comme « le fichier est cassé », alors que le
 * plus souvent une seule ligne l'est.
 */
export function lireCsv(texte: string): string[][] {
  const contenu = texte.replace(/^﻿/, "");
  const sep = separateur(contenu);

  const lignes: string[][] = [];
  let cellules: string[] = [];
  let courante = "";
  let dansGuillemets = false;

  for (let i = 0; i < contenu.length; i++) {
    const c = contenu[i]!;

    if (dansGuillemets) {
      if (c === '"') {
        // Un guillemet doublé à l'intérieur d'une cellule en représente un seul.
        if (contenu[i + 1] === '"') {
          courante += '"';
          i++;
        } else dansGuillemets = false;
      } else courante += c;
      continue;
    }

    if (c === '"') {
      dansGuillemets = true;
      continue;
    }
    if (c === sep) {
      cellules.push(courante);
      courante = "";
      continue;
    }
    if (c === "\n" || c === "\r") {
      // \r\n compte pour une seule fin de ligne.
      if (c === "\r" && contenu[i + 1] === "\n") i++;
      cellules.push(courante);
      lignes.push(cellules);
      cellules = [];
      courante = "";
      continue;
    }
    courante += c;
  }

  if (courante !== "" || cellules.length > 0) {
    cellules.push(courante);
    lignes.push(cellules);
  }
  return lignes;
}
