import { spawn, spawnSync } from "node:child_process";
import { NPM, OPTIONS_SERVEUR, arreterArbre } from "./_processus";
import { setTimeout as attendre } from "node:timers/promises";
import { existsSync, readdirSync } from "node:fs";

// Monte un serveur, se connecte réellement derrière une origine étrangère, puis
// éteint tout. Enveloppe `verifier-connexion.mjs`, qui suppose un serveur déjà
// en écoute.
//
// Existe pour que la batterie de `verifier-avant-livraison.ts` tienne en une
// seule commande : un contrôle qu'il faut préparer à la main est un contrôle
// qu'on finit par sauter.

const SANTE = "http://127.0.0.1:3000/api/health/live";

/** Playwright ne trouve pas seul un navigateur installé hors de son cache. */
function navigateurPreInstalle(): string | undefined {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const racine = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!racine || !existsSync(racine)) return undefined;
  const dossier = readdirSync(racine).find((d) => /^chromium-\d+$/.test(d));
  if (!dossier) return undefined;
  const chemin = `${racine}/${dossier}/chrome-linux/chrome`;
  return existsSync(chemin) ? chemin : undefined;
}

async function repond(): Promise<boolean> {
  try {
    const r = await fetch(SANTE, { signal: AbortSignal.timeout(5000) });
    return r.status === 200;
  } catch {
    return false;
  }
}

// Un serveur déjà en écoute rendrait le contrôle sans objet : il éprouverait
// une version du code qu'on n'a pas construite ici.
if (await repond()) {
  console.error("❌ Le port 3000 est déjà pris. Arrêter le serveur en cours.");
  process.exit(1);
}

// **On éprouve ce que le patron exécute, et rien d'autre.**
//
// Ce contrôle montait `npm run essai`, c'est-à-dire `next dev`. Depuis le
// 9 août 2026, son banc sert une version BÂTIE (`npm run banc`) : continuer à
// éprouver le serveur de développement, c'était éprouver une chose qui
// n'existe plus chez lui. Et la différence n'est pas cosmétique — `next start`
// impose `NODE_ENV=production`, ce qui éteignait l'alignement d'origine du
// proxy et ramenait « Invalid Server Actions request. » à la connexion. Ce
// contrôle est le SEUL qui pouvait le voir.
//
// `detached` permet de tuer tout l'arbre de processus : `npm run banc` lance
// lui-même le serveur, et tuer le parent seul laisserait le port occupé.
// **`npm` s'appelle `npm.cmd` sous Windows, et il lui faut un shell** : sans
// cela, `spawn` rend `EINVAL` et l'étape tombe avant d'avoir rien vérifié.
const serveur = spawn(NPM, ["run", "banc"], {
  stdio: "ignore",
  // Le profil est posé ici comme `.devcontainer/demarrer.sh` le pose sur le
  // banc : sans lui, la version bâtie refuse de démarrer, et le contrôle
  // échouerait pour une raison qui n'a rien à voir avec la connexion.
  env: { ...process.env, ATLAS_PROFIL: "banc" },
  ...OPTIONS_SERVEUR,
});

function eteindre() {
  try {
    arreterArbre(serveur.pid);
  } catch {
    /* déjà mort */
  }
}
process.on("exit", eteindre);
for (const s of ["SIGINT", "SIGTERM"]) process.on(s, () => process.exit(1));

// La construction prend deux à cinq minutes la première fois.
const limite = Date.now() + 600_000;
let pret = false;
while (Date.now() < limite) {
  if (await repond()) {
    pret = true;
    break;
  }
  await attendre(2000);
}

if (!pret) {
  console.error("❌ Le serveur n'a pas répondu en dix minutes (construction comprise).");
  eteindre();
  process.exit(1);
}

const navigateur = navigateurPreInstalle();
const r = spawnSync("node", ["scripts/verifier-connexion.mjs"], {
  stdio: "inherit",
  env: navigateur ? { ...process.env, CHROMIUM_PATH: navigateur } : process.env,
});

eteindre();
process.exit(r.status ?? 1);
