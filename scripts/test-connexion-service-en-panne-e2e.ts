// L'écran de connexion dit-il la VÉRITÉ quand un service est en panne ?
//
// ─────────────────────────────────────────────────────────────────────────────
// **Le 12 août 2026 :** *« Ça ne marche pas, je n'arrive pas à me connecter.
// Occupe-toi-en, moi je ne peux pas le faire. »*
//
// La base de données de son espace était arrêtée. La requête qui cherche son
// compte échouait, Auth.js l'emballait dans une `AuthError` — et l'écran, qui
// les traitait toutes pareil, lui répondait **« Email ou mot de passe
// incorrect »**. Il pouvait retaper son mot de passe toute la nuit : le message
// lui disait de recommencer, et recommencer ne pouvait rien donner.
//
// C'est le défaut que l'en-tête de `src/app/login/actions.ts` interdit déjà,
// sous sa TROISIÈME forme. Il avait été réparé pour le blocage par tentatives ;
// la panne d'un service retombait encore dedans.
//
// **Ce contrôle est le seul du dépôt qui coupe un service pour de bon.** Tous
// les autres supposent l'environnement debout — c'est précisément pour cela
// qu'aucun n'a jamais vu ce message mentir.
// ─────────────────────────────────────────────────────────────────────────────

import { execFileSync } from "node:child_process";
import { lancerNavigateur } from "./e2e-browser";

const BASE = "http://localhost:3000";

let echecs = 0;
function verifier(nom: string, condition: boolean, detail = "") {
  if (condition) {
    console.log(`  ✓ ${nom}`);
  } else {
    echecs++;
    console.log(`  ✗ ${nom}${detail ? `\n    ${detail}` : ""}`);
  }
}

/** Le texte affiché sous les champs, après une tentative de connexion. */
async function messageApresTentative(page: import("playwright").Page, motDePasse: string) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', motDePasse);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(4000);
  return { texte: await page.locator("body").innerText(), url: page.url() };
}

function redis(...args: string[]) {
  try {
    return execFileSync("redis-cli", args, { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

async function main() {
  const navigateur = await lancerNavigateur();
  const page = await (await navigateur.newContext()).newPage();

  console.log("=== L'écran de connexion face à une panne de service ===");

  // 1. Tout debout : les deux réponses ordinaires doivent rester justes. Sans
  //    cela, on aurait échangé un mensonge contre un autre.
  const mauvais = await messageApresTentative(page, "pas-le-bon-mot-de-passe");
  verifier(
    "mot de passe faux : on le dit, franchement",
    mauvais.texte.includes("Email ou mot de passe incorrect"),
    `écran : ${mauvais.texte.replace(/\s+/g, " ").slice(0, 160)}`
  );

  const bon = await messageApresTentative(page, "demo1234");
  verifier("mot de passe juste : on entre", !bon.url.endsWith("/login"), `on est resté sur ${bon.url}`);

  // 2. Redis coupé. La limitation de tentatives ne doit PAS enfermer dehors :
  //    un limiteur en panne qui refuse tout inflige lui-même la panne dont il
  //    protégeait, et sa première victime est celui qui a le droit d'entrer.
  const redisEtaitLa = redis("ping") === "PONG";
  if (redisEtaitLa) {
    redis("shutdown", "nosave");
    await page.waitForTimeout(1500);
    try {
      const sansRedis = await messageApresTentative(page, "demo1234");
      verifier(
        "Redis coupé : on entre quand même, avec les bons identifiants",
        !sansRedis.url.endsWith("/login"),
        `écran : ${sansRedis.texte.replace(/\s+/g, " ").slice(0, 160)}`
      );
    } finally {
      execFileSync("bash", ["-lc", "redis-server --daemonize yes --save '' >/dev/null 2>&1 || true"]);
      await page.waitForTimeout(1500);
    }
  } else {
    console.log("  · Redis n'était pas là au départ : ce volet est sauté (et le dire vaut mieux que de le taire)");
  }

  // 3. **La base coupée — le cas exact du 12 août.** C'est celui qui lui
  //    répondait « Email ou mot de passe incorrect » alors que son mot de passe
  //    était bon. On ne coupe la base que si l'on sait la remonter : sur une
  //    machine où le cluster n'est pas celui du script local, on le DIT plutôt
  //    que de risquer de laisser la base à terre pour toutes les autres suites.
  const PGDATA = process.env.PGDATA_LOCAL ?? "/tmp/atlas-pgdata";
  const BIN = process.env.PG_BIN ?? "/usr/lib/postgresql/16/bin";
  const baseGouvernable = (() => {
    try {
      execFileSync("test", ["-f", `${PGDATA}/PG_VERSION`]);
      execFileSync("test", ["-x", `${BIN}/pg_ctl`]);
      return true;
    } catch {
      return false;
    }
  })();

  if (!baseGouvernable) {
    console.log(
      "  · La base n'est pas celle de `scripts/monter-base-locale.sh` : ce volet est sauté.\n" +
        "    Le dire plutôt que de le taire — c'est le cas qui a coûté sa soirée au patron."
    );
  } else {
    const pg = (action: string) =>
      execFileSync("su", [
        "postgres",
        "-c",
        `${BIN}/pg_ctl -D ${PGDATA} -o '-p 5432 -c listen_addresses=localhost' -l ${PGDATA}/log ${action}`,
      ], { stdio: "ignore" });
    pg("stop -m fast");
    await page.waitForTimeout(1500);
    try {
      const sansBase = await messageApresTentative(page, "demo1234");
      verifier(
        "base coupée : l'écran ne l'accuse PAS de s'être trompé de mot de passe",
        !sansBase.texte.includes("Email ou mot de passe incorrect"),
        "c'est le mensonge du 12 août 2026 : il pouvait retaper son mot de passe toute la nuit"
      );
      verifier(
        "base coupée : l'écran dit que ce n'est pas lui, et qu'un service ne répond pas",
        sansBase.texte.includes("Ce n'est pas votre mot de passe") &&
          sansBase.texte.includes("ne répond pas"),
        `écran : ${sansBase.texte.replace(/\s+/g, " ").slice(0, 200)}`
      );
    } finally {
      pg("start");
      await page.waitForTimeout(2500);
    }
  }

  await navigateur.close();
  console.log(`\n${echecs === 0 ? "✅" : "❌"} Connexion face aux pannes — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
