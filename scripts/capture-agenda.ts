import { mkdirSync } from "node:fs";
import { lancerNavigateur } from "./e2e-browser";

// Regarder l'écran, et pas seulement les tests (`CLAUDE.md` §5).
// Suppose un serveur déjà démarré sur le port 3000.

const BASE = "http://localhost:3000";
const OUT = "artifacts/screenshots/agenda";

async function main() {
  mkdirSync(OUT, { recursive: true });
  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext({ viewport: { width: 393, height: 852 } });
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 20000 });

  await page.goto(`${BASE}/planning`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/00-planning.png`, fullPage: true });

  await page.goto(`${BASE}/reglages`, { waitUntil: "domcontentloaded" });
  await page.getByRole("link", { name: /Mon agenda/i }).waitFor({ timeout: 15000 });
  await page.screenshot({ path: `${OUT}/01-reglages.png`, fullPage: true });

  await page.goto(`${BASE}/reglages/agenda`, { waitUntil: "domcontentloaded" });
  await page.getByRole("heading", { name: "Mon agenda" }).waitFor({ timeout: 15000 });
  await page.waitForTimeout(400);
  const etat = (await page.locator("body").innerText()).includes("pas encore disponible")
    ? "non-configure"
    : "configure";
  await page.screenshot({ path: `${OUT}/02-agenda-${etat}.png`, fullPage: true });
  console.log(`état capturé : ${etat}`);

  await navigateur.close();
  console.log(`Captures dans ${OUT}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
