import { spawn } from "node:child_process";

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

// **Jamais deux serveurs pour un seul port.**
//
// Le 9 août 2026, le patron a lu « HTTP ERROR 404 » : plus rien n'écoutait. Son
// terminal montrait l'invite revenue après `npm run essai`, c'est-à-dire un
// serveur mort — pas un serveur lent. Le mécanisme : l'espace démarre le
// serveur tout seul (`.devcontainer/demarrer.sh`), il en a lancé un second à la
// main, et le `pkill -f "[n]ext dev"` que fait le démarrage à chaque allumage
// en a tué un des deux. Celui qui restait n'était pas forcément celui que le
// mandataire de GitHub avait publié.
//
// Une commande tapée par erreur ne doit pas pouvoir éteindre l'application. Si
// quelqu'un répond déjà sur ce port, on le dit et on s'arrête.
if (await repond()) {
  const dejaLa = adressePubliquePossible();
  console.log(
    "\n  ─────────────────────────────────────────────────────────────\n" +
      "   Atlas tourne déjà — rien à relancer.\n\n" +
      (dejaLa ? `     ${dejaLa}\n` : `     http://localhost:${PORT}\n`) +
      "\n   (L'espace de travail le démarre tout seul à chaque allumage.)\n" +
      "  ─────────────────────────────────────────────────────────────\n"
  );
  process.exit(0);
}

const serveur = spawn("npx", ["next", "dev", "-H", "0.0.0.0", "-p", PORT], {
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

  // **Compiler les écrans maintenant, plutôt que sous ses yeux.**
  //
  // `next dev` compile à la demande : le premier accès à un écran coûte trente
  // à cent secondes, et le mandataire de GitHub abandonne bien avant — d'où les
  // « HTTP ERROR 504 » du 9 août. On absorbe donc ce coût ici, pendant qu'il ne
  // regarde pas. Le raisonnement complet vit dans `prechauffer.mjs`.
  //
  // Rien de tout ceci ne doit pouvoir empêcher le serveur de servir : la
  // moindre difficulté est écrite et oubliée.
  try {
    const { cookieDeSession, ecransDeChantier, ECRANS_A_PRECHAUFFER, expliquerObstacle, prechauffer } =
      await import("./prechauffer.mjs");
    const base = `http://127.0.0.1:${PORT}`;
    const cookie = await cookieDeSession({
      databaseUrl: process.env.DATABASE_URL,
      authSecret: process.env.AUTH_SECRET,
      nodeEnv: process.env.NODE_ENV,
    });
    if (!cookie) {
      console.log("  (Préchauffage impossible : pas de session — les écrans se compileront à l'ouverture.)\n");
    } else {
      const ecrans = [...ECRANS_A_PRECHAUFFER, ...(await ecransDeChantier({ base, cookie }))];
      console.log(`  Préchauffage de ${ecrans.length} écrans en cours — ils s'ouvriront ensuite du premier coup.\n`);
      const bilan = await prechauffer({
        base,
        cookie,
        ecrans,
        ecrire: (ligne) => console.log(`  · ${ligne}`),
      });
      console.log(
        `\n  Préchauffage terminé : ${bilan.reussis} écran(s) prêts` +
          (bilan.echoues ? `, ${bilan.echoues} en échec` : "") +
          ` — ${bilan.secondes} s.`
      );
      const obstacle = expliquerObstacle(bilan.renvoiDominant);
      if (obstacle) console.log(`  ${obstacle}`);
      console.log("");
    }
  } catch (e) {
    console.log(`  (Préchauffage abandonné : ${e instanceof Error ? e.message : e})\n`);
  }
}
