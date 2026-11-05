import { chromium } from "playwright";
import { cheminDuNavigateur } from "./_navigateur.mjs";

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

// Reproduit l'écart RÉEL observé chez le patron, dans le bon sens :
//
//   x-forwarded-host … 'xxx-3000.app.github.dev' does not match
//   origin header with value 'localhost:3000'
//
// C'est l'HÔTE qui porte l'adresse publique et l'ORIGINE qui vaut
// `localhost:3000` — l'inverse de ce qu'on suppose spontanément. Trois
// correctifs ont été éprouvés contre une panne simulée à l'envers, et sont donc
// passés au vert sans jamais rien corriger chez lui.
const ORIGINE_NAVIGATEUR = "http://localhost:3000";
const HOTE_PUBLIC = "banc-essai-fictif-3000.app.github.dev";

const IDENTIFIANTS = { email: "demo@atlas.local", motDePasse: "demo1234" };

function echec(message, detail) {
  console.error(`\n❌ ${message}`);
  if (detail) console.error(detail);
  process.exit(1);
}

const nav = await chromium.launch({ executablePath: cheminDuNavigateur() });
const page = await nav.newPage({ viewport: { width: 390, height: 844 } });

// Le proxy de l'espace de travail ajoute `x-forwarded-host` avec l'adresse
// publique, tandis que le navigateur annonce `localhost:3000` comme origine.
// On rejoue exactement cette combinaison sur toutes les requêtes, POST de
// l'action de connexion compris — c'est celui-là qui était refusé.
await page.setExtraHTTPHeaders({
  Origin: ORIGINE_NAVIGATEUR,
  "x-forwarded-host": HOTE_PUBLIC,
});

const erreurs = [];
page.on("pageerror", (e) => erreurs.push(String(e)));

try {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 60_000 });

  await page.locator('input[name="email"]').fill(IDENTIFIANTS.email);
  await page.locator('input[name="password"]').fill(IDENTIFIANTS.motDePasse);
  await page.locator('button[type="submit"]').click();

  // On attend l'écran d'accueil réel, pas une simple absence d'erreur : un
  // formulaire qui ne fait rien du tout passerait sinon pour un succès.
  // Le titre de l'écran d'accueil est « Vos chantiers » depuis la refonte du
  // 9 août 2026 (`ARCHITECTURE.md` §46). Le nom exact compte : Playwright
  // compare la totalité du libellé accessible, pas un fragment.
  await page.getByRole("heading", { name: "Vos chantiers" }).waitFor({ timeout: 60_000 });

  const texte = await page.locator("body").innerText();
  if (texte.includes("Invalid Server Actions request")) {
    echec("l'action de connexion est refusée : allowedOrigins ne couvre pas l'origine du proxy");
  }

  console.log(`   ✅ Connexion réussie : origine ${ORIGINE_NAVIGATEUR}, hôte transmis ${HOTE_PUBLIC}`);
  console.log("   ✅ L'écran des chantiers s'affiche");
} catch (e) {
  const texte = await page
    .locator("body")
    .innerText()
    .catch(() => "(page illisible)");

  if (texte.includes("Invalid Server Actions request")) {
    echec(
      "l'action de connexion est REFUSÉE derrière un proxy.",
      "     Next.js compare Origin à l'hôte. Voir `alignerHoteSurOrigine` dans\n" +
        "     src/middleware.ts, et `allowedOrigins` dans next.config.ts.\n" +
        "     C'est ce que le patron voyait : « Invalid Server Actions request. »"
    );
  }

  // Le formulaire a répondu : l'origine n'est donc PAS en cause. C'est la base
  // qui n'a pas le compte. Distinguer les deux est essentiel — une fois, ce
  // message a fait croire à une origine refusée alors que `npm test` avait
  // simplement vidé la base juste avant.
  if (texte.includes("Email ou mot de passe incorrect")) {
    echec(
      "le compte de démonstration est absent : la base n'est pas amorcée.",
      "     L'origine n'est PAS en cause — l'action serveur a bien été acceptée,\n" +
        "     c'est le compte qui manque. Rejouer :\n" +
        "       npx tsx src/server/db/seed.ts"
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
