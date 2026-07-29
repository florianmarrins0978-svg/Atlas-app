import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const DOSSIER = path.join(__dirname);
const EXCLUS_SERVEUR = ["test-health.ts", "test-cron-purge.ts"];
const fichiers = readdirSync(DOSSIER)
  .filter((f) => (f.startsWith("test-") || f.endsWith("-tests.ts") || f.endsWith("-tests-2.ts") || f.endsWith("-tests-3.ts")) && f.endsWith(".ts"))
  .filter((f) => !f.endsWith("-e2e.ts") && !EXCLUS_SERVEUR.includes(f))
  .sort();

console.log(`Exécution de ${fichiers.length} suites de tests...\n`);

let echecs = 0;
for (const fichier of fichiers) {
  console.log(`=== ${fichier} ===`);
  const resultat = spawnSync("npx", ["tsx", path.join(DOSSIER, fichier)], {
    stdio: "inherit",
    env: process.env,
  });
  if (resultat.status !== 0) {
    echecs++;
    console.error(`❌ ${fichier} a échoué (code ${resultat.status})`);
  }
}

console.log(`\n${fichiers.length - echecs}/${fichiers.length} suites réussies.`);
if (echecs > 0) process.exit(1);
