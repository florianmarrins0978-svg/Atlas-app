import assert from "node:assert/strict";
import { lancerNavigateur, DELAI_PAR_DEFAUT_MS } from "./e2e-browser";
import type { Page } from "playwright";

// **Un appui sur « retour » doit défaire UN pas, pas deux.**
//
// ─────────────────────────────────────────────────────────────────────────────
// Le patron, le 20 août 2026, sur la fiche d'un client : *« quand j'appuie sur
// retour, ça ne me fait pas un retour, mais deux retours. Je reviens
// directement à la page vos chantiers. Or, je devrais rester dans la catégorie
// mes clients. »*
//
// La règle est déjà tenue sans navigateur (`test-retour-fiche-client.ts`). Ce
// que CETTE suite ajoute : **le chemin réel**, appuyé pour de bon, depuis les
// deux endroits d'où la fiche s'ouvre. Une règle juste derrière un lien mal
// posé ramène quand même au mauvais écran.
//
// Elle tient aussi sans que la page s'anime : la flèche est un vrai lien, et le
// navigateur le suit — c'est précisément ce qu'on veut d'une sortie de secours.

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";

let echecs = 0;
async function cas(nom: string, f: () => Promise<void>) {
  try {
    await f();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

async function seConnecter(page: Page) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.locator('input[name="email"]').waitFor();
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: DELAI_PAR_DEFAUT_MS });
}

/** Le chemin courant, sans l'hôte ni les paramètres. */
const chemin = (page: Page) => new URL(page.url()).pathname;

async function principal() {
  console.log("=== La flèche de la fiche client ===\n");
  const nav = await lancerNavigateur();
  const page = await (await nav.newContext()).newPage();
  await seConnecter(page);

  await cas("depuis VOS CLIENTS : la flèche ramène chez les clients", async () => {
    await page.goto(`${BASE}/clients`, { waitUntil: "domcontentloaded" });
    const premier = page.locator('ul li a[href^="/clients/"]').first();
    await premier.waitFor();
    await premier.click();
    await page.waitForURL(/\/clients\/[^/]+$/, { timeout: DELAI_PAR_DEFAUT_MS });

    const fleche = page.locator('a[aria-label^="Retour"]').first();
    await fleche.waitFor();
    await fleche.click();
    await page.waitForURL(/\/clients\/?$/, { timeout: DELAI_PAR_DEFAUT_MS });

    assert.equal(
      chemin(page),
      "/clients",
      `un appui a mené à « ${chemin(page)} » : c'est le double saut qu'il a signalé`
    );
  });

  await cas("depuis un CHANTIER : la flèche ramène au chantier, pas chez les clients", async () => {
    // **On cherche un chantier qui ait un client**, au lieu de prendre le
    // premier venu : tous n'en ont pas, et conclure sur celui-là ne mesurerait
    // rien (`CLAUDE.md` §5).
    await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
    const liens = await page.locator('a[href^="/chantiers/"]').evaluateAll((as) =>
      as.map((a) => (a as HTMLAnchorElement).getAttribute("href") ?? "")
    );
    const candidats = [...new Set(liens.filter((h) => /^\/chantiers\/[^/]+$/.test(h)))];
    assert.ok(candidats.length > 0, "aucun chantier sur l'accueil : ce contrôle ne mesure rien");

    let chantier = "";
    for (const c of candidats) {
      await page.goto(`${BASE}${c}`, { waitUntil: "domcontentloaded" });
      if ((await page.locator('a[href^="/clients/"]').count()) > 0) {
        chantier = new URL(page.url()).pathname;
        break;
      }
    }
    assert.ok(
      chantier,
      `aucun des ${candidats.length} chantiers de l'accueil n'ouvre une fiche client — rien à mesurer`
    );

    await page.locator('a[href^="/clients/"]').first().click();
    await page.waitForURL(/\/clients\/[^/]+/, { timeout: DELAI_PAR_DEFAUT_MS });

    const fleche = page.locator('a[aria-label^="Retour"]').first();
    await fleche.waitFor();
    await fleche.click();
    await page.waitForURL((u) => new URL(u).pathname === chantier, { timeout: DELAI_PAR_DEFAUT_MS });
    assert.equal(chemin(page), chantier, `la flèche a mené à « ${chemin(page)} » au lieu du chantier`);
  });

  await cas("une origine étrangère ne fait pas sortir d'Atlas", async () => {
    await page.goto(`${BASE}/clients`, { waitUntil: "domcontentloaded" });
    const premier = page.locator('ul li a[href^="/clients/"]').first();
    await premier.waitFor();
    const href = await premier.getAttribute("href");
    await page.goto(`${BASE}${href}?de=${encodeURIComponent("https://ailleurs.example")}`, {
      waitUntil: "domcontentloaded",
    });
    const fleche = page.locator('a[aria-label^="Retour"]').first();
    await fleche.waitFor();
    const cible = await fleche.getAttribute("href");
    assert.equal(cible, "/clients", `la flèche pointe vers « ${cible} » : elle quitterait Atlas`);
  });

  await nav.close();
  console.log(`\n${echecs === 0 ? "✅" : "❌"} Le retour de la fiche client au navigateur — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

principal();
