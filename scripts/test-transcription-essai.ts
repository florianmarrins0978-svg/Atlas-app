import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fournisseurTranscriptionEssai, TEXTE_DE_LESSAI } from "../src/server/ai/providers/transcription/essai";
import { estTranscriptionSimulee } from "../src/server/ai/providers/transcription/dev";
import { etatTranscription } from "../src/lib/etat-transcription";

/**
 * LE FOURNISSEUR DES SUITES NE DOIT RIEN AFFAIBLIR.
 *
 * **Il est né d'un rouge de quatre jours** : depuis le 5 septembre 2026,
 * l'application refuse à juste titre une transcription SIMULÉE — elle
 * remplissait les devis de prestations que personne n'avait dictées. Les suites
 * navigateur n'avaient que ce fournisseur-là, et la chaîne dictée → devis s'y
 * arrêtait sur « aucun prestataire n'est raccordé ». Quatorze suites rouges,
 * prises pour un flottement.
 *
 * **Ce que cette suite garde**, et c'est tout ce qui compte : que la correction
 * du 5 septembre reste entière, et que le fournisseur d'essai n'existe que
 * pour les suites.
 */

let passed = 0;
let failed = 0;
function test(nom: string, fn: () => void | Promise<void>) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      console.log(`✅ ${nom}`);
      passed++;
    })
    .catch((err) => {
      console.error(`❌ ${nom}`);
      console.error(`   ${err instanceof Error ? err.message : err}`);
      failed++;
    });
}

const RACINE = path.join(__dirname, "..");
const lire = (f: string) => readFileSync(path.join(RACINE, f), "utf8");

async function main() {
  await test("il rend un texte ORDINAIRE — c'est toute sa raison d'être", async () => {
    const r = await fournisseurTranscriptionEssai.transcrire(Buffer.from("des octets"), "audio/webm");
    assert.ok(r.succes, "le fournisseur d'essai échoue sur un enregistrement valable");
    assert.ok(
      !estTranscriptionSimulee(r.succes ? r.texte : ""),
      "son texte porte la marque du simulé : l'application le refusera, et les suites resteront rouges"
    );
  });

  await test("l'application ACCEPTE son texte, là où elle refuse celui de `dev`", () => {
    const note = { transcription: TEXTE_DE_LESSAI, transcriptionStatut: "reussie" };
    assert.equal(etatTranscription(note, false), "ecoutee");
    // Et la correction du 5 septembre est intacte : marqué, c'est refusé.
    assert.equal(etatTranscription(note, true), "non_transcrite");
  });

  await test("LA RÈGLE DU 5 SEPTEMBRE N'A PAS BOUGÉ — `dev` marque toujours le sien", () => {
    const dev = lire("src/server/ai/providers/transcription/dev.ts");
    assert.match(dev, /PREFIXE_TRANSCRIPTION_SIMULEE/, "`dev` ne marque plus son texte");
    const etat = lire("src/lib/etat-transcription.ts");
    assert.match(etat, /if \(simulee\) return "non_transcrite"/, "le refus du texte simulé a disparu");
  });

  await test("un enregistrement VIDE reste un échec, comme chez les vrais", async () => {
    const r = await fournisseurTranscriptionEssai.transcrire(Buffer.alloc(0), "audio/webm");
    assert.equal(r.succes, false, "zéro octet rend un succès : une suite ne verrait pas ce que le patron verrait");
  });

  await test("il n'est PAS un fournisseur de production", () => {
    const env = lire("src/server/env.ts");
    const cles = env.slice(env.indexOf("const CLES_TRANSCRIPTION"), env.indexOf("const NOM_VARIABLE"));
    assert.ok(
      !cles.includes("essai"),
      "« essai » est entré dans les fournisseurs de production : un déploiement rendrait un texte inventé"
    );
  });

  await test("UN SEUL endroit le choisit, et c'est le serveur des suites", () => {
    const runner = lire("scripts/run-e2e-tests.ts");
    assert.match(runner, /TRANSCRIPTION_PROVIDER: "essai"/, "le serveur des suites ne le choisit plus : le rouge revient");
    // Un contrôle qui mesure zéro ne mesure rien : on vérifie que la lecture a eu lieu.
    assert.ok(runner.length > 5000, "la lecture du lanceur a échoué");
  });

  console.log(`\n${passed} réussis, ${failed} échoués`);
  if (failed > 0) process.exit(1);
}

void main();
