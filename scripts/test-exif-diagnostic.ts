import assert from "node:assert/strict";
import { GPS_TEMOIN, contient, jpegAvecExif, pngAvecExif, segment, texte, webpAvecExif } from "./_images-temoins";
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

// **Sa photo de profil du 27 octobre 2026, couchée sur le côté.** Un iPhone
// range les pixels comme le capteur les voit, et dit dans l'EXIF de quel côté
// tenir l'image (« Orientation »). Retirer tout l'APP1 retirait aussi ce mot,
// et chaque photo prise en portrait s'affichait couchée. L'orientation n'est
// pas une donnée personnelle : elle survit, et elle seule.

/** Un APP1 EXIF comme celui d'un téléphone : l'orientation, et un GPS derrière. */
function jpegTenuDeCote(orientation: number, ordre: "II" | "MM"): Uint8Array {
  const petit = ordre === "II";
  const u16 = (v: number) => (petit ? [v & 0xff, v >> 8] : [v >> 8, v & 0xff]);
  const u32 = (v: number) => (petit ? [v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, v >>> 24] : [v >>> 24, (v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff]);
  const tiff = [
    ...texte(ordre), ...u16(42), ...u32(8),
    ...u16(2),
    ...u16(0x0112), ...u16(3), ...u32(1), ...u16(orientation), 0, 0,
    ...u16(0x8825), ...u16(4), ...u32(1), ...u32(38),
    ...u32(0),
    ...texte(GPS_TEMOIN),
  ];
  return new Uint8Array([
    0xff, 0xd8,
    ...segment(0xe0, texte("JFIF\0")),
    ...segment(0xe1, new Uint8Array([...texte("Exif\0\0"), ...tiff])),
    0xff, 0xda, 0x00, 0x03, 0x01, 0x11, 0x22, 0xff, 0xd9,
  ]);
}

/** L'orientation relue À LA MAIN, sans la fonction éprouvée : grand-boutiste, une seule entrée. */
function orientationRelue(octets: Uint8Array): number | null {
  for (let i = 2; i + 4 < octets.length; i++) {
    if (octets[i] === 0xff && octets[i + 1] === 0xe1) {
      for (let j = i + 4; j + 9 < octets.length; j++) {
        if (octets[j] === 0x01 && octets[j + 1] === 0x12) return (octets[j + 8] << 8) | octets[j + 9];
      }
    }
  }
  return null;
}

cas("une photo tenue de côté garde son orientation, et rien d'autre", () => {
  for (const ordre of ["MM", "II"] as const) {
    const depart = jpegTenuDeCote(6, ordre);
    assert.ok(contient(depart, GPS_TEMOIN), "le témoin GPS doit être présent au départ");
    const { octets, nettoye, retires } = retirerMetadonnees(depart, "image/jpeg");
    assert.equal(nettoye, true);
    assert.equal(contient(octets, GPS_TEMOIN), false, `GPS resté (${ordre})`);
    assert.equal(orientationRelue(octets), 6, `orientation perdue (${ordre})`);
    assert.deepEqual(retires, ["APP1"]);
    assert.equal(porteEncoreDesMetadonnees(octets, "image/jpeg"), false, "l'orientation seule n'est pas une métadonnée à retirer");
  }
});

cas("une photo déjà droite ne garde aucun APP1", () => {
  const { octets } = retirerMetadonnees(jpegTenuDeCote(1, "MM"), "image/jpeg");
  assert.equal(orientationRelue(octets), null);
  assert.equal(contient(octets, "Exif"), false);
});

cas("un APP1 qui n'est que l'orientation mais porte un octet de trop reste une métadonnée", () => {
  const { octets } = retirerMetadonnees(jpegTenuDeCote(6, "MM"), "image/jpeg");
  const k = octets.indexOf(0xe1) - 1;
  const longueur = (octets[k + 2] << 8) | octets[k + 3];
  const gonfle = new Uint8Array([...octets.subarray(0, k), 0xff, 0xe1, (longueur + 1) >> 8, (longueur + 1) & 0xff, ...octets.subarray(k + 4, k + 2 + longueur), 0x47, ...octets.subarray(k + 2 + longueur)]);
  assert.equal(porteEncoreDesMetadonnees(gonfle, "image/jpeg"), true);
});

cas("un EXIF dont les adresses mentent ne fait rien tomber, et part entier", () => {
  const depart = jpegTenuDeCote(6, "MM");
  const tiff = depart.indexOf(0x4d);
  for (const k of [4, 5, 6, 7]) {
    const abime = depart.slice();
    abime[tiff + k] = 0xff;
    const r = retirerMetadonnees(abime, "image/jpeg");
    assert.equal(r.nettoye, true);
    assert.equal(contient(r.octets, GPS_TEMOIN), false);
    assert.equal(contient(r.octets, "Exif"), false);
  }
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
