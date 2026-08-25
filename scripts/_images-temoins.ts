/**
 * Des images minimales, avec un témoin de métadonnée reconnaissable.
 *
 * **Pourquoi ces fabriques vivent ICI et non dans une suite.** Deux suites en
 * ont besoin — `test-exif-diagnostic.ts` (le nettoyage lui-même) et
 * `test-photo-entrante.ts` (la porte d'entrée qui refuse) — et deux jeux
 * d'images d'essai divergeraient : l'un finirait par ne plus contenir de
 * métadonnée du tout, et sa suite passerait au vert en ne prouvant rien.
 *
 * Le préfixe `_` les tient hors de la découverte des suites
 * (`run-all-tests.ts` ne prend que `test-*`).
 *
 * **Ce ne sont pas de vraies images** — pas de pixels décodables — et c'est
 * suffisant : le nettoyage travaille sur la STRUCTURE des fichiers, segments et
 * blocs, pas sur leur contenu visuel.
 */

export const GPS_TEMOIN = "GPS_DU_DOMICILE_DU_CLIENT";

/** Un segment JPEG `FF <marqueur> <longueur> <données>`. */
export function segment(marqueur: number, contenu: Uint8Array): number[] {
  const longueur = contenu.length + 2;
  return [0xff, marqueur, (longueur >> 8) & 0xff, longueur & 0xff, ...contenu];
}

export function texte(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

export function jpegAvecExif(): Uint8Array {
  return new Uint8Array([
    0xff, 0xd8, // SOI
    ...segment(0xe0, texte("JFIF\0")), // APP0 — doit SURVIVRE
    ...segment(0xe1, texte(`Exif\0\0${GPS_TEMOIN}`)), // APP1 — doit partir
    ...segment(0xed, texte("Photoshop IPTC")), // APP13 — doit partir
    ...segment(0xfe, texte("commentaire")), // COM — doit partir
    ...segment(0xee, texte("Adobe")), // APP14 — doit SURVIVRE (couleurs)
    ...segment(0xdb, new Uint8Array(8)), // table de quantification — survit
    0xff, 0xda, 0x00, 0x03, 0x01, // SOS puis données compressées
    0x11, 0x22, 0x33, 0x44,
    0xff, 0xd9, // EOI
  ]);
}

function bloc(type: string, donnees: Uint8Array): number[] {
  const n = donnees.length;
  return [
    (n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff,
    ...texte(type),
    ...donnees,
    0, 0, 0, 0, // CRC — jamais recalculé : on ne retire que des blocs entiers
  ];
}

export function pngAvecExif(): Uint8Array {
  return new Uint8Array([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ...bloc("IHDR", new Uint8Array(13)),
    ...bloc("eXIf", texte(GPS_TEMOIN)),
    ...bloc("tEXt", texte("Author\0quelqu'un")),
    ...bloc("IDAT", new Uint8Array([1, 2, 3, 4])),
    ...bloc("IEND", new Uint8Array(0)),
  ]);
}

function chunkRiff(fourcc: string, donnees: Uint8Array): number[] {
  const n = donnees.length;
  const corps = [
    ...texte(fourcc),
    n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff,
    ...donnees,
  ];
  if (n % 2 === 1) corps.push(0);
  return corps;
}

export function webpAvecExif(): Uint8Array {
  // VP8X : 10 octets, premier octet = drapeaux. 0x08 = EXIF, 0x04 = XMP.
  const vp8x = new Uint8Array(10);
  vp8x[0] = 0x08 | 0x04 | 0x10; // EXIF + XMP + Alpha (l'alpha doit survivre)
  const corps = [
    ...chunkRiff("VP8X", vp8x),
    ...chunkRiff("VP8 ", new Uint8Array([9, 9, 9, 9])),
    ...chunkRiff("EXIF", texte(GPS_TEMOIN)),
    ...chunkRiff("XMP ", texte("<x:xmpmeta/>")),
  ];
  const taille = 4 + corps.length;
  return new Uint8Array([
    ...texte("RIFF"),
    taille & 0xff, (taille >>> 8) & 0xff, (taille >>> 16) & 0xff, (taille >>> 24) & 0xff,
    ...texte("WEBP"),
    ...corps,
  ]);
}

export function contient(octets: Uint8Array, motif: string): boolean {
  return Buffer.from(octets).includes(motif);
}


/**
 * Un VRAI JPEG de la taille demandée, métadonnées comprises.
 *
 * **Pourquoi il a fallu l'écrire, le 24 août 2026.** Les suites éprouvaient les
 * bornes de taille avec `new Uint8Array(500_000)` annoncé `image/jpeg` — un
 * demi-mégaoctet de zéros. Tant que le serveur croyait le type déclaré, cela
 * suffisait. Depuis que la signature est vérifiée (`preparerPhotoEntrante`), ce
 * fichier est refusé **à juste titre**, et la suite rougissait sur du code sain.
 *
 * Le remplissage est posé APRÈS le début du balayage (`SOS`) : le nettoyeur
 * recopie tout ce qui suit sans l'interpréter, exactement comme les données
 * compressées d'une vraie photo.
 */
export function jpegDeTaille(octets: number): Uint8Array {
  const modele = jpegAvecExif();
  const finIndex = modele.length - 2; // avant EOI (FFD9)
  const remplissage = Math.max(0, octets - modele.length);
  const sortie = new Uint8Array(modele.length + remplissage);
  sortie.set(modele.subarray(0, finIndex), 0);
  // Un remplissage neutre : jamais 0xFF, qui serait lu comme un marqueur.
  sortie.fill(0x5a, finIndex, finIndex + remplissage);
  sortie.set(modele.subarray(finIndex), finIndex + remplissage);
  return sortie;
}
