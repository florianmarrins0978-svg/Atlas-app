// UN AUDIO N'EST ACCEPTÉ QUE SI ATLAS RECONNAÎT SON FORMAT — lot Audio.
//
// ═══════════════════════════════════════════════════════════════════════════
// **LA PROPRIÉTÉ VISÉE, telle que le patron l'a posée le 26 août 2026 :**
//
//   « Un fichier audio n'est accepté, stocké ou envoyé à un fournisseur de
//     transcription que si Atlas peut identifier son format avec un niveau de
//     confiance suffisant. Le type déclaré par le navigateur peut aider à
//     vérifier la cohérence, mais ne doit jamais constituer à lui seul la
//     décision finale. »
//
// **Format inconnu → REFUS.** C'est sa correction à ma proposition, et elle est
// juste : « laisser passer quand la signature est illisible » aurait gardé une
// moitié du défaut. Sa règle vaut aussi pour la suite : si un format légitime
// échoue chez lui, **on n'ouvre pas de repli sur `File.type`, on élargit la
// reconnaissance**.
//
// ═══════════════════════════════════════════════════════════════════════════
// **CE QUE CETTE SUITE NE PROMET PAS.**
//
// Reconnaître un format n'est pas garantir qu'un son se décode. Un WebM coupé
// en plein enregistrement garde son en-tête et reste reconnaissable ; s'il porte
// du son, c'est la transcription qui le dira. Prétendre le contraire serait
// promettre ce qu'on ne tient pas.
//
// **Et les deux moitiés comptent autant l'une que l'autre.** Refuser tout est
// facile ; ce qui est difficile, c'est de refuser les hostiles SANS refuser une
// dictée d'iPhone sur un chantier. C'est la moitié « les vrais passent » qui
// rend cette suite honnête.

import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  temoinWebm,
  temoinM4aIphone,
  temoinMp4Isom,
  temoinOggOpus,
  temoinWav,
  temoinFlac,
  temoinMp3AvecId3,
  temoinMp3SansId3,
  temoinAacAdts,
  temoinHtml,
  temoinSvg,
  temoinZip,
  temoinFausseSynchroMp3,
  temoinFausseSynchroAac,
} from "./_temoins-audio";
import { reconnaitreAudio, decrireAudioEntrant } from "../src/lib/signature-audio";
import { TYPES_AUDIO_AUTORISES } from "../src/server/upload-limits";

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

function main() {
  console.log("Signature audio : le format se lit dans les octets, jamais dans l'en-tête du navigateur\n");

  // ─── LES VRAIS PASSENT — la moitié qui protège du remède ──────────────────

  const vrais = [
    ["WebM/Opus — Chrome, Android et PC", temoinWebm(), "webm"],
    ["MP4/M4A — Safari, iPhone", temoinM4aIphone(), "mp4"],
    ["MP4 marque isom", temoinMp4Isom(), "mp4"],
    ["OGG/Opus — Firefox", temoinOggOpus(), "ogg"],
    ["WAV", temoinWav(), "wav"],
    ["FLAC", temoinFlac(), "flac"],
    ["MP3 avec étiquette ID3", temoinMp3AvecId3(), "mp3"],
    ["MP3 SANS ID3, trames seules", temoinMp3SansId3(), "mp3"],
    ["AAC brut (ADTS)", temoinAacAdts(), "aac"],
  ] as const;

  for (const [quoi, octets, attendu] of vrais) {
    essai(`${quoi} est reconnu`, () => {
      const vu = reconnaitreAudio(octets);
      assert.equal(
        vu,
        attendu,
        `reconnu « ${vu ?? "rien"} » au lieu de « ${attendu} » — une dictée réelle serait refusée`
      );
    });
  }

  // ─── LES HOSTILES SONT REFUSÉS ────────────────────────────────────────────

  const hostiles = [
    ["du HTML", temoinHtml()],
    ["un SVG", temoinSvg()],
    ["une archive ZIP", temoinZip()],
    ["un faux MP3 : une synchro plausible, aucune trame derrière", temoinFausseSynchroMp3()],
    ["un faux AAC : un en-tête plausible, aucune trame derrière", temoinFausseSynchroAac()],
    ["un fichier vide", new Uint8Array(0)],
    ["un octet", new Uint8Array([0xff])],
    ["deux octets", new Uint8Array([0xff, 0xfb])],
    ["trois octets", new Uint8Array([0xff, 0xfb, 0x90])],
    ["du texte quelconque", new Uint8Array(1024).fill(0x41)],
  ] as const;

  for (const [quoi, octets] of hostiles) {
    essai(`${quoi} n'est reconnu comme AUCUN format`, () => {
      const vu = reconnaitreAudio(octets);
      assert.equal(vu, null, `reconnu comme « ${vu }» : Atlas le rangerait comme un audio`);
    });
  }

  // ─── LA PORTE : cohérence, et choix SERVEUR de l'extension ────────────────

  essai("HTML annoncé audio/webm est REFUSÉ, et le refus nomme le vrai coupable", () => {
    const r = decrireAudioEntrant(temoinHtml(), "audio/webm");
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.message, /format/i, `le message n'explique rien : « ${r.message} »`);
  });

  essai("un WebM annoncé audio/mp4 n'est JAMAIS rangé en .m4a", () => {
    // Discordance : le patron a tranché — soit refus, soit normalisation vers
    // le format RÉEL. Ce qui est interdit dans les deux cas, c'est de suivre le
    // navigateur : ranger un WebM sous « .m4a » ferait servir plus tard un
    // `audio/mp4` sur des octets Matroska.
    const r = decrireAudioEntrant(temoinWebm(), "audio/mp4");
    if (r.ok) {
      assert.equal(r.format, "webm", "le format retenu suit le navigateur au lieu des octets");
      assert.equal(r.extension, ".webm");
      assert.equal(r.mime, "audio/webm");
    }
  });

  essai("un iPhone : audio/mp4 sur des octets MP4 passe, et range .m4a", () => {
    const r = decrireAudioEntrant(temoinM4aIphone(), "audio/mp4");
    assert.equal(r.ok, true, r.ok ? "" : `refusé : ${r.message}`);
    if (r.ok) {
      assert.equal(r.format, "mp4");
      assert.equal(r.extension, ".m4a");
      assert.equal(r.mime, "audio/mp4");
    }
  });

  essai("les trois MIME du même conteneur MP4 sont acceptés", () => {
    for (const declare of ["audio/mp4", "audio/m4a", "audio/x-m4a"]) {
      const r = decrireAudioEntrant(temoinM4aIphone(), declare);
      assert.equal(r.ok, true, `« ${declare} » refusé sur de vrais octets MP4`);
    }
  });

  essai("un type déclaré ABSENT ne bloque pas un fichier reconnu", () => {
    // Le type du navigateur n'est plus la décision : des octets WebM restent
    // des octets WebM, même si le téléphone n'a rien annoncé.
    const r = decrireAudioEntrant(temoinWebm(), "");
    assert.equal(r.ok, true, r.ok ? "" : `refusé : ${r.message}`);
    if (r.ok) assert.equal(r.extension, ".webm");
  });

  essai("l'extension et le MIME rangés viennent du FORMAT, jamais du navigateur", () => {
    const attendu: Record<string, [string, string]> = {
      webm: [".webm", "audio/webm"],
      mp4: [".m4a", "audio/mp4"],
      ogg: [".ogg", "audio/ogg"],
      wav: [".wav", "audio/wav"],
      flac: [".flac", "audio/flac"],
      mp3: [".mp3", "audio/mpeg"],
      aac: [".aac", "audio/aac"],
    };
    for (const [quoi, octets, format] of vrais) {
      // On annonce délibérément n'importe quoi de plausible : le résultat ne
      // doit pas bouger d'un caractère.
      const r = decrireAudioEntrant(octets, "audio/webm");
      if (!r.ok) continue; // la discordance a pu être refusée : c'est permis
      const [ext, mime] = attendu[format];
      assert.equal(r.extension, ext, `${quoi} : rangé « ${r.extension} »`);
      assert.equal(r.mime, mime, `${quoi} : annoncé « ${r.mime} »`);
    }
  });

  essai("un fichier de 1, 2, 3 octets est refusé PROPREMENT, sans lever", () => {
    for (const n of [0, 1, 2, 3, 7]) {
      const r = decrireAudioEntrant(new Uint8Array(n).fill(0xff), "audio/webm");
      assert.equal(r.ok, false, `${n} octet(s) accepté(s)`);
    }
  });

  // ─── L'ACCORD AVEC LE RESTE DU DÉPÔT ──────────────────────────────────────

  essai("chaque MIME rangé figure dans la liste blanche de l'application", () => {
    // Sans cela, Atlas rangerait un type que ses propres écrans refusent — et
    // le défaut ne se verrait qu'au fichier suivant.
    for (const [, octets] of vrais) {
      const r = decrireAudioEntrant(octets, "");
      if (!r.ok) continue;
      assert.ok(
        TYPES_AUDIO_AUTORISES.includes(r.mime),
        `« ${r.mime} » est rangé alors que la liste blanche l'ignore`
      );
    }
  });

  essai("chaque extension rangée est connue de typeDepuisCle", () => {
    // La route qui sert les fichiers dérive le type de l'extension. Une
    // extension qu'elle ignore rendrait `application/octet-stream` — le fichier
    // du patron ne s'ouvrirait plus.
    for (const [, octets] of vrais) {
      const r = decrireAudioEntrant(octets, "");
      if (!r.ok) continue;
      const servi = typeDepuisCleImporte(`chantiers/x/notes/abc${r.extension}`);
      assert.notEqual(
        servi,
        "application/octet-stream",
        `« ${r.extension} » n'est pas connue de la route de service`
      );
    }
  });

  // ─── LE CONTRÔLE QUI PARLERA DANS SIX MOIS ────────────────────────────────

  essai("LES QUATRE CHEMINS AUDIO passent par la porte commune, et eux seuls", () => {
    /**
     * **C'est la leçon de M3, appliquée à l'audio.** Là-bas, cinq chemins
     * d'image devaient traverser une porte unique, et trois contrôles
     * structurels empêchent qu'un sixième fasse sa propre cuisine. Ici, le
     * risque est le même : la cinquième dictée, écrite dans six mois, lira
     * `fichier.arrayBuffer()` toute seule et le défaut reviendra en silence.
     */
    const chemins = [
      "src/server/services/note-vocale-entrante.ts",
      "src/app/chantiers/[id]/note-vocale/actions.ts",
      "src/app/chantiers/[id]/devis-complet/actions.ts",
      "src/app/chantiers/nouveau/actions.ts",
    ];
    for (const chemin of chemins) {
      const source = readFileSync(join(__dirname, "..", chemin), "utf8");
      assert.ok(
        source.includes("preparerAudioEntrant"),
        `${chemin} n'emploie plus la porte commune : son audio n'est plus reconnu`
      );
      assert.ok(
        !source.includes("verifierTypeAudio"),
        `${chemin} décide encore sur le type déclaré par le navigateur`
      );
    }
  });

  essai("AUCUN chemin audio ne lit les octets en dehors de la porte", () => {
    // Un `arrayBuffer()` sur un fichier audio, ailleurs que dans la porte,
    // c'est un chemin qui a contourné la reconnaissance.
    const suspects: string[] = [];
    const parcourir = (dossier: string) => {
      for (const entree of readdirSync(dossier, { withFileTypes: true })) {
        const chemin = join(dossier, entree.name);
        if (entree.isDirectory()) {
          if (entree.name === "node_modules" || entree.name === "design") continue;
          parcourir(chemin);
        } else if (entree.name.endsWith(".ts")) {
          const source = readFileSync(chemin, "utf8");
          if (!/dicter|note-vocale|NoteVocale|audio/i.test(source)) continue;
          if (chemin.endsWith("audio-entrant.ts")) continue;
          if (source.includes("arrayBuffer()")) suspects.push(chemin.slice(racine.length + 1));
        }
      }
    };
    const racine = join(__dirname, "..");
    parcourir(join(racine, "src"));
    assert.deepEqual(
      suspects.filter((c) => !c.includes("photo") && !c.includes("import") && !c.includes("documents")),
      [],
      "ces fichiers touchent à l'audio et lisent les octets hors de la porte commune"
    );
  });

  essai("plus personne ne déduit une extension d'un type MIME", () => {
    // `extensionPour(mimeType)` est morte avec ce lot : c'est elle qui laissait
    // le téléphone commander l'extension de rangement, donc le type servi.
    const source = readFileSync(
      join(__dirname, "..", "src/server/services/note-vocale-entrante.ts"),
      "utf8"
    );
    assert.ok(
      !/function extensionPour/.test(source),
      "`extensionPour` est revenue : le navigateur recommanderait l'extension"
    );
  });

  console.log(`\n${echecs === 0 ? "✅" : "❌"} Signature audio — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

import { typeDepuisCle as typeDepuisCleImporte } from "../src/lib/type-de-fichier";

main();
