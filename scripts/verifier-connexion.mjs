import { chromium } from "playwright";

// Se connecte réellement à Atlas, dans un vrai navigateur, EN SE FAISANT PASSER
// pour le proxy de Codespaces.
//
// Pourquoi ce contrôle existe : pendant une demi-journée, le patron n'a pas pu
// ouvrir l'application. Elle démarrait pourtant parfaitement — elle refusait sa
// connexion avec « Invalid Server Actions request. ». Next.js compare l'en-tête
// `Origin` à l'hôte, et derrière le proxy de Codespaces les deux diffèrent :
// sans `allowedOrigins` correctement rempli, TOUTE action serveur est refusée,
// à commencer par le formulaire de connexion.
//
// Aucun contrôle existant ne pouvait le voir : ils interrogeaient tous
// `127.0.0.1`, où l'origine et l'hôte coïncident. Le défaut n'apparaissait que
// derrière un nom de domaine différent — c'est-à-dire uniquement chez le
// patron. D'où ce contrôle, qui pose délibérément une origine étrangère.
//
// Il ne définit PAS `CODESPACE_NAME` : c'est exactement l'état du conteneur du
// patron, où la variable n'entrait pas. Si la connexion passe quand même, c'est
// que l'application ne dépend plus de cette variable pour laisser entrer.

const BASE = process.env.BASE_ESSAI ?? "http://127.0.0.1:3000";

// Une origine qui ne peut jamais coïncider avec l'hôte interrogé : c'est tout
// l'intérêt. Elle imite la forme réelle d'une adresse Codespaces.
const ORIGINE_ETRANGERE = "https://banc-essai-fictif-3000.app.github.dev";

const IDENTIFIANTS = { email: "demo@atlas.local", motDePasse: "demo1234" };

/** Playwright ne trouve pas toujours seul le navigateur pré-installé. */
function cheminNavigateur() {
  return process.env.CHROMIUM_PATH || undefined;
}

function echec(message, detail) {
  console.error(`\n❌ ${message}`);
  if (detail) console.error(detail);
  process.exit(1);
}

const nav = await chromium.launch({ executablePath: cheminNavigateur() });
const page = await nav.newPage({ viewport: { width: 390, height: 844 } });

// Toutes les requêtes porteront cette origine, y compris le POST de l'action
// de connexion — c'est celui-là qui était refusé.
await page.setExtraHTTPHeaders({ Origin: ORIGINE_ETRANGERE });

const erreurs = [];
page.on("pageerror", (e) => erreurs.push(String(e)));

try {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });

  await page.locator('input[name="email"]').fill(IDENTIFIANTS.email);
  await page.locator('input[name="password"]').fill(IDENTIFIANTS.motDePasse);
  await page.locator('button[type="submit"]').click();

  // On attend l'écran d'accueil réel, pas une simple absence d'erreur : un
  // formulaire qui ne fait rien du tout passerait sinon pour un succès.
  await page.getByRole("heading", { name: "Chantiers" }).waitFor({ timeout: 60_000 });

  const texte = await page.locator("body").innerText();
  if (texte.includes("Invalid Server Actions request")) {
    echec("l'action de connexion est refusée : allowedOrigins ne couvre pas l'origine du proxy");
  }

  console.log(`   ✅ Connexion réussie depuis une origine étrangère (${ORIGINE_ETRANGERE})`);
  console.log("   ✅ L'écran des chantiers s'affiche");
} catch (e) {
  const texte = await page
    .locator("body")
    .innerText()
    .catch(() => "(page illisible)");

  if (texte.includes("Invalid Server Actions request")) {
    echec(
      "l'action de connexion est REFUSÉE derrière un proxy.",
      "     Next.js compare Origin à l'hôte. Voir `allowedOrigins` dans next.config.ts\n" +
        "     et la reprise de CODESPACE_NAME dans .devcontainer/docker-compose.yml.\n" +
        "     C'est ce que le patron voyait : « Invalid Server Actions request. »"
    );
  }

  echec(
    "la connexion n'aboutit pas à l'écran des chantiers.",
    `     ${e instanceof Error ? e.message : e}\n\n     Ce que montrait la page :\n${texte.slice(0, 500)}` +
      (erreurs.length ? `\n\n     Erreurs du navigateur :\n     ${erreurs.slice(0, 3).join("\n     ")}` : "")
  );
} finally {
  await nav.close();
}
