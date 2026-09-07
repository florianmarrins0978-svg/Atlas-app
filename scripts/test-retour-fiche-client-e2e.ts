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

  // ─── CE CAS A PERDU SON ÉCRAN, ET IL FAUT SAVOIR CE QUE ÇA COÛTE ──────────
  //
  // « depuis un CHANTIER : la flèche ramène au chantier » ouvrait la fiche du
  // client depuis un chantier, puis vérifiait que la flèche y ramenait. Cette
  // porte vivait dans le tiroir de la fiche du chantier (arrangement B du
  // 16 août 2026) ; **cette fiche est retirée le 4 septembre**
  // (`ARCHITECTURE.md` §254), et le tiroir avec.
  //
  // **AUCUN ÉCRAN N'OUVRE PLUS `/clients/[id]` DEPUIS UN CHANTIER.** Ce cas ne
  // peut donc plus être joué : il n'a plus de porte d'entrée. Le réécrire sur
  // un autre écran serait inventer un chemin que le produit n'offre pas, et un
  // contrôle qui se cherche une porte de service ne dit plus rien de celle que
  // le patron emprunte (`CLAUDE.md` §5 quater).
  //
  // Ce n'est pas un oubli : c'est le prix du retrait, écrit plutôt que
  // découvert, et `TODO.md` porte la question — faut-il lui rendre cette porte,
  // et où ? Lui seul peut trancher.
  //
  // **Le mécanisme, lui, reste éprouvé** : l'aller et le retour se répondent
  // dans `test-retour-fiche-client.ts`, et le cas suivant tient toujours qu'une
  // origine étrangère ne fait pas sortir d'Atlas.

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
