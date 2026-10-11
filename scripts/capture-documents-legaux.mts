// L'écran où l'artisan ACCEPTE les conditions, et la page qu'il y lit.
//
//   ATLAS_BASE=http://localhost:3003 npx tsx scripts/capture-documents-legaux.mts <dossier>
//
// **Pourquoi cette capture existe.** Sa question du 9 septembre 2026 — « ça sera
// visible où ? » — a montré que ce qui est ACCEPTÉ n'est pas ce qui est PUBLIÉ :
// le texte coché à l'inscription est un canevas de quatre paragraphes, le vrai
// document de dix-neuf articles n'est accepté par personne. Avant de proposer
// quoi que ce soit, on regarde l'écran (`CLAUDE.md` §5).
//
// **Il efface les acceptations du compte de démonstration** pour que la page
// s'affiche : sans cela elle redirige vers l'accueil, et l'on photographierait
// autre chose en croyant l'avoir vue.
//
// **`localhost`, JAMAIS `127.0.0.1`** — sinon Next ne sert pas le JavaScript.
import { mkdirSync } from "node:fs";
import { Client } from "pg";
import { lancerNavigateur } from "./e2e-browser";
import type { Page } from "playwright";

const BASE = process.env.ATLAS_BASE ?? "http://localhost:3000";
const dossier = process.argv[2] ?? "./captures-legaux";
mkdirSync(dossier, { recursive: true });

const admin = new Client({
  connectionString: process.env.ATLAS_BASE_SUPER ?? process.env.DATABASE_ADMIN_URL,
});
await admin.connect();
const { rowCount } = await admin.query(
  `delete from acceptations_documents
    where utilisateur_id = (select id from users where email = 'demo@atlas.local')`
);
await admin.end();
console.log(`acceptations effacées : ${rowCount}`);

async function seConnecter(page: Page) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.locator('input[name="email"]').waitFor();
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForTimeout(3000);
}

const navigateur = await lancerNavigateur();
const contexte = await navigateur.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await contexte.newPage();
const erreurs: string[] = [];
page.on("pageerror", (e) => erreurs.push(String(e)));

await seConnecter(page);

// 1 — L'écran d'acceptation, celui qui engage.
const r = await page.goto(`${BASE}/documents-legaux`, { waitUntil: "networkidle" });
await page.waitForTimeout(700);
const titre = (await page.locator("h1").first().textContent().catch(() => null))?.trim() ?? "—";
console.log(`documents-legaux ${r?.status()} · « ${titre} »`);
if (titre !== "Avant de commencer") {
  console.log("⚠ ce n'est pas l'écran attendu — rien n'est mesuré.");
} else {
  const mots = (await page.locator("body").innerText()).split(/\s+/).filter(Boolean).length;
  const hauteur = await page.evaluate(() => document.body.scrollHeight);
  console.log(`  ${mots} mots · ${hauteur} px`);
  await page.screenshot({ path: `${dossier}/documents-legaux.png`, fullPage: true });
}

// 2 — La page que ce lien ouvre, servie par l'application elle-même.
await page.goto(`${BASE}/conditions-utilisation.html`, { waitUntil: "networkidle" });
await page.waitForTimeout(500);
const articles = await page.locator("h2").count();
console.log(`conditions-utilisation.html · ${articles} articles`);
await page.screenshot({ path: `${dossier}/conditions-servies.png`, fullPage: false });

console.log("erreurs :", erreurs.length ? erreurs : "aucune");
await navigateur.close();
