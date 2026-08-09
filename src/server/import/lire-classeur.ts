import { inflateRawSync } from "node:zlib";

// Lire un classeur Excel (`.xlsx`) — la première feuille, en cellules.
//
// **Pourquoi sans bibliothèque.** Le dépôt écrit déjà ses archives ZIP à la
// main, et pour la même raison (`src/lib/archive-zip.ts`) : une dépendance qui
// lit *tout* le format Office — formules, macros, styles, images — pour en tirer
// trois colonnes de texte serait une surface d'attaque considérable en échange
// de rien. Un `.xlsx` est un ZIP de fichiers XML ; on en ouvre deux.
//
// **Ce qu'on lit, et rien d'autre :**
//
//   - `xl/worksheets/sheet1.xml` — les cellules de la première feuille ;
//   - `xl/sharedStrings.xml` — le magasin de textes, où Excel range les chaînes
//     répétées plutôt que de les recopier dans chaque cellule.
//
// **Ce qu'on ne lit pas, délibérément :** les formules (on prend leur RÉSULTAT,
// `<v>`, qui est ce que le patron voit à l'écran), les styles (une cellule
// formatée « 400,00 € » vaut 400 — le formatage est de la présentation), les
// autres feuilles, et absolument rien d'exécutable.

/** Une entrée du ZIP, décompressée. */
function lireEntreeZip(archive: Buffer, nom: string): string | null {
  // On passe par le répertoire central : c'est la seule table de vérité d'un
  // ZIP. Balayer les en-têtes locaux tomberait sur les descripteurs de données
  // et sur les entrées supprimées.
  const finCentral = archive.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (finCentral < 0) return null;
  const nombreEntrees = archive.readUInt16LE(finCentral + 10);
  let position = archive.readUInt32LE(finCentral + 16);

  for (let i = 0; i < nombreEntrees; i++) {
    if (archive.readUInt32LE(position) !== 0x02014b50) return null;
    const methode = archive.readUInt16LE(position + 10);
    const tailleCompressee = archive.readUInt32LE(position + 20);
    const longueurNom = archive.readUInt16LE(position + 28);
    const longueurExtra = archive.readUInt16LE(position + 30);
    const longueurCommentaire = archive.readUInt16LE(position + 32);
    const decalageLocal = archive.readUInt32LE(position + 42);
    const nomEntree = archive.toString("utf8", position + 46, position + 46 + longueurNom);

    if (nomEntree === nom) {
      // L'en-tête local redonne les longueurs de nom et d'extra, qui diffèrent
      // souvent de celles du répertoire central : c'est LUI qui dit où commence
      // vraiment la donnée.
      const nomLocal = archive.readUInt16LE(decalageLocal + 26);
      const extraLocal = archive.readUInt16LE(decalageLocal + 28);
      const debut = decalageLocal + 30 + nomLocal + extraLocal;
      const brut = archive.subarray(debut, debut + tailleCompressee);
      if (methode === 0) return brut.toString("utf8");
      if (methode === 8) return inflateRawSync(brut).toString("utf8");
      return null; // Une méthode exotique : on préfère ne rien rendre que du faux.
    }

    position += 46 + longueurNom + longueurExtra + longueurCommentaire;
  }
  return null;
}

const ENTITES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
};

function decoderXml(texte: string): string {
  return texte
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&(amp|lt|gt|quot|apos);/g, (e) => ENTITES[e] ?? e);
}

/** Le magasin de textes partagés, dans l'ordre où les cellules le référencent. */
function lireTextesPartages(xml: string | null): string[] {
  if (!xml) return [];
  const textes: string[] = [];
  for (const [, contenu] of xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) {
    // Un `<si>` peut être découpé en plusieurs `<t>` quand Excel a mémorisé une
    // mise en forme au milieu du mot. Les recoller est indispensable :
    // « Main d'œuvre » revenait sinon en « Main d' » suivi de « œuvre ».
    const morceaux = [...contenu.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((m) => m[1]);
    textes.push(decoderXml(morceaux.join("")));
  }
  return textes;
}

/** La colonne d'une référence de cellule : « BC12 » → 54 (index zéro). */
function colonneDe(reference: string): number {
  const lettres = /^([A-Z]+)/.exec(reference)?.[1] ?? "A";
  let n = 0;
  for (const lettre of lettres) n = n * 26 + (lettre.charCodeAt(0) - 64);
  return n - 1;
}

/**
 * Les cellules de la première feuille d'un classeur, ligne par ligne.
 *
 * Rend un tableau vide si le fichier n'est pas un classeur lisible — jamais une
 * exception : l'écran doit pouvoir dire « je n'ai rien reconnu dans ce
 * fichier », pas afficher une panne.
 *
 * **Les cellules vides du milieu sont conservées**, à leur place. Une feuille
 * dont la colonne « unité » est vide sur trois lignes décalerait sinon les
 * colonnes suivantes, et les prix se retrouveraient dans la colonne des
 * désignations.
 */
export function lireClasseur(octets: Uint8Array): string[][] {
  let archive: Buffer;
  try {
    archive = Buffer.from(octets);
    if (archive.length < 22 || archive.readUInt32LE(0) !== 0x04034b50) return [];
  } catch {
    return [];
  }

  let feuille: string | null;
  let partages: string[];
  try {
    feuille =
      lireEntreeZip(archive, "xl/worksheets/sheet1.xml") ??
      lireEntreeZip(archive, "xl/worksheets/Sheet1.xml");
    partages = lireTextesPartages(lireEntreeZip(archive, "xl/sharedStrings.xml"));
  } catch {
    return [];
  }
  if (!feuille) return [];

  const lignes: string[][] = [];
  for (const [, contenuLigne] of feuille.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const cellules: string[] = [];
    for (const cellule of contenuLigne.matchAll(/<c\b([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attributs = cellule[1] ?? "";
      const corps = cellule[2] ?? "";
      const reference = /r="([A-Z]+\d+)"/.exec(attributs)?.[1];
      const type = /t="([^"]+)"/.exec(attributs)?.[1];

      let valeur = "";
      if (type === "inlineStr") {
        valeur = decoderXml(
          [...corps.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join("")
        );
      } else {
        // `<v>` porte la valeur — le RÉSULTAT quand la cellule est une formule.
        const v = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(corps)?.[1];
        if (v !== undefined) {
          valeur = type === "s" ? (partages[Number(v)] ?? "") : decoderXml(v);
        }
      }

      const colonne = reference ? colonneDe(reference) : cellules.length;
      while (cellules.length < colonne) cellules.push("");
      cellules[colonne] = valeur;
    }
    lignes.push(cellules);
  }
  return lignes;
}
