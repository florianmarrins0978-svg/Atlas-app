// Fait tourner le banc d'essai sur une version BÂTIE, et non sur un serveur de
// développement.
//
// ─────────────────────────────────────────────────────────────────────────────
// **Le 9 août 2026, dix-sept heures y sont passées.** « HTTP ERROR 504 »,
// « 404 », « 502 », deux serveurs qui se disputaient le port 3000, un écran qui
// mettait 38,7 secondes à s'ouvrir. Chaque correctif visait un symptôme.
//
// Ils avaient tous la même cause : `next dev` **ne compile rien d'avance**. Il
// attend qu'on ouvre un écran et le compile à cet instant — trente à cent
// secondes la première fois, moins d'une demi-seconde ensuite. Le mandataire de
// GitHub, lui, abandonne au bout d'une minute. Un serveur de développement
// n'est pas fait pour être utilisé ; c'est un atelier, pas un produit.
//
// La version bâtie compile TOUT une fois, puis sert chaque écran en 50 à 100 ms.
// Plus de compilation à l'ouverture, donc plus de 504, plus de préchauffage,
// plus de course entre le patron et le compilateur.
//
// Ce que cela coûte, dit franchement : deux à cinq minutes de construction au
// démarrage, et il faut rebâtir après chaque mise à jour. L'attente se déplace
// donc du moment où il clique vers le moment où il met à jour — c'est-à-dire
// au bon endroit, et sans lui.
//
// ─────────────────────────────────────────────────────────────────────────────
// **Le repli n'est pas une décoration.** Si la construction échoue, on repart
// sur `next dev` plutôt que de le laisser devant rien. Un banc lent reste un
// banc ; un banc mort lui coûte sa soirée.

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { annoncePrete } from "./annonce-adresse.mjs";

const PORT = process.env.PORT ?? "3000";
const SANTE = `http://127.0.0.1:${PORT}/api/health/live`;
const TEMOIN_BATI = ".next/atlas-version-batie.txt";

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

async function repond() {
  try {
    const r = await fetch(SANTE, { signal: AbortSignal.timeout(5000) });
    return r.status === 200;
  } catch {
    return false;
  }
}

/** Le commit exécuté, ou `null` hors dépôt git. */
function versionDuCode() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

/**
 * Faut-il rebâtir ?
 *
 * **La question n'est pas « le dossier .next existe-t-il ».** Une version bâtie
 * d'un code d'hier est exactement le piège que ce dépôt combat depuis le début :
 * le patron essaie une correction livrée la veille, et rien n'a changé. On
 * compare donc le commit bâti au commit présent.
 */
function doitRebatir(version) {
  if (!existsSync(".next/BUILD_ID")) return "aucune version bâtie";
  if (!version) return null; // Hors git : on ne peut pas comparer, on garde.
  try {
    const bati = readFileSync(TEMOIN_BATI, "utf8").trim();
    if (bati !== version) return "le code a changé depuis la dernière construction";
    return null;
  } catch {
    return "on ignore quel code a été bâti";
  }
}

/** Joue une commande en laissant sa sortie visible. Rend le code de sortie. */
function jouer(commande, args) {
  return new Promise((resoudre) => {
    const p = spawn(commande, args, { stdio: "inherit", env: process.env });
    p.on("exit", (code) => resoudre(code ?? 1));
    p.on("error", () => resoudre(1));
  });
}

const version = versionDuCode();
const raison = doitRebatir(version);
let bati = !raison;

if (raison) {
  console.log(`\n  Construction d'Atlas (${raison}).`);
  console.log("  Deux à cinq minutes, une seule fois. Ensuite chaque écran s'ouvre du premier coup.\n");
  const code = await jouer("npx", ["next", "build"]);
  if (code === 0) {
    bati = true;
    try {
      mkdirSync(".next", { recursive: true });
      writeFileSync(TEMOIN_BATI, version ?? "inconnue");
    } catch {
      // Sans témoin on rebâtira au prochain démarrage : coûteux, jamais faux.
    }
  } else {
    // **Jamais en silence, et jamais rien du tout.** Voir l'en-tête : un banc
    // lent reste un banc, un banc mort coûte une soirée.
    console.error(
      "\n  ⚠️  LA CONSTRUCTION A ÉCHOUÉ — les lignes ci-dessus disent pourquoi.\n" +
        "     Atlas repart en mode développement : il fonctionne, mais chaque\n" +
        "     écran mettra jusqu'à une minute à s'ouvrir la première fois.\n"
    );
  }
}

const serveur = bati
  ? spawn("npx", ["next", "start", "-H", "0.0.0.0", "-p", PORT], { stdio: "inherit", env: process.env })
  : spawn("npx", ["next", "dev", "-H", "0.0.0.0", "-p", PORT], { stdio: "inherit", env: process.env });

serveur.on("exit", (code) => process.exit(code ?? 0));

// Arrêter ce script doit arrêter le serveur : sans cela il reste en écoute, et
// la tentative suivante échoue sur un port déjà pris — message qui n'a plus
// aucun rapport avec la cause.
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    serveur.kill(signal);
    process.exit(0);
  });
}

const LIMITE = Date.now() + 180_000;
let pret = false;
while (Date.now() < LIMITE) {
  if (await repond()) {
    pret = true;
    break;
  }
  await attendre(1000);
}

if (!pret) {
  console.error(
    "\n  ⚠️  L'application n'a pas répondu après trois minutes.\n" +
      "     Les lignes ci-dessus, émises par le serveur, disent pourquoi.\n" +
      "     Cause la plus fréquente : la base de données n'est pas montée.\n"
  );
} else {
  console.log(
    annoncePrete({
      port: PORT,
      precision: bati
        ? "version bâtie, chaque écran est immédiat."
        : "mode développement, premier accès lent.",
    })
  );
}
