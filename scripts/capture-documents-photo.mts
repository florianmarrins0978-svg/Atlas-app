// Capture l'écran Réglages → Documents, pour REGARDER la section neuve
// « Photographier mon devis » posée le 25 août 2026 (§5 : trois défauts réels
// n'ont été trouvés qu'à l'image, jamais par un test vert).
//
//   npx tsx scripts/capture-documents-photo.mts <dossier>
import { lancerNavigateur } from "./e2e-browser";
import type { Page } from "playwright";
import { mkdirSync } from "node:fs";
import path from "node:path";

const BASE = process.env.ATLAS_BASE ?? "http://localhost:3000";
const dossier = process.argv[2] ?? "/tmp/captures-documents";
mkdirSync(dossier, { recursive: true });

async function connecter(page: Page) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });
}

const navigateur = await lancerNavigateur();
const contexte = await navigateur.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
});
const page = await contexte.newPage();
await connecter(page);

await page.goto(`${BASE}/reglages/documents`, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
await page.screenshot({ path: path.join(dossier, "documents-complet.png"), fullPage: true });

// Cadrer la section neuve : le bloc « L'allure de mes devis » et sa tête photo.
const bloc = page.locator('[data-atlas="photo-devis"]').first();
if (await bloc.count()) {
  await bloc.scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(dossier, "documents-photo.png") });
}

await navigateur.close();
console.log("Captures écrites dans", dossier);
