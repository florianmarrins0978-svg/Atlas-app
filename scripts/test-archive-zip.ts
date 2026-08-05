import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { ArchiveTropVolumineuseError, crc32, ecrireArchiveZip, type EntreeArchive } from "../src/lib/archive-zip";

// Un format écrit à la main ne se prouve pas en se relisant.
//
// La seule preuve qui vaille est qu'un décompresseur du système ouvre
// l'archive et en ressorte les octets exacts. `unzip` est donc l'arbitre de
// cette suite : un en-tête faux, un décalage d'un octet, un CRC mal calculé
// s'y voient tout de suite — et ne se verraient nulle part ailleurs.

let echecs = 0;
function cas(nom: string, verifier: () => void | Promise<void>): Promise<void> {
  return Promise.resolve()
    .then(verifier)
    .then(() => console.log(`  ✓ ${nom}`))
    .catch((e: Error) => {
      echecs++;
      console.error(`  ✗ ${nom}\n    ${e.message}`);
    });
}

const LE_5_AOUT = new Date("2026-08-05T14:30:00Z");

async function construire(entrees: EntreeArchive[], maintenant = LE_5_AOUT): Promise<Buffer> {
  const morceaux: Uint8Array[] = [];
  for await (const m of ecrireArchiveZip(entrees, maintenant)) morceaux.push(m);
  return Buffer.concat(morceaux);
}

/** Écrit l'archive sur disque, l'extrait avec `unzip`, rend le dossier obtenu. */
function extraire(archive: Buffer): { dossier: string; nettoyer: () => void } {
  const dossier = mkdtempSync(path.join(tmpdir(), "atlas-zip-"));
  const fichier = path.join(dossier, "archive.zip");
  writeFileSync(fichier, archive);
  execFileSync("unzip", ["-q", fichier, "-d", path.join(dossier, "sortie")]);
  return { dossier, nettoyer: () => rmSync(dossier, { recursive: true, force: true }) };
}

async function main() {
  console.log("=== Archive ZIP écrite à la main ===\n");

  await cas("le CRC-32 est celui de la référence connue", () => {
    // Valeur publiée pour « The quick brown fox jumps over the lazy dog ».
    assert.equal(crc32(Buffer.from("The quick brown fox jumps over the lazy dog")), 0x414fa339);
    assert.equal(crc32(Buffer.from("")), 0);
  });

  await cas("unzip -t déclare l'archive saine", async () => {
    const archive = await construire([
      { nom: "donnees.json", contenu: Buffer.from('{"clients":[]}') },
      { nom: "fichiers/photo.bin", contenu: Buffer.from([0, 1, 2, 255, 254]) },
    ]);
    const { dossier, nettoyer } = extraire(archive);
    try {
      const sortie = execFileSync("unzip", ["-t", path.join(dossier, "archive.zip")]).toString();
      assert.match(sortie, /No errors detected/);
    } finally {
      nettoyer();
    }
  });

  await cas("les octets ressortent identiques, texte et binaire", async () => {
    // Un binaire qui contient la signature d'un en-tête local : si le
    // catalogue était mal placé, un lecteur s'y perdrait.
    const piege = Buffer.concat([Buffer.from([0x50, 0x4b, 0x03, 0x04]), Buffer.alloc(300, 0xab)]);
    const texte = "Chêne mort à abattre — 20 m\nHaie de laurier, 20 ml\n";
    const archive = await construire([
      { nom: "donnees.json", contenu: Buffer.from(texte, "utf8") },
      { nom: "fichiers/piege.bin", contenu: piege },
    ]);
    const { dossier, nettoyer } = extraire(archive);
    try {
      const relu = readFileSync(path.join(dossier, "sortie", "donnees.json"), "utf8");
      assert.equal(relu, texte);
      const reluBin = readFileSync(path.join(dossier, "sortie", "fichiers", "piege.bin"));
      assert.ok(reluBin.equals(piege), "le binaire ressort différent");
    } finally {
      nettoyer();
    }
  });

  await cas("un nom accentué ressort accentué", async () => {
    const archive = await construire([{ nom: "fichiers/chêne-mort.txt", contenu: Buffer.from("ok") }]);
    const { dossier, nettoyer } = extraire(archive);
    try {
      const relu = readFileSync(path.join(dossier, "sortie", "fichiers", "chêne-mort.txt"), "utf8");
      assert.equal(relu, "ok");
    } finally {
      nettoyer();
    }
  });

  await cas("un fichier vide est accepté et ressort vide", async () => {
    const archive = await construire([
      { nom: "vide.txt", contenu: Buffer.alloc(0) },
      { nom: "plein.txt", contenu: Buffer.from("suite") },
    ]);
    const { dossier, nettoyer } = extraire(archive);
    try {
      assert.equal(readFileSync(path.join(dossier, "sortie", "vide.txt")).length, 0);
      assert.equal(readFileSync(path.join(dossier, "sortie", "plein.txt"), "utf8"), "suite");
    } finally {
      nettoyer();
    }
  });

  await cas("une archive sans aucune entrée reste reconnue comme une archive", async () => {
    // Cas de garde : l'export réel porte toujours au moins son mode d'emploi.
    // `unzip` répond « zipfile is empty » ET sort en erreur — c'est sa
    // convention pour une archive vide, pas un défaut de structure. Ce qu'on
    // vérifie est donc qu'il la RECONNAÎT, jamais qu'il l'extrait.
    const archive = await construire([]);
    assert.equal(archive.length, 22, "une archive vide se réduit à sa fin de catalogue");
    const dossier = mkdtempSync(path.join(tmpdir(), "atlas-zip-"));
    const fichier = path.join(dossier, "archive.zip");
    writeFileSync(fichier, archive);
    try {
      let sortie = "";
      try {
        sortie = execFileSync("unzip", ["-l", fichier], { stdio: ["ignore", "pipe", "pipe"] }).toString();
      } catch (e) {
        const err = e as { stdout?: Buffer; stderr?: Buffer };
        sortie = `${err.stdout?.toString() ?? ""}${err.stderr?.toString() ?? ""}`;
      }
      assert.match(sortie, /zipfile is empty/);
      assert.doesNotMatch(sortie, /cannot find|not a zipfile|End-of-central-directory signature not found/);
    } finally {
      rmSync(dossier, { recursive: true, force: true });
    }
  });

  await cas("l'archive est produite au fil de l'eau, pas d'un bloc", async () => {
    // Ce que le générateur garantit : la deuxième entrée n'est pas LUE tant
    // que la première n'est pas ÉCRITE. C'est ce qui empêche une sauvegarde de
    // trois cents mégaoctets de tenir en mémoire.
    const lues: string[] = [];
    async function* source(): AsyncGenerator<EntreeArchive> {
      lues.push("a");
      yield { nom: "a.txt", contenu: Buffer.from("a") };
      lues.push("b");
      yield { nom: "b.txt", contenu: Buffer.from("b") };
    }
    const flux = ecrireArchiveZip(source(), LE_5_AOUT);
    await flux.next(); // en-tête de « a »
    assert.deepEqual(lues, ["a"], "la seconde entrée a été lue trop tôt");
    for await (const _ of flux) void _;
    assert.deepEqual(lues, ["a", "b"]);
  });

  await cas("un fichier de plus de 4 Gio est refusé, pas tronqué", async () => {
    // Le contrôle doit savoir échouer : on lui présente l'état dégradé sans
    // allouer 4 Gio, en mentant sur la seule chose qu'il regarde.
    const enorme = { nom: "trop.bin", contenu: { length: 0x100000000 } as unknown as Uint8Array };
    await assert.rejects(
      async () => {
        for await (const _ of ecrireArchiveZip([enorme], LE_5_AOUT)) void _;
      },
      (e: Error) => {
        assert.ok(e instanceof ArchiveTropVolumineuseError, `type inattendu : ${e.name}`);
        // Le message doit désigner le bon coupable : le fichier, nommé.
        assert.match(e.message, /trop\.bin/);
        assert.match(e.message, /ZIP64/);
        return true;
      }
    );
  });

  await cas("au-delà de 65 535 fichiers, l'archive est refusée", async () => {
    // Le compteur d'entrées tient sur deux octets : au 65 536e, il repart de
    // zéro et l'archive s'ouvre VIDE en paraissant intacte. Un `unzip -t` la
    // déclarerait saine — c'est la panne qu'aucun contrôle d'intégrité ne voit.
    function* beaucoup(): Generator<EntreeArchive> {
      const contenu = Buffer.from("x");
      for (let i = 0; i <= 0xffff; i += 1) yield { nom: `f${i}`, contenu };
    }
    await assert.rejects(
      async () => {
        for await (const _ of ecrireArchiveZip(beaucoup(), LE_5_AOUT)) void _;
      },
      (e: Error) => {
        assert.ok(e instanceof ArchiveTropVolumineuseError, `type inattendu : ${e.name}`);
        assert.match(e.message, /65 535 fichiers/);
        return true;
      }
    );
  });

  await cas("l'horodatage écrit est celui qu'on lui donne", async () => {
    const archive = await construire([{ nom: "a.txt", contenu: Buffer.from("a") }], new Date(2026, 7, 5, 14, 30, 0));
    const { dossier, nettoyer } = extraire(archive);
    try {
      const sortie = execFileSync("unzip", ["-l", path.join(dossier, "archive.zip")]).toString();
      assert.match(sortie, /2026-08-05 14:30/);
    } finally {
      nettoyer();
    }
  });

  console.log(`\n${echecs === 0 ? "✅ Toutes les vérifications passent." : `❌ ${echecs} échec(s).`}`);
  process.exit(echecs === 0 ? 0 : 1);
}

void main();
