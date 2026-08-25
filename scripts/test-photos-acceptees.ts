// Ce qu'Atlas accepte comme photo — et ce qu'il ne doit JAMAIS refuser.
//
// ─────────────────────────────────────────────────────────────────────────────
// **CETTE SUITE GARDE LES DEUX MOITIÉS, et la seconde compte autant.**
//
// Audit du 23 août 2026, constats M2 et M3. Les photos de chantier et les
// tickets de TVA acceptaient tout ce qui commence par `image/` — y compris
// `image/svg+xml`, qui est un DOCUMENT porteur de script, pas une image.
//
// Mais resserrer trop fermerait la porte au HEIC, le format natif de l'iPhone.
// Et « un outil qui refuse la photo qu'on vient de prendre est pire que le
// risque qu'il évite » : un artisan sur un chantier, ticket de caisse à la
// main, ne comprendrait pas — et ne reviendrait pas.
//
// Ni base, ni réseau, ni navigateur.

import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  ACCEPT_PHOTOS,
  MESSAGE_PHOTO_REFUSEE,
  TYPES_IMAGE_ACCEPTES,
  TYPES_PHOTO_ACCEPTES,
  extensionPhoto,
  photoAcceptee,
  retirerMetadonnees,
} from "../src/lib/exif";
import { typeDepuisCle } from "../src/lib/type-de-fichier";

let echecs = 0;
function essai(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}`);
    console.log(`    ${(e as Error).message}`);
  }
}

console.log("=== Les photos acceptées, et celles qu'on ne refuse jamais ===\n");

// ─── CE QUI EST FERMÉ ───────────────────────────────────────────────────────

essai("LE SVG EST REFUSÉ — c'est tout l'objet du constat M2", () => {
  for (const type of ["image/svg+xml", "image/svg+xml;charset=utf-8", "IMAGE/SVG+XML"]) {
    assert.equal(photoAcceptee(type), false, `« ${type} » est accepté`);
  }
});

essai("rien de ce qui s'exécute ne passe", () => {
  for (const type of ["text/html", "application/xhtml+xml", "text/javascript", "application/pdf", ""]) {
    assert.equal(photoAcceptee(type), false, `« ${type} » est accepté`);
  }
});

essai("« image/ » suivi de n'importe quoi ne suffit plus", () => {
  // C'est exactement ce que faisait `startsWith("image/")`.
  assert.equal(photoAcceptee("image/inventé"), false);
  assert.equal(photoAcceptee("image/"), false);
});

// ─── CE QUI RESTE OUVERT, ET QUI COMPTE AUTANT ──────────────────────────────

essai("LA PHOTO D'UN IPHONE N'EST JAMAIS REFUSÉE", () => {
  // Le HEIC ne porte aucun script. Le refuser ne protégerait de rien, et
  // coûterait une photo prise sur un chantier.
  assert.equal(photoAcceptee("image/heic"), true);
  assert.equal(photoAcceptee("image/heif"), true);
});

essai("les formats ordinaires passent, avec ou sans paramètre", () => {
  for (const type of ["image/jpeg", "image/png", "image/webp", "image/jpeg;charset=binary", " IMAGE/JPEG "]) {
    assert.equal(photoAcceptee(type), true, `« ${type} » est refusé`);
  }
});

// ─── L'ATTRIBUT `accept` : le piège de ce lot ───────────────────────────────

essai("L'ATTRIBUT `accept` NE CONTIENT PAS LE HEIC — et c'est délibéré", () => {
  /**
   * iOS regarde cette liste : sans HEIC dedans, il **transcode en JPEG** avant
   * l'envoi. L'y ajouter ferait l'inverse de ce qu'on croit — iOS cesserait de
   * transcoder, et nous recevrions des HEIC bruts, que le nettoyage ne sait pas
   * lire, donc rangés avec leurs coordonnées GPS.
   *
   * Ce contrôle existe pour qu'on ne « corrige » pas ça un jour en croyant bien
   * faire.
   */
  assert.ok(!/heic|heif/i.test(ACCEPT_PHOTOS), `l'accept porte le HEIC : « ${ACCEPT_PHOTOS} »`);
  assert.ok(!ACCEPT_PHOTOS.includes("*"), "l'accept est resté générique");
  for (const type of TYPES_IMAGE_ACCEPTES) {
    assert.ok(ACCEPT_PHOTOS.includes(type), `l'accept ne propose pas ${type}`);
  }
});

essai("la liste SERVEUR est plus large que l'attribut — c'est le filet", () => {
  // Un appareil qui ne transcode pas ne doit pas se heurter à un mur.
  assert.ok(
    TYPES_PHOTO_ACCEPTES.length > ACCEPT_PHOTOS.split(",").length,
    "le filet a disparu : le serveur n'accepte pas plus que ce que l'écran propose"
  );
  for (const type of TYPES_IMAGE_ACCEPTES) {
    assert.ok((TYPES_PHOTO_ACCEPTES as readonly string[]).includes(type), `${type} manque au serveur`);
  }
});

/**
 * Le code d'un fichier, ses commentaires retirés.
 *
 * **Le contrôle du dessous s'y est fait prendre, et c'était mérité.** Le
 * commentaire de `Pellicule.tsx` RACONTE le défaut — « ce contrôle cherchait
 * `accept="image/*"` en dur » — pour qu'on ne le refasse pas. Chercher cette
 * chaîne dans le fichier entier fait donc rougir sur la documentation qui
 * l'explique. Même piège que `test-confiance-hote.ts` et
 * `test-boutons-arrondis.ts`, même remède : on cherche du CODE.
 */
function codeSeul(chemin: string): string {
  return (
    readFileSync(chemin, "utf-8")
      .split("\n")
      // **LES LIGNES `//` D'ABORD, LES BLOCS ENSUITE — et l'ordre est tout.**
      //
      // La chaîne qu'on cherche, `image/*`, contient elle-même `/*`. Retirer
      // les blocs en premier faisait donc ouvrir un faux commentaire sur la
      // ligne de commentaire qui la cite, et le stripper avalait tout jusqu'au
      // `*/` suivant — c'est-à-dire l'attribut réel qu'on venait vérifier. Le
      // contrôle rougissait sur un écran parfaitement juste.
      //
      // Trouvé en sondant ce que `codeSeul` rend vraiment, plutôt qu'en
      // raisonnant sur ce qu'il devrait rendre.
      .filter((l) => !l.trim().startsWith("//"))
      .join("\n")
      .replace(/\/\*[\s\S]*?\*\//g, "")
  );
}

essai("LES QUATRE ÉCRANS emploient le même attribut — jamais `image/*` recopié", () => {
  // Le danger de ce lot est de resserrer d'un côté seulement. Une constante
  // partagée le rend impossible ; ce contrôle vérifie qu'on l'emploie vraiment.
  const racine = path.join(__dirname, "..");
  const ecrans = [
    "src/app/chantiers/[id]/Pellicule.tsx",
    "src/app/termines/tva/AchatsTva.tsx",
    "src/app/paysage/arrosage/ArrosageClient.tsx",
    "src/app/paysage/diagnostic/PrendreUnePhoto.tsx",
  ];
  for (const ecran of ecrans) {
    const code = codeSeul(path.join(racine, ecran));
    assert.ok(!/accept="image\/\*"/.test(code), `${ecran} porte encore accept="image/*"`);
    // **Et l'absence de `image/*` ne suffit PAS.** Le diagnostic recopiait la
    // liste à l'identique — donc juste, donc invisible, jusqu'au jour où la
    // liste bouge ailleurs et où lui reste en arrière. On exige la constante.
    assert.match(
      code,
      /accept=\{ACCEPT_PHOTOS\}/,
      `${ecran} recopie la liste au lieu d'employer ACCEPT_PHOTOS`
    );
  }
});

essai("…et ce contrôle SAIT ENCORE voir un vrai `image/*`", () => {
  // Un contrôle qu'on vient de rendre plus tolérant doit prouver qu'il n'est
  // pas devenu aveugle. On lui donne du code, et du commentaire.
  const bac = mkdtempSync(path.join(tmpdir(), "atlas-accept-"));
  try {
    const coupable = path.join(bac, "coupable.tsx");
    writeFileSync(coupable, '<input type="file" accept="image/*" />');
    assert.match(codeSeul(coupable), /accept="image\/\*"/, "le contrôle ne voit plus un vrai accept");

    const innocent = path.join(bac, "innocent.tsx");
    writeFileSync(innocent, '// on cherchait accept="image/*" en dur\n<input accept={ACCEPT_PHOTOS} />');
    assert.ok(!/accept="image\/\*"/.test(codeSeul(innocent)), "un commentaire fait encore rougir");
  } finally {
    rmSync(bac, { recursive: true, force: true });
  }
});

// ─── LE NETTOYAGE : il ne refuse jamais ─────────────────────────────────────

essai("UN FORMAT QU'ON NE SAIT PAS NETTOYER SE RANGE QUAND MÊME", () => {
  // La règle qui décide de tout le reste. `retirerMetadonnees` rend les octets
  // d'origine plutôt que de lever : l'appelant range, et journalise.
  const heic = new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]);
  const r = retirerMetadonnees(heic, "image/heic");
  assert.equal(r.nettoye, false, "un HEIC serait annoncé comme nettoyé — la colonne mentirait");
  assert.deepEqual(Array.from(r.octets), Array.from(heic), "les octets ont été perdus");
});

essai("un fichier ABÎMÉ ne lève pas et ne perd pas la photo", () => {
  const abime = new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0xff, 0xff]);
  const r = retirerMetadonnees(abime, "image/jpeg");
  assert.equal(r.octets.length > 0, true, "les octets ont disparu");
});

// ─── L'EXTENSION décide du type servi ───────────────────────────────────────

essai("l'extension posée et le type servi s'accordent, pour CHAQUE format", () => {
  // Une extension fausse ferait servir une image sous un autre type — ou pas du
  // tout. C'est le lien entre `exif.ts` et `type-de-fichier.ts`, et rien
  // d'autre ne le tient.
  const attendu: Record<string, string> = {
    "image/jpeg": "image/jpeg",
    "image/png": "image/png",
    "image/webp": "image/webp",
    "image/heic": "image/heic",
    "image/heif": "image/heif",
  };
  for (const type of TYPES_PHOTO_ACCEPTES) {
    const cle = `chantiers/a/photos/b${extensionPhoto(type)}`;
    assert.equal(typeDepuisCle(cle), attendu[type], `${type} → ${extensionPhoto(type)} → ${typeDepuisCle(cle)}`);
  }
});

// ─── Le message ─────────────────────────────────────────────────────────────

essai("le refus dit QUOI FAIRE, et n'accuse pas l'artisan", () => {
  assert.ok(MESSAGE_PHOTO_REFUSEE.length > 30);
  assert.match(MESSAGE_PHOTO_REFUSEE, /JPEG|PNG/);
  assert.ok(!/interdit|refusé|erreur/i.test(MESSAGE_PHOTO_REFUSEE), MESSAGE_PHOTO_REFUSEE);
});

console.log("");
console.log(`Photos acceptées — ${echecs} échec(s).`);
process.exit(echecs > 0 ? 1 : 0);
