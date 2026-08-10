import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

// Démarre l'application pour les essais, attend qu'elle réponde vraiment, puis
// affiche l'adresse à ouvrir.
//
// Pourquoi ne pas se contenter de `next dev` : le message « ready » de Next.js
// arrive AVANT que le premier écran soit compilable. Celui qui ouvre l'adresse
// à cet instant obtient une page blanche, sans rien qui explique pourquoi — et
// conclut que l'application est cassée. C'est arrivé.
//
// Ce script attend donc une vraie réponse HTTP, et dit ensuite quoi ouvrir.

const PORT = process.env.PORT ?? "3000";
const SANTE = `http://127.0.0.1:${PORT}/api/health/live`;

/** L'adresse publique de l'espace de travail, quand on y est. */
function adressePubliquePossible() {
  const nom = process.env.CODESPACE_NAME;
  if (!nom) return null;
  const domaine = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN ?? "app.github.dev";
  return `https://${nom}-${PORT}.${domaine}`;
}

function attendre(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function repond() {
  try {
    const r = await fetch(SANTE, { signal: AbortSignal.timeout(5000) });
    return r.status === 200;
  } catch {
    return false;
  }
}

// Sans dépendances installées, `npx` ne trouve pas `next` en local et PROPOSE
// DE LE TÉLÉCHARGER — « Need to install the following packages: next@… Ok to
// proceed? ». Le patron est tombé dessus le 2026-08-10 : la question n'a aucun
// rapport avec ce qu'il voulait faire, et accepter installerait une version
// différente de celle que le dépôt a éprouvée. On refuse avant d'en arriver là,
// et on nomme le vrai coupable.
const NEXT_LOCAL = "node_modules/next/dist/bin/next";
if (!existsSync(NEXT_LOCAL)) {
  console.error(`
  ─────────────────────────────────────────────────────────────
   Les dépendances ne sont pas installées.

   Ne laissez pas « npx » vous proposer de télécharger Next :
   il prendrait une autre version que celle du dépôt.

   Jouez d'abord, dans cet ordre :

     bash .devcontainer/preparer.sh    dépendances, base, données

   ou, si la base est déjà prête :

     npm ci

   puis relancez :

     npm run essai
  ─────────────────────────────────────────────────────────────
`);
  process.exit(1);
}

// `--no-install` en renfort : si le contrôle ci-dessus laissait passer un cas
// que je n'ai pas prévu, npx échoue au lieu de POSER UNE QUESTION à laquelle
// personne n'attend d'avoir à répondre.
const serveur = spawn("npx", ["--no-install", "next", "dev", "-H", "0.0.0.0", "-p", PORT], {
  stdio: "inherit",
  env: process.env,
});

serveur.on("exit", (code) => process.exit(code ?? 0));

// Arrêter le script doit arrêter le serveur : sans cela il reste en écoute, et
// la tentative suivante échoue sur un port déjà pris — message qui n'a plus
// aucun rapport avec la cause.
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    serveur.kill(signal);
    process.exit(0);
  });
}

// Jusqu'à trois minutes : sur une machine d'essai fraîche et chargée, la
// première compilation est lente, et abandonner trop tôt ferait croire à une
// panne là où il n'y a que de la patience à avoir.
const LIMITE = Date.now() + 180_000;
let pret = false;
while (Date.now() < LIMITE) {
  if (await repond()) {
    pret = true;
    break;
  }
  await attendre(2000);
}

const adresse = adressePubliquePossible();

if (!pret) {
  console.error(
    "\n  ⚠️  L'application n'a pas répondu après trois minutes.\n" +
      "     Les lignes ci-dessus, émises par le serveur, disent pourquoi.\n" +
      "     Cause la plus fréquente : la base de données n'est pas montée —\n" +
      "     relancer alors `bash .devcontainer/preparer.sh`.\n"
  );
} else {
  console.log(
    "\n  ─────────────────────────────────────────────────────────────\n" +
      "   L'application répond.\n\n" +
      (adresse
        ? `     ${adresse}\n\n` +
          "   Ouvrable depuis un téléphone, telle quelle.\n" +
          "   N'y mettez que des données inventées : cette adresse est\n" +
          "   publique, et le mot de passe ci-dessous aussi.\n\n"
        : `     http://localhost:${PORT}\n\n`) +
      "     demo@atlas.local  /  demo1234\n" +
      "  ─────────────────────────────────────────────────────────────\n"
  );
}
