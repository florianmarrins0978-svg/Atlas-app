import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const DOSSIER = path.join(__dirname);
const NODE = process.execPath;
const TSX = path.join(__dirname, "..", "node_modules", "tsx", "dist", "cli.mjs");
const EXCLUS_SERVEUR = ["test-health.ts", "test-cron-purge.ts"];
const fichiers = readdirSync(DOSSIER)
  .filter((f) => (f.startsWith("test-") || f.endsWith("-tests.ts") || f.endsWith("-tests-2.ts") || f.endsWith("-tests-3.ts")) && f.endsWith(".ts"))
  .filter((f) => !f.endsWith("-e2e.ts") && !EXCLUS_SERVEUR.includes(f) && f !== "run-all-tests.ts" && f !== "run-e2e-tests.ts")
  .sort();

if (process.argv.includes("--list")) {
  console.log("Suites de tests découvertes :");
  for (const fichier of fichiers) {
    console.log(fichier);
  }
  process.exit(0);
}

console.log(`Exécution de ${fichiers.length} suites de tests...\n`);

let echecs = 0;
for (const fichier of fichiers) {
  console.log(`=== ${fichier} ===`);
  const resultat = spawnSync(NODE, [TSX, path.join(DOSSIER, fichier)], {
    stdio: "inherit",
    env: process.env,
  });

  if (resultat.error) {
    echecs++;
    console.error(`❌ ${fichier} a échoué (spawn error: ${resultat.error.message})`);
    continue;
  }
  if (resultat.signal) {
    echecs++;
    console.error(`❌ ${fichier} a échoué (signal: ${resultat.signal})`);
    continue;
  }
  if (resultat.status !== 0) {
    echecs++;
    console.error(`❌ ${fichier} a échoué (code: ${resultat.status})`);
  }
}

console.log(`\n${fichiers.length - echecs}/${fichiers.length} suites réussies.`);
if (echecs > 0) process.exit(1);
