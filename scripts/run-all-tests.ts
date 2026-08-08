import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { SUITES_SERVEUR } from "./_suites-serveur";

const DOSSIER = path.join(__dirname);
const NODE = process.execPath;
const TSX = path.join(__dirname, "..", "node_modules", "tsx", "dist", "cli.mjs");
const fichiers = readdirSync(DOSSIER)
  .filter((f) => (f.startsWith("test-") || f.endsWith("-tests.ts") || f.endsWith("-tests-2.ts") || f.endsWith("-tests-3.ts")) && f.endsWith(".ts"))
  .filter((f) => !f.endsWith("-e2e.ts") && !SUITES_SERVEUR.includes(f) && f !== "run-all-tests.ts" && f !== "run-e2e-tests.ts")
  .sort();

if (process.argv.includes("--list")) {
  console.log("Suites de tests découvertes :");
  for (const fichier of fichiers) {
    console.log(fichier);
  }
  process.exit(0);
}

console.log(`Exécution de ${fichiers.length} suites de tests...\n`);

/**
 * Au-delà de quoi une suite est déclarée bloquée.
 *
 * **Ce que ce garde-fou a coûté d'avoir manqué, le 8 août 2026.** Une suite
 * affichait « 8 test(s) réussi(s) » puis ne rendait jamais la main : avec
 * `REDIS_URL` posé — ce que `CLAUDE.md` §5 demande —, une connexion restait
 * ouverte et le processus vivait pour toujours. La batterie s'arrêtait là,
 * **sans un mot**, et les vingt suites suivantes n'étaient jamais jouées.
 *
 * Aucun test n'échouait. C'est le pire des états : une batterie qui ne finit
 * pas ne dit pas « rouge », elle ne dit plus rien — et on croit vert ce qu'on
 * n'a pas regardé.
 *
 * Huit minutes : largement au-dessus de la plus lente (le hachage des mots de
 * passe en rend certaines longues), et bien en deçà d'une attente infinie.
 */
const DELAI_PAR_SUITE_MS = 8 * 60 * 1000;

let echecs = 0;
for (const fichier of fichiers) {
  console.log(`=== ${fichier} ===`);
  const resultat = spawnSync(NODE, [TSX, path.join(DOSSIER, fichier)], {
    stdio: "inherit",
    env: process.env,
    timeout: DELAI_PAR_SUITE_MS,
  });

  // **Le message doit désigner le bon coupable** (`AGENTS.md`). Un « signal:
  // SIGTERM » envoie chercher une erreur de test ; ici, les tests ont pu tous
  // passer et c'est le processus qui ne s'arrête pas.
  const bloquee =
    (resultat.error as NodeJS.ErrnoException | undefined)?.code === "ETIMEDOUT" ||
    (resultat.signal === "SIGTERM" && resultat.status === null);
  if (bloquee) {
    echecs++;
    console.error(
      `❌ ${fichier} n'a pas rendu la main en ${DELAI_PAR_SUITE_MS / 60000} minutes — tué.\n` +
        "   Ses tests ont peut-être tous réussi : le processus, lui, ne s'arrête pas.\n" +
        "   Cause habituelle : une connexion restée ouverte (Redis via le limiteur\n" +
        "   de débit, un pool PostgreSQL). Fermer en fin de suite — voir\n" +
        "   `fermerLimiteur()` et `pool.end()` dans test-ia-03-propositions.ts."
    );
    continue;
  }

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
