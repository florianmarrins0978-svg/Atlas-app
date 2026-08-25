// Capture l'écran Réglages → Documents, cadré sur « Mon message au client »
// simplifié (25 août 2026) : plus de pastilles, deux aperçus côte à côte, le
// doré qui montre ce qu'Atlas remplit. §5 : on REGARDE l'écran.
//
//   npx tsx scripts/capture-message-client.mts <dossier>
import { lancerNavigateur } from "./e2e-browser";
import type { Page } from "playwright";
import { mkdirSync } from "node:fs";
import path from "node:path";

const BASE = process.env.ATLAS_BASE ?? "http://localhost:3000";
const dossier = process.argv[2] ?? "/tmp/captures-message";
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

const zone = page.locator('[data-atlas="message-client"]').first();
await zone.scrollIntoViewIfNeeded();
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(dossier, "message-defaut.png") });

// Les deux aperçus visibles ensemble.
const apercus = page.locator('[data-atlas="apercu-facture"]').first();
if (await apercus.count()) {
  await apercus.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(dossier, "message-apercus.png") });
}

await navigateur.close();
console.log("Captures écrites dans", dossier);
