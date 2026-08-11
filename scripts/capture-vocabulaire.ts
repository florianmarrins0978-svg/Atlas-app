import { mkdirSync } from "node:fs";
import { lancerNavigateur } from "./e2e-browser";

// Regarder l'écran, et pas seulement les tests (`CLAUDE.md` §5).
// Suppose un serveur déjà démarré sur le port 3000, avec ATLAS_EDITEUR_EMAIL.

const BASE = "http://localhost:3000";
const OUT = "artifacts/screenshots/vocabulaire";

async function main() {
  mkdirSync(OUT, { recursive: true });
  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext();
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 20000 });

  await page.goto(`${BASE}/reglages/vocabulaire`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("text=/vocabulaire/i", { timeout: 20000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/01-vocabulaire.png`, fullPage: true });

  const texte = await page.locator("body").innerText();
  for (const attendu of ["33", "broyeur forestier", "définir ensemble"]) {
    console.log(`${texte.toLowerCase().includes(attendu.toLowerCase()) ? "✓" : "✗"} « ${attendu} » à l'écran`);
  }
  await navigateur.close();
  console.log(`Captures dans ${OUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
