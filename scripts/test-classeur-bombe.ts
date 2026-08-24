// Un classeur piégé ne doit pas coucher le serveur.
//
// ─────────────────────────────────────────────────────────────────────────────
// **CE QUE CETTE SUITE PROTÈGE, et pourquoi elle fabrique une VRAIE bombe.**
//
// Audit du 23 août 2026, constat M5. Un `.xlsx` est un ZIP, et `deflate`
// dépasse mille pour un sur du texte répété : les 5 Mo qu'accepte l'écran
// d'import rendaient plusieurs gigaoctets une fois gonflés. Le serveur mourait
// d'épuisement mémoire — sans message, sans journal, en emportant les requêtes
// de tout le monde.
//
// **On ne simule pas ce défaut : on l'assemble.** Une archive écrite ici à la
// main, avec un `sheet1.xml` de deux cents mégaoctets d'un seul caractère
// répété, qui tient en quelques kilo-octets une fois compressé. C'est
// exactement ce qu'un fichier malveillant contiendrait, et c'est ce que le
// lecteur doit refuser.
//
// **Vue rouge contre la version d'avant** : sans `maxOutputLength`, ce même
// fichier fait gonfler le processus jusqu'à ce que Node l'abatte.
//
// Ni base, ni réseau, ni navigateur.

import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import { lireClasseur } from "../src/server/import/lire-classeur";

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

/**
 * Assembler un ZIP à la main — en-tête local, répertoire central, fin de
 * répertoire. Le dépôt écrit déjà ses archives ainsi (`src/lib/archive-zip.ts`)
 * et le lecteur les lit ainsi : passer par une bibliothèque ici éprouverait la
 * bibliothèque, pas notre lecteur.
 */
function archiverUneEntree(nom: string, contenu: Buffer): Buffer {
  const nomOctets = Buffer.from(nom, "utf8");
  const compresse = deflateRawSync(contenu);

  const enTeteLocal = Buffer.alloc(30);
  enTeteLocal.writeUInt32LE(0x04034b50, 0);
  enTeteLocal.writeUInt16LE(20, 4); // version nécessaire
  enTeteLocal.writeUInt16LE(8, 8); // méthode : deflate
  enTeteLocal.writeUInt32LE(0, 14); // CRC — jamais lu par notre lecteur
  enTeteLocal.writeUInt32LE(compresse.length, 18);
  enTeteLocal.writeUInt32LE(contenu.length, 22);
  enTeteLocal.writeUInt16LE(nomOctets.length, 26);
  enTeteLocal.writeUInt16LE(0, 28);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(8, 10);
  central.writeUInt32LE(0, 16);
  central.writeUInt32LE(compresse.length, 20);
  central.writeUInt32LE(contenu.length, 24);
  central.writeUInt16LE(nomOctets.length, 28);
  central.writeUInt32LE(0, 42); // décalage de l'en-tête local

  const debutCentral = enTeteLocal.length + nomOctets.length + compresse.length;
  const tailleCentral = central.length + nomOctets.length;

  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(1, 8); // entrées sur ce disque
  fin.writeUInt16LE(1, 10); // entrées au total
  fin.writeUInt32LE(tailleCentral, 12);
  fin.writeUInt32LE(debutCentral, 16);

  return Buffer.concat([enTeteLocal, nomOctets, compresse, central, nomOctets, fin]);
}

console.log("=== Un classeur piégé ne couche pas le serveur ===\n");

// ─── D'abord : le lecteur lit encore les vrais classeurs ────────────────────
//
// Un contrôle qui refuserait tout passerait cette suite au vert en cassant la
// fonctionnalité. On éprouve donc les deux moitiés.

essai("un classeur ORDINAIRE se lit toujours", () => {
  const feuille = `<?xml version="1.0"?><worksheet><sheetData>
    <row r="1"><c r="A1" t="inlineStr"><is><t>Tonte</t></is></c><c r="B1"><v>45</v></c></row>
    <row r="2"><c r="A2" t="inlineStr"><is><t>Taille de haie</t></is></c><c r="B2"><v>38.5</v></c></row>
  </sheetData></worksheet>`;
  const lignes = lireClasseur(archiverUneEntree("xl/worksheets/sheet1.xml", Buffer.from(feuille, "utf8")));
  assert.equal(lignes.length, 2, `lu ${lignes.length} ligne(s) au lieu de 2`);
  assert.equal(lignes[0][0], "Tonte");
  assert.equal(lignes[1][1], "38.5");
});

// ─── La bombe ───────────────────────────────────────────────────────────────

essai("UNE BOMBE DE DÉCOMPRESSION EST REFUSÉE, sans faire tomber le serveur", () => {
  // Deux cents mégaoctets d'un seul caractère : quelques kilo-octets compressés.
  // C'est très au-dessus de la borne de trente-deux, et très en dessous de ce
  // qu'un attaquant peut se permettre — il a droit à 5 Mo de fichier.
  const enorme = Buffer.alloc(200 * 1024 * 1024, 0x41);
  const piege = archiverUneEntree("xl/worksheets/sheet1.xml", enorme);

  console.log(`    (l'archive piégée pèse ${Math.round(piege.length / 1024)} ko et rendrait 200 Mo)`);
  assert.ok(piege.length < 5_000_000, "l'archive d'essai dépasse ce que l'écran accepte : le cas ne serait pas réaliste");

  const avant = process.memoryUsage().heapUsed;
  const lignes = lireClasseur(piege);
  const apres = process.memoryUsage().heapUsed;

  // **Rien n'est rendu, et rien n'est levé** : l'écran dira « je n'ai rien
  // reconnu dans ce fichier », ce qui est vrai.
  assert.deepEqual(lignes, [], "une bombe a rendu des lignes");
  // Et surtout : la mémoire n'a pas explosé. Sans `maxOutputLength`, ce même
  // appel gonfle le tas de deux cents mégaoctets avant de rendre la main.
  const pris = (apres - avant) / (1024 * 1024);
  assert.ok(pris < 64, `le lecteur a pris ${Math.round(pris)} Mo de tas — la borne ne tient pas`);
});

// ─── Les archives forgées ───────────────────────────────────────────────────

essai("un nombre d'entrées inventé ne fait pas tourner la boucle à vide", () => {
  // Le nombre d'entrées est écrit DANS l'archive, donc par celui qui la dépose.
  const piege = archiverUneEntree("xl/worksheets/sheet1.xml", Buffer.from("<x/>", "utf8"));
  piege.writeUInt16LE(65535, piege.length - 22 + 10);
  const debut = Date.now();
  assert.deepEqual(lireClasseur(piege), []);
  assert.ok(Date.now() - debut < 2000, "le balayage a duré : la borne d'entrées ne tient pas");
});

essai("un décalage hors du fichier est refusé, pas levé", () => {
  const piege = archiverUneEntree("xl/worksheets/sheet1.xml", Buffer.from("<x/>", "utf8"));
  // On envoie le début du répertoire central au-delà de la fin de l'archive.
  piege.writeUInt32LE(0x7fffffff, piege.length - 22 + 16);
  assert.deepEqual(lireClasseur(piege), []);
});

essai("une archive tronquée ne lève rien", () => {
  const entier = archiverUneEntree("xl/worksheets/sheet1.xml", Buffer.from("<x/>", "utf8"));
  for (const garde of [10, 40, entier.length - 5]) {
    assert.deepEqual(lireClasseur(entier.subarray(0, garde)), [], `tronquée à ${garde} octets`);
  }
});

essai("un fichier qui n'est pas un ZIP du tout ne lève rien", () => {
  assert.deepEqual(lireClasseur(Buffer.from("bonjour, ceci n'est pas un classeur")), []);
});

console.log("");
console.log(`Classeur piégé — ${echecs} échec(s).`);
process.exit(echecs > 0 ? 1 : 0);
