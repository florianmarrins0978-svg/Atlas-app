import assert from "node:assert/strict";
import {
  porteEncoreDesMetadonnees,
  retirerMetadonnees,
  typeImageAccepte,
} from "../src/lib/exif";

/**
 * Le retrait des métadonnées — **sur l'octet, jamais sur parole**.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * **Le piège de cette suite, et il a une histoire dans ce dépôt.**
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Le 15 août 2026, une suite comparait deux largeurs pour dire si un texte
 * était coupé. Elle mesurait avant la mise en page : les deux valaient **0**,
 * `0 − 0 = 0`, « rien n'est coupé », en vert, sur un écran où trois noms
 * l'étaient. **Un contrôle qui mesure ZÉRO ne mesure rien**, et il est pire
 * qu'absent (`CLAUDE.md` §5).
 *
 * Ici, le même piège s'appelle : *vérifier le nettoyage avec la fonction de
 * nettoyage*. `porteEncoreDesMetadonnees` relit la structure du fichier
 * indépendamment, et chaque cas commence par **prouver que l'image de départ
 * portait bien quelque chose** — sinon on vérifierait qu'un fichier vide ne
 * contient rien, ce qui est vrai et ne prouve rien.
 *
 * Les images sont construites ici, octet par octet : aucune photo réelle n'est
 * versée au dépôt, et le fichier de départ est exactement ce qu'on croit.
 */

let echecs = 0;
function cas(nom: string, verifier: () => void) {
  try {
    verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${e instanceof Error ? e.message : e}`);
  }
}

// ── Fabriques d'images minimales ───────────────────────────────────────────

const GPS_TEMOIN = "GPS_DU_DOMICILE_DU_CLIENT";

/** Un segment JPEG `FF <marqueur> <longueur> <données>`. */
function segment(marqueur: number, contenu: Uint8Array): number[] {
  const longueur = contenu.length + 2;
  return [0xff, marqueur, (longueur >> 8) & 0xff, longueur & 0xff, ...contenu];
}

function texte(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function jpegAvecExif(): Uint8Array {
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

function pngAvecExif(): Uint8Array {
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

function webpAvecExif(): Uint8Array {
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

function contient(octets: Uint8Array, motif: string): boolean {
  return Buffer.from(octets).includes(motif);
}

console.log("\n=== Les types acceptés ===");

cas("liste blanche stricte", () => {
  assert.equal(typeImageAccepte("image/jpeg"), true);
  assert.equal(typeImageAccepte("image/JPEG"), true);
  assert.equal(typeImageAccepte("image/png"), true);
  assert.equal(typeImageAccepte("image/webp"), true);
  assert.equal(typeImageAccepte("image/heic"), false);
  assert.equal(typeImageAccepte("image/svg+xml"), false);
  assert.equal(typeImageAccepte("application/pdf"), false);
});

console.log("\n=== JPEG ===");

cas("l'image de départ porte BIEN les métadonnées — sinon le reste ne prouve rien", () => {
  const depart = jpegAvecExif();
  assert.ok(contient(depart, GPS_TEMOIN), "le témoin GPS doit être présent au départ");
  assert.equal(porteEncoreDesMetadonnees(depart, "image/jpeg"), true);
});

cas("après nettoyage : plus une trace du GPS", () => {
  const { octets, nettoye, retires } = retirerMetadonnees(jpegAvecExif(), "image/jpeg");
  assert.equal(nettoye, true);
  assert.equal(contient(octets, GPS_TEMOIN), false);
  assert.equal(porteEncoreDesMetadonnees(octets, "image/jpeg"), false);
  assert.deepEqual(retires.sort(), ["APP1", "APP13", "COM"].sort());
});

cas("APP0 (JFIF) et APP14 (Adobe) SURVIVENT — ce n'est pas un oubli", () => {
  const { octets } = retirerMetadonnees(jpegAvecExif(), "image/jpeg");
  assert.ok(contient(octets, "JFIF"), "APP0 porte la densité de l'image");
  assert.ok(contient(octets, "Adobe"), "APP14 porte la transformation de couleur");
});

cas("les données d'image sont intactes — nettoyer ne réencode rien", () => {
  const { octets } = retirerMetadonnees(jpegAvecExif(), "image/jpeg");
  const fin = Array.from(octets.subarray(octets.length - 6));
  assert.deepEqual(fin, [0x11, 0x22, 0x33, 0x44, 0xff, 0xd9]);
});

cas("un JPEG annoncé mais qui n'en est pas est REFUSÉ, pas laissé passer", () => {
  const { nettoye } = retirerMetadonnees(texte("ceci n'est pas une image"), "image/jpeg");
  assert.equal(nettoye, false, "laisser passer, ce serait affirmer un nettoyage qui n’a pas eu lieu");
});

cas("un fichier tronqué ne fait pas tomber l'action serveur", () => {
  const complet = jpegAvecExif();
  for (const taille of [2, 5, 12, 20, 30]) {
    const tronque = complet.subarray(0, taille);
    assert.doesNotThrow(() => retirerMetadonnees(tronque, "image/jpeg"));
  }
});

cas("une longueur de segment absurde n'entraîne pas de boucle infinie", () => {
  const piege = new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x00, 0xff, 0xd9]);
  assert.doesNotThrow(() => retirerMetadonnees(piege, "image/jpeg"));
});

console.log("\n=== PNG ===");

cas("l'image de départ porte bien eXIf et tEXt", () => {
  const depart = pngAvecExif();
  assert.ok(contient(depart, GPS_TEMOIN));
  assert.equal(porteEncoreDesMetadonnees(depart, "image/png"), true);
});

cas("eXIf, tEXt partent ; IHDR, IDAT et IEND restent", () => {
  const { octets, nettoye, retires } = retirerMetadonnees(pngAvecExif(), "image/png");
  assert.equal(nettoye, true);
  assert.equal(contient(octets, GPS_TEMOIN), false);
  assert.equal(porteEncoreDesMetadonnees(octets, "image/png"), false);
  assert.deepEqual(retires.sort(), ["eXIf", "tEXt"].sort());
  for (const garde of ["IHDR", "IDAT", "IEND"]) {
    assert.ok(contient(octets, garde), `${garde} doit survivre`);
  }
});

console.log("\n=== WebP ===");

cas("l'image de départ porte EXIF, XMP et les drapeaux VP8X correspondants", () => {
  const depart = webpAvecExif();
  assert.ok(contient(depart, GPS_TEMOIN));
  assert.equal(porteEncoreDesMetadonnees(depart, "image/webp"), true);
});

cas("les blocs partent ET les drapeaux VP8X sont éteints", () => {
  const { octets, nettoye, retires } = retirerMetadonnees(webpAvecExif(), "image/webp");
  assert.equal(nettoye, true);
  assert.equal(contient(octets, GPS_TEMOIN), false);
  assert.deepEqual(retires.sort(), ["EXIF", "XMP"].sort());
  // **Le geste qu'on oublie** : un décodeur qui lit un drapeau EXIF sans
  // trouver le bloc peut refuser l'image entière. On aurait alors « protégé »
  // une photo devenue illisible.
  assert.equal(porteEncoreDesMetadonnees(octets, "image/webp"), false);
});

cas("le drapeau Alpha survit — on n'éteint que ce qu'on retire", () => {
  const { octets } = retirerMetadonnees(webpAvecExif(), "image/webp");
  const debutVp8x = Buffer.from(octets).indexOf("VP8X");
  assert.notEqual(debutVp8x, -1);
  const drapeaux = octets[debutVp8x + 8];
  assert.equal(drapeaux & 0x10, 0x10, "Alpha doit rester allumé");
  assert.equal(drapeaux & 0x0c, 0, "EXIF et XMP doivent être éteints");
});

cas("la taille RIFF est mise à jour — sinon le fichier est invalide", () => {
  const { octets } = retirerMetadonnees(webpAvecExif(), "image/webp");
  const annoncee = new DataView(octets.buffer, octets.byteOffset, octets.byteLength).getUint32(4, true);
  assert.equal(annoncee, octets.length - 8);
});

console.log(
  echecs === 0 ? `\n✅ Toutes les vérifications passent.` : `\n❌ ${echecs} vérification(s) en échec.`
);
process.exit(echecs === 0 ? 0 : 1);
