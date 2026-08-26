// Capture le bloc « Le numéro de mes documents » (Réglages → Devis & factures),
// posé le 26 août 2026 sur sa demande — pour le REGARDER.
//
// `CLAUDE.md` §5 : quatre défauts réels de ce dépôt sont sortis d'une image et
// d'aucun test vert.
//
//   npx tsx scripts/capture-format-numero.mts <dossier>
import { lancerNavigateur } from "./e2e-browser";
import type { Page } from "playwright";
import { mkdirSync } from "node:fs";
import path from "node:path";

const BASE = process.env.ATLAS_BASE ?? "http://localhost:3000";
const dossier = process.argv[2] ?? "/tmp/captures-format";
mkdirSync(dossier, { recursive: true });

async function connecter(page: Page) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 60_000 });
}

const navigateur = await lancerNavigateur();
const contexte = await navigateur.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
});
const page = await contexte.newPage();
await connecter(page);

await page.goto(`${BASE}/reglages/documents`, { waitUntil: "networkidle" });
await page.waitForSelector('button[data-atlas^="format-"]', { timeout: 60_000 });

const bloc = page.locator('button[data-atlas="format-annee-4"]').first();
await bloc.scrollIntoViewIfNeeded();
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(dossier, "format-numero.png") });

// Et le même bloc sur « une suite sans année » : c'est là que la phrase de
// conséquence change, et une phrase figée ne se verrait qu'à l'image.
await page.click('button[data-atlas="format-suite"]');
await page.waitForTimeout(1200);
await page.screenshot({ path: path.join(dossier, "format-numero-suite.png") });
await page.click('button[data-atlas="format-annee-6"]');
await page.waitForTimeout(1200);

await navigateur.close();
console.log("Captures écrites dans", dossier);
