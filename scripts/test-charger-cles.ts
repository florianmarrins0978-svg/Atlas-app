import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// **Le remède qui aurait causé la panne qu'il réparait.**
//
// Pour que le patron n'ait plus à créer de fichier caché à la main,
// `demarrer.sh` écrit d'avance un `.env.local` **vide**, avec une ligne par clé.
// Charger ce fichier naïvement — `set -a ; . .env.local` — aurait écrasé avec du
// vide les clés déjà présentes dans le conteneur, celles venues des secrets de
// l'espace de travail. Résultat : des clés posées, et une IA débranchée. Soit
// exactement le défaut du 6 août 2026, réintroduit par son propre correctif.
//
// `charger-cles.sh` ne ressort donc que ce qui apporte quelque chose. Cette
// suite le confronte à ce qu'un fichier rempli à la main contient réellement :
// des lignes vides, des commentaires, des guillemets, des espaces — et surtout
// le cas qui compte, une clé déjà posée ailleurs.

const SCRIPT = path.join(__dirname, "..", ".devcontainer", "charger-cles.sh");

let echecs = 0;
const dossier = mkdtempSync(path.join(tmpdir(), "atlas-cles-"));

function sortie(contenu: string, environnement: Record<string, string> = {}): string[] {
  const fichier = path.join(dossier, ".env.local");
  writeFileSync(fichier, contenu);
  const env: NodeJS.ProcessEnv = { NODE_ENV: "test", PATH: process.env.PATH ?? "/usr/bin:/bin", ...environnement };
  return execFileSync("bash", [SCRIPT, fichier], { env, encoding: "utf8" })
    .split("\n")
    .filter((l) => l.trim() !== "");
}

function cas(nom: string, verifier: () => void) {
  try {
    verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}


console.log("=== Ce qui sort du fichier de clés, et ce qui n'en sort pas ===");

cas("le modèle vide n'apporte rien — et n'efface donc rien", () => {
  const lignes = sortie("# Collez vos clés\nOPENAI_API_KEY=\nANTHROPIC_API_KEY=\n");
  assert.deepEqual(lignes, []);
});

cas("**une clé déjà posée dans l'environnement n'est jamais écrasée par du vide**", () => {
  // LE cas qui justifie ce script. Sans lui, le patron perdait ses secrets
  // d'espace de travail au premier démarrage suivant la mise à jour.
  const lignes = sortie("OPENAI_API_KEY=\n", { OPENAI_API_KEY: "sk-venue-des-secrets" });
  assert.deepEqual(lignes, [], "Une clé de l'environnement a été écrasée par une ligne vide.");
});

cas("une clé déjà posée l'emporte aussi sur une valeur du fichier", () => {
  const lignes = sortie("OPENAI_API_KEY=sk-du-fichier\n", { OPENAI_API_KEY: "sk-des-secrets" });
  assert.deepEqual(lignes, [], "Le fichier a pris le pas sur ce que fournit la plateforme.");
});

cas("une clé collée dans le fichier ressort telle quelle", () => {
  const lignes = sortie("OPENAI_API_KEY=sk-collee\nANTHROPIC_API_KEY=sk-ant-collee\n");
  assert.deepEqual(lignes, ["OPENAI_API_KEY=sk-collee", "ANTHROPIC_API_KEY=sk-ant-collee"]);
});

cas("guillemets et espaces d'un copier-coller ne finissent pas dans la clé", () => {
  const lignes = sortie('OPENAI_API_KEY = "sk-avec-guillemets"  \n');
  assert.deepEqual(lignes, ["OPENAI_API_KEY=sk-avec-guillemets"]);
});

cas("commentaires et lignes vides sont ignorés", () => {
  const lignes = sortie("# un commentaire\n\n   \nOPENAI_API_KEY=sk-ok\npas-une-affectation\n");
  assert.deepEqual(lignes, ["OPENAI_API_KEY=sk-ok"]);
});

cas("un fichier absent ne fait pas échouer le démarrage", () => {
  const env: NodeJS.ProcessEnv = { NODE_ENV: "test", PATH: process.env.PATH ?? "/usr/bin:/bin" };
  const r = execFileSync("bash", [SCRIPT, path.join(dossier, "inexistant")], { env, encoding: "utf8" });
  assert.equal(r.trim(), "");
});

rmSync(dossier, { recursive: true, force: true });

console.log(`\n${echecs === 0 ? "✅" : "❌"} Chargement des clés — ${echecs} échec(s).`);
if (echecs > 0) process.exit(1);
