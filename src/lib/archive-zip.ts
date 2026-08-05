// Écrire une archive ZIP, sans dépendance et sans tout garder en mémoire.
//
// **Pourquoi à la main.** Le dépôt n'embarque aucune bibliothèque d'archivage.
// En ajouter une pour un format publié en 1989 et figé depuis coûterait plus
// cher — surface d'attaque, mises à jour, licence — que les quatre-vingts
// lignes ci-dessous.
//
// **Pourquoi le ZIP.** C'est le seul format qu'un téléphone, un Mac et un
// Windows ouvrent tous les trois d'un appui, sans rien installer. La
// sauvegarde du patron doit s'ouvrir là où elle atterrit.
//
// **Pourquoi sans compression** (méthode « stockage », 0). Ce qui pèse dans
// l'archive, ce sont des photos JPEG et des PDF : déjà compressés, ils ne
// gagneraient que quelques pour cent. On échangerait ces pour cent contre un
// chemin de code capable de se tromper en silence — un mauvais marché pour une
// sauvegarde, dont la seule qualité qui compte est de se relire.

const TABLE_CRC = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

/** CRC-32 (polynôme IEEE), tel que l'attendent les en-têtes ZIP. */
export function crc32(octets: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < octets.length; i += 1) {
    c = TABLE_CRC[(c ^ octets[i]!) & 0xff]! ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

export type EntreeArchive = {
  /** Chemin dans l'archive, séparateurs `/`. */
  nom: string;
  contenu: Uint8Array;
};

// Au-delà de 4 Gio, le format exige son extension ZIP64, que ce module n'écrit
// pas. Refuser bruyamment plutôt que produire une archive que l'ordinateur du
// patron ouvrira à moitié : une sauvegarde silencieusement tronquée est pire
// qu'une sauvegarde absente, puisqu'on s'y fie.
const LIMITE_ZIP = 0xffffffff;

export class ArchiveTropVolumineuseError extends Error {
  constructor(details: string) {
    super(
      `Archive trop volumineuse pour le format ZIP simple (${details}). ` +
        "Ce module n'écrit pas l'extension ZIP64 ; passer par une sauvegarde " +
        "de base de données (voir PRODUCTION_BACKUP_RESTORE.md)."
    );
    this.name = "ArchiveTropVolumineuseError";
  }
}

/** Date et heure au format MS-DOS, seul horodatage que connaisse l'en-tête ZIP. */
function horodatageDos(d: Date): { heure: number; date: number } {
  // Le format ne sait pas représenter une année antérieure à 1980 ; on s'y
  // ramène plutôt que d'écrire un champ négatif que les lecteurs interprètent
  // n'importe comment.
  const annee = Math.max(1980, d.getFullYear());
  return {
    heure: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    date: ((annee - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

// Bit 11 : les noms de fichiers sont en UTF-8. Sans lui, un chantier nommé
// « Chêne mort » ressort avec des caractères cassés sous Windows.
const DRAPEAU_UTF8 = 0x0800;
const METHODE_STOCKAGE = 0;

function enTeteLocal(nom: Buffer, crc: number, taille: number, dos: { heure: number; date: number }): Buffer {
  const b = Buffer.alloc(30);
  b.writeUInt32LE(0x04034b50, 0);
  b.writeUInt16LE(20, 4); // version minimale du lecteur
  b.writeUInt16LE(DRAPEAU_UTF8, 6);
  b.writeUInt16LE(METHODE_STOCKAGE, 8);
  b.writeUInt16LE(dos.heure, 10);
  b.writeUInt16LE(dos.date, 12);
  b.writeUInt32LE(crc, 14);
  b.writeUInt32LE(taille, 18); // taille compressée = taille réelle (stockage)
  b.writeUInt32LE(taille, 22);
  b.writeUInt16LE(nom.length, 26);
  b.writeUInt16LE(0, 28); // aucun champ « extra »
  return Buffer.concat([b, nom]);
}

function enTeteCentral(
  nom: Buffer,
  crc: number,
  taille: number,
  dos: { heure: number; date: number },
  decalage: number
): Buffer {
  const b = Buffer.alloc(46);
  b.writeUInt32LE(0x02014b50, 0);
  b.writeUInt16LE(20, 4); // version de l'écrivain
  b.writeUInt16LE(20, 6); // version minimale du lecteur
  b.writeUInt16LE(DRAPEAU_UTF8, 8);
  b.writeUInt16LE(METHODE_STOCKAGE, 10);
  b.writeUInt16LE(dos.heure, 12);
  b.writeUInt16LE(dos.date, 14);
  b.writeUInt32LE(crc, 16);
  b.writeUInt32LE(taille, 20);
  b.writeUInt32LE(taille, 24);
  b.writeUInt16LE(nom.length, 28);
  b.writeUInt16LE(0, 30); // extra
  b.writeUInt16LE(0, 32); // commentaire
  b.writeUInt16LE(0, 34); // disque de départ
  b.writeUInt16LE(0, 36); // attributs internes
  b.writeUInt32LE(0, 38); // attributs externes
  b.writeUInt32LE(decalage, 42);
  return Buffer.concat([b, nom]);
}

function finDuCatalogue(nombre: number, tailleCatalogue: number, decalageCatalogue: number): Buffer {
  const b = Buffer.alloc(22);
  b.writeUInt32LE(0x06054b50, 0);
  b.writeUInt16LE(0, 4); // numéro de disque
  b.writeUInt16LE(0, 6); // disque portant le catalogue
  b.writeUInt16LE(nombre, 8);
  b.writeUInt16LE(nombre, 10);
  b.writeUInt32LE(tailleCatalogue, 12);
  b.writeUInt32LE(decalageCatalogue, 16);
  b.writeUInt16LE(0, 20); // commentaire d'archive
  return b;
}

/**
 * Produit l'archive morceau par morceau, une entrée à la fois.
 *
 * Générateur et non `Buffer` : une sauvegarde complète peut peser des
 * centaines de mégaoctets, et la construire d'un bloc en mémoire ferait tomber
 * le serveur au moment précis où le patron essaie de sauver ses données. Seule
 * l'entrée en cours est tenue en mémoire ; le catalogue final ne retient que
 * les noms et quatre nombres par fichier.
 *
 * L'appelant décide de la source (`entrees` peut lire le disque paresseusement).
 */
export async function* ecrireArchiveZip(
  entrees: AsyncIterable<EntreeArchive> | Iterable<EntreeArchive>,
  maintenant: Date
): AsyncGenerator<Uint8Array> {
  const dos = horodatageDos(maintenant);
  const catalogue: Buffer[] = [];
  let decalage = 0;
  let nombre = 0;

  for await (const entree of entrees) {
    const nom = Buffer.from(entree.nom, "utf8");
    const taille = entree.contenu.length;
    if (taille > LIMITE_ZIP) {
      throw new ArchiveTropVolumineuseError(`« ${entree.nom} » dépasse 4 Gio`);
    }

    const crc = crc32(entree.contenu);
    const local = enTeteLocal(nom, crc, taille, dos);
    catalogue.push(enTeteCentral(nom, crc, taille, dos, decalage));
    nombre += 1;
    // La fin de catalogue compte les entrées sur deux octets. Au 65 536e
    // fichier, le compteur repartirait de zéro et l'archive s'ouvrirait vide
    // en paraissant intacte — le pire des échecs pour une sauvegarde.
    if (nombre > 0xffff) {
      throw new ArchiveTropVolumineuseError("plus de 65 535 fichiers");
    }

    yield local;
    yield entree.contenu;

    decalage += local.length + taille;
    if (decalage > LIMITE_ZIP) {
      throw new ArchiveTropVolumineuseError("l'ensemble dépasse 4 Gio");
    }
  }

  const catalogueOctets = Buffer.concat(catalogue);
  yield catalogueOctets;
  yield finDuCatalogue(nombre, catalogueOctets.length, decalage);
}
