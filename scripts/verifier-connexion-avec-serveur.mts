import { spawn, spawnSync } from "node:child_process";
import { NPM, OPTIONS_SERVEUR, arreterArbre } from "./_processus";
import { setTimeout as attendre } from "node:timers/promises";
import { existsSync, readdirSync, openSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// Monte un serveur, se connecte réellement derrière une origine étrangère, puis
// éteint tout. Enveloppe `verifier-connexion.mjs`, qui suppose un serveur déjà
// en écoute.
//
// Existe pour que la batterie de `verifier-avant-livraison.ts` tienne en une
// seule commande : un contrôle qu'il faut préparer à la main est un contrôle
// qu'on finit par sauter.

/**
 * **Le port de l'ATELIER de cette session — 8 septembre 2026.**
 *
 * Cette étape montait son banc sur le port 3000, écrit en dur. Depuis que
 * chaque session mesure sur son propre port (`scripts/_atelier.ts`), elle
 * tombait donc sur « le port 3000 est déjà pris » et l'étape échouait — en
 * accusant un serveur orphelin alors que c'était la session voisine, qui a
 * parfaitement le droit d'être là.
 *
 * La batterie pose `ATLAS_ADRESSE` ; jouée seule, cette étape retombe sur 3000
 * comme avant.
 */
const PORT = process.env.ATLAS_ADRESSE
  ? new URL(process.env.ATLAS_ADRESSE).port || "3000"
  : "3000";
const SANTE = `http://127.0.0.1:${PORT}/api/health/live`;

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
  console.error(`❌ Le port ${PORT} est déjà pris. Arrêter le serveur en cours.`);
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
/**
 * **Le journal du banc, et c'est un correctif — 8 septembre 2026.**
 *
 * Cette étape a échoué trois batteries d'affilée sur « le serveur n'a pas
 * répondu en dix minutes », sans un mot de plus : la sortie du banc allait dans
 * `ignore`. Impossible de savoir s'il bâtissait encore, s'il refusait de
 * démarrer, ou s'il était mort — et le diagnostic a coûté trois jours de
 * suppositions, dont une cause avancée puis démentie.
 *
 * « Devant un défaut muet, la première livraison n'est pas un correctif : c'est
 * de rendre le défaut bavard » (`AGENTS.md`). On garde donc sa sortie, et on la
 * montre quand l'attente échoue.
 */
const JOURNAL_BANC = path.join(tmpdir(), `atlas-banc-connexion-${PORT}.log`);
const journalFd = openSync(JOURNAL_BANC, "w");

/**
 * **ON LANCE `banc.mjs` DIRECTEMENT, PAS `npm run banc` — 8 septembre 2026.**
 *
 * C'est le MÊME piège que `run-e2e-tests.ts` a payé le 2 septembre, et il a
 * coûté trois batteries ici. Sous Windows, `npm` est un `npm.cmd` que Node
 * refuse de lancer sans shell (CVE-2024-27980) ; `OPTIONS_SERVEUR` posait donc
 * `shell: true`, et **le shell avalait tout** : le banc ne démarrait pas, son
 * journal restait à zéro octet, rien n'écoutait sur le port, et l'étape
 * attendait dix minutes pour annoncer « le serveur n'a pas répondu » sans
 * pouvoir dire pourquoi.
 *
 * Le symptôme est reconnaissable entre tous : **un journal de zéro octet**.
 * C'est ce que le dépôt appelle un contrôle qui mesure zéro (`CLAUDE.md` §5) —
 * il ne dit pas « rouge », il ne dit rien.
 *
 * `banc.mjs` est un script Node : on le lance par l'exécutable qui nous porte
 * déjà. Plus de `.cmd`, plus de shell, plus d'interposition — et le journal
 * revient.
 */
const serveur = spawn(process.execPath, ["scripts/banc.mjs"], {
  stdio: ["ignore", journalFd, journalFd],
  // Le profil est posé ici comme `.devcontainer/demarrer.sh` le pose sur le
  // banc : sans lui, la version bâtie refuse de démarrer, et le contrôle
  // échouerait pour une raison qui n'a rien à voir avec la connexion.
  env: { ...process.env, ATLAS_PROFIL: "banc", PORT },
  ...OPTIONS_SERVEUR,
  // **`shell` est retiré ici, et c'est tout le correctif.** `OPTIONS_SERVEUR`
  // le pose pour ceux qui lancent un `.cmd` ; nous lançons un script Node.
  // `detached`, lui, reste : le banc lance son propre serveur, et tuer le seul
  // parent laisserait le port pris.
  shell: false,
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

/**
 * **Le refus qu'on reconnaît tout de suite, plutôt qu'au bout de dix minutes.**
 *
 * Next.js 16 refuse un second serveur de développement **dans le même
 * dossier**, quel que soit le port : « Another next dev server is already
 * running ». C'est ce qui arrive dès qu'une autre session du patron travaille
 * dans l'arbre — et attendre dix minutes pour l'apprendre, c'est dix minutes
 * qui n'apprennent rien. Le remède n'est pas un port de plus : c'est un
 * DOSSIER de travail par session (`git worktree`).
 */
function refusDeSecondServeur(): boolean {
  try {
    return readFileSync(JOURNAL_BANC, "utf8").includes("Another next dev server is already running");
  } catch {
    return false;
  }
}

// La construction prend deux à cinq minutes la première fois.
const limite = Date.now() + 600_000;
let pret = false;
let dossierOccupe = false;
while (Date.now() < limite) {
  if (await repond()) {
    pret = true;
    break;
  }
  if (refusDeSecondServeur()) {
    dossierOccupe = true;
    break;
  }
  await attendre(2000);
}

if (dossierOccupe) {
  console.error(
    "❌ Un autre serveur de développement tourne DANS CE DOSSIER, et Next.js en refuse un second.\n" +
      "   Ce n'est pas une affaire de port : le verrou est posé sur le dossier du projet.\n" +
      "   Chaque session a besoin de son propre dossier de travail :\n" +
      "     npm run sessions:preparer"
  );
  eteindre();
  process.exit(1);
}

if (!pret) {
  console.error("❌ Le serveur n'a pas répondu en dix minutes (construction comprise).");
  console.error(`   Port attendu : ${PORT}. Journal : ${JOURNAL_BANC}`);
  try {
    const lignes = readFileSync(JOURNAL_BANC, "utf8").trim().split("\n");
    console.error("\n--- Dernières lignes du banc ---");
    for (const ligne of lignes.slice(-40)) console.error(`  ${ligne}`);
    console.error("--- fin ---\n");
  } catch {
    console.error("   (son journal est vide : il n'a même pas démarré)");
  }
  eteindre();
  process.exit(1);
}

const navigateur = navigateurPreInstalle();
const r = spawnSync("node", ["scripts/verifier-connexion.mjs"], {
  stdio: "inherit",
  env: {
    ...process.env,
    // `verifier-connexion.mjs` lit `BASE_ESSAI` : sans elle, il irait frapper
    // au 3000 pendant que notre banc écoute ailleurs.
    BASE_ESSAI: `http://127.0.0.1:${PORT}`,
    ...(navigateur ? { CHROMIUM_PATH: navigateur } : {}),
  },
});

eteindre();
process.exit(r.status ?? 1);
