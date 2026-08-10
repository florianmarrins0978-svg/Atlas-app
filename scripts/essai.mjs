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

let sortieServeur = null;
let attentePassee = false;
serveur.on("exit", (code) => {
  sortieServeur = code ?? 0;
  if (attentePassee) process.exit(sortieServeur);
});

// Arrêter le script doit arrêter le serveur : sans cela il reste en écoute, et
// la tentative suivante échoue sur un port déjà pris — message qui n'a plus
// aucun rapport avec la cause.
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    serveur.kill(signal);
    process.exit(0);
  });
}

// DIX minutes, et non trois. Le patron, le 2026-08-10, sur un Codespace dont
// Next.js disait lui-même « Slow filesystem detected. The benchmark took
// 20605 ms » — deux cents fois la normale : le serveur avait démarré en 486 ms
// et compilait encore quand le script a renoncé. Il a lu « l'application n'a
// pas répondu » alors qu'elle était en train d'arriver.
//
// Abandonner trop tôt ne coûte pas une attente : ça fait croire à une panne.
// Réglable pour les essais du script lui-même, jamais pour l'usage courant.
const ATTENTE_MAX = Number(process.env.ATLAS_ATTENTE_MAX ?? 600) * 1000;
const DEBUT = Date.now();
const LIMITE = DEBUT + ATTENTE_MAX;
let pret = false;
let prochainSigne = DEBUT + 30_000;
while (Date.now() < LIMITE && sortieServeur === null) {
  if (await repond()) {
    pret = true;
    break;
  }
  // Un signe de vie toutes les trente secondes : sans lui, un écran figé
  // pendant dix minutes se lit comme un plantage, et on ferme le terminal —
  // ce qui tue le serveur qui était en train d'aboutir.
  if (Date.now() >= prochainSigne) {
    const s = Math.round((Date.now() - DEBUT) / 1000);
    console.log(`  … toujours en compilation (${s} s). Le premier écran d'un espace neuf est long.`);
    prochainSigne = Date.now() + 30_000;
  }
  await attendre(2000);
}

const adresse = adressePubliquePossible();

if (!pret) {
  // NE PAS ACCUSER LA BASE DE DONNÉES PAR DÉFAUT. La version précédente le
  // faisait, et elle a envoyé le patron chercher au mauvais endroit un jour où
  // le journal disait « disque lent » trois lignes plus haut. Une erreur qui
  // désigne le mauvais coupable coûte plus cher que pas d'erreur du tout
  // (AGENTS.md). On regarde donc si le serveur est ENCORE EN VIE, ce qui
  // sépare les deux cas sans rien supposer.
  const n = Math.max(1, Math.round(ATTENTE_MAX / 60_000));
  const minutes = `${n} minute${n > 1 ? "s" : ""}`;
  if (sortieServeur === null) {
    console.error(
      `\n  ⚠️  L'application n'a pas encore répondu après ${minutes},\n` +
        "     mais LE SERVEUR TOURNE TOUJOURS — il compile encore.\n\n" +
        "     Ne fermez pas ce terminal : le fermer tuerait le serveur au\n" +
        "     moment où il aboutit. Attendez, puis rechargez la page.\n\n" +
        "     Pour savoir sans deviner :\n" +
        `       curl -s -o /dev/null -w '%{http_code}\\n' ${SANTE}\n` +
        "     200 = c'est prêt.\n\n" +
        "     Si les lignes ci-dessus portent « Slow filesystem detected »,\n" +
        "     c'est le disque de cet espace de travail qui est lent — rien\n" +
        "     d'autre. Un espace neuf repart sur un disque neuf.\n"
    );
  } else {
    console.error(
      "\n  ⚠️  Le serveur s'est arrêté avant de répondre.\n" +
        "     Les lignes ci-dessus, émises par lui, disent pourquoi.\n" +
        "     Cause fréquente : la base de données n'est pas montée —\n" +
        "     relancer alors `bash .devcontainer/preparer.sh`.\n"
    );
  }
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

// À partir d'ici, la mort du serveur doit arrêter le script : c'est lui qui le
// tenait en vie.
attentePassee = true;
if (sortieServeur !== null) process.exit(sortieServeur);
