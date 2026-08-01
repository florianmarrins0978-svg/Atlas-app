import { readdirSync } from "node:fs";
import { spawnSync, spawn } from "node:child_process";
import path from "node:path";
import Redis from "ioredis";
import { SUITES_SERVEUR } from "./_suites-serveur";

const DOSSIER = path.join(__dirname);
const NODE = process.execPath;
const TSX = path.join(__dirname, "..", "node_modules", "tsx", "dist", "cli.mjs");
const NPM = process.platform === "win32" ? "npm.cmd" : "npm";

function attendre(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Chaque suite ouvre sa propre session avec le compte de démonstration, alors
// que la connexion est limitée à 5 tentatives par email et par fenêtre de 15
// minutes (LIMITES.connexion) : passé la cinquième suite, toutes les
// connexions échouaient, et l'échec se présentait comme un banal dépassement de
// délai sur la redirection post-login.
//
// Le compteur est donc remis à zéro entre deux suites — qui sont indépendantes
// et représentent chacune une session distincte. Le contrôle reste entier à
// l'intérieur d'une suite, et sa logique propre est couverte par
// test-rate-limit.ts et test-rate-limit-redis-real.ts.
//
// Suppose REDIS_URL : avec l'adaptateur mémoire, le compteur vit dans le
// processus serveur et reste hors d'atteinte.
async function reinitialiserLimiteConnexion() {
  const url = process.env.REDIS_URL;
  if (!url) return;
  const redis = new Redis(url, { lazyConnect: true, maxRetriesPerRequest: 1 });
  try {
    const cles = await redis.keys("ratelimit:connexion:*");
    if (cles.length > 0) await redis.del(...cles);
  } catch (err) {
    console.warn(`⚠ Réinitialisation de la limite de connexion impossible : ${err instanceof Error ? err.message : err}`);
  } finally {
    await redis.quit();
  }
}

/**
 * Le serveur est-il encore vivant ?
 *
 * Généreux à dessein. En mode développement, le serveur compile les routes à la
 * demande et peut rester sourd plusieurs dizaines de secondes sur une machine
 * chargée — sans être mort pour autant. Un contrôle impatient ferait pire que
 * l'absence de contrôle : il arrêterait une exécution parfaitement valable.
 *
 * On ne conclut donc à la mort qu'après plusieurs tentatives infructueuses
 * réparties sur une minute.
 */
async function serveurVivant(url: string, tentatives = 6, delaiMs = 10_000): Promise<boolean> {
  for (let i = 0; i < tentatives; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(delaiMs) });
      if (r.status === 200) return true;
    } catch {
      // Occupé, ou parti — la suite des tentatives tranchera.
    }
    if (i < tentatives - 1) await attendre(1000);
  }
  return false;
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

if (process.argv.includes("--list")) {
  const fichiers = readdirSync(DOSSIER)
    .filter((f) => f.endsWith("-e2e.ts") || SUITES_SERVEUR.includes(f))
    .sort();
  console.log("Suites e2e découvertes :");
  for (const fichier of fichiers) {
    console.log(fichier);
  }
  process.exit(0);
}

async function main() {
  console.log("Seed de la base de développement...");
  const seedResult = spawnSync(NODE, [TSX, "src/server/db/seed.ts"], {
    stdio: "inherit",
    env: process.env,
  });
  if (seedResult.error) {
    console.error(`❌ Impossible de lancer le seed de la base de développement (spawn error: ${seedResult.error.message}).`);
    process.exit(1);
  }
  if (seedResult.signal) {
    console.error(`❌ Impossible de lancer le seed de la base de développement (signal: ${seedResult.signal}).`);
    process.exit(1);
  }
  if (seedResult.status !== 0) {
    console.error(`❌ Impossible de lancer le seed de la base de développement (code: ${seedResult.status}).`);
    process.exit(1);
  }

  console.log("Démarrage du serveur (mode développement)...");
  const serveur = spawn(NPM, ["run", "dev", "--", "-p", "3000"], {
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });

  // La sortie du serveur était jusqu'ici jetée. Quand il meurt en cours de
  // route, les suites suivantes échouent toutes sur un banal dépassement de
  // délai à /login, et rien n'indique la cause réelle. On garde donc ses
  // dernières lignes pour pouvoir les montrer au moment où ça compte.
  const journalServeur: string[] = [];
  const retenir = (donnees: Buffer) => {
    for (const ligne of donnees.toString().split("\n")) {
      if (ligne.trim()) journalServeur.push(ligne);
    }
    if (journalServeur.length > 200) journalServeur.splice(0, journalServeur.length - 200);
  };
  serveur.stdout?.on("data", retenir);
  serveur.stderr?.on("data", retenir);

  let serveurTermine: string | null = null;
  serveur.on("exit", (code, signal) => {
    serveurTermine = signal ? `signal ${signal}` : `code ${code}`;
  });

  function montrerJournalServeur() {
    console.error("\n--- Dernières lignes du serveur de développement ---");
    for (const ligne of journalServeur.slice(-60)) console.error(`  ${ligne}`);
    console.error("---------------------------------------------------\n");
  }

  const pret = await attendreServeurPret("http://localhost:3000/api/health/live");
  if (!pret) {
    console.error("❌ Le serveur n'a jamais répondu — abandon.");
    montrerJournalServeur();
    process.kill(-serveur.pid!);
    process.exit(1);
  }

  const fichiers = readdirSync(DOSSIER)
    .filter((f) => f.endsWith("-e2e.ts") || SUITES_SERVEUR.includes(f))
    .sort();

  if (process.argv.includes("--list")) {
    console.log("Suites e2e découvertes :");
    for (const fichier of fichiers) {
      console.log(fichier);
    }
    process.exit(0);
  }

  console.log(`\nExécution de ${fichiers.length} suites dépendant du serveur...\n`);
  let echecs = 0;
  for (const fichier of fichiers) {
    console.log(`=== ${fichier} ===`);

    // Un serveur mort ne se répare pas en lui envoyant vingt suites de plus :
    // il produit vingt échecs qui accusent chacun un écran différent. On
    // s'arrête au premier, en disant ce qui s'est réellement passé.
    if (!(await serveurVivant("http://localhost:3000/api/health/live"))) {
      console.error(
        `❌ Le serveur ne répond plus avant ${fichier}` +
          (serveurTermine ? ` — il s'est arrêté (${serveurTermine}).` : " — il est resté sourd une minute.")
      );
      console.error("   Les suites restantes ne sont pas jouées : elles échoueraient toutes sur ce même point.");
      montrerJournalServeur();
      echecs += fichiers.length - fichiers.indexOf(fichier);
      break;
    }

    await reinitialiserLimiteConnexion();
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

  // Le serveur a pu mourir de lui-même : le tuer alors lève ESRCH et masque le
  // bilan, qui est la seule ligne que quiconque va lire.
  try {
    process.kill(-serveur.pid!);
  } catch {
    // Déjà parti — rien à faire, et surtout rien à cacher.
  }
  console.log(`\n${fichiers.length - echecs}/${fichiers.length} suites réussies.`);
  if (echecs > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
