import { readdirSync } from "node:fs";
import { spawnSync, spawn } from "node:child_process";
import path from "node:path";

const DOSSIER = path.join(__dirname);

function attendre(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function attendreServeurPret(url: string, tentativesMax = 30): Promise<boolean> {
  for (let i = 0; i < tentativesMax; i++) {
    try {
      const r = await fetch(url);
      if (r.status === 200) return true;
    } catch {
      // pas encore prêt
    }
    await attendre(1000);
  }
  return false;
}

async function main() {
  console.log("Seed de la base de développement...");
  spawnSync("npx", ["tsx", "src/server/db/seed.ts"], { stdio: "inherit", env: process.env });

  console.log("Démarrage du serveur (mode développement)...");
  const serveur = spawn("npm", ["run", "dev", "--", "-p", "3000"], {
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });

  const pret = await attendreServeurPret("http://localhost:3000/api/health/live");
  if (!pret) {
    console.error("❌ Le serveur n'a jamais répondu — abandon.");
    process.kill(-serveur.pid!);
    process.exit(1);
  }

  const fichiers = readdirSync(DOSSIER)
    .filter((f) => f.endsWith("-e2e.ts") || f === "test-health.ts" || f === "test-cron-purge.ts")
    .sort();

  console.log(`\nExécution de ${fichiers.length} suites dépendant du serveur...\n`);
  let echecs = 0;
  for (const fichier of fichiers) {
    console.log(`=== ${fichier} ===`);
    const resultat = spawnSync("npx", ["tsx", path.join(DOSSIER, fichier)], { stdio: "inherit", env: process.env });
    if (resultat.status !== 0) {
      echecs++;
      console.error(`❌ ${fichier} a échoué`);
    }
  }

  process.kill(-serveur.pid!);
  console.log(`\n${fichiers.length - echecs}/${fichiers.length} suites réussies.`);
  if (echecs > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
