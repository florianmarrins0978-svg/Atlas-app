import { chromium, devices } from "playwright";
import { mkdirSync } from "fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { creerPuisFiche } from "./_creer-chantier-e2e";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(__dirname, "fixtures", "test-photo.jpg");
const OUT = "artifacts/screenshots/step-20-photos-reel";
mkdirSync(OUT, { recursive: true });

async function main() {
  const browser = await chromium.launch({
    executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  });
  const context = await browser.newContext({ ...devices["iPhone 13"], });
  const page = await context.newPage();

  await page.goto("http://localhost:3000/chantiers/nouveau", { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Bernard"]', `Chantier capture ${Date.now()}`);
  await creerPuisFiche(page);
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/);

  // La pellicule du tiroir a remplacé l'écran Photos le 11 août 2026 : tout se
  // fait sur la fiche, une fois le tiroir ouvert.
  await page.click('button[aria-label="Ouvrir le détail du chantier"]');
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OUT}/01-pellicule-vide.png`, fullPage: true });

  const [fileChooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.click('button[aria-label="Ajouter des photos"]'),
  ]);
  await fileChooser.setFiles(FIXTURE);
  await page.waitForSelector('img[src^="/api/fichiers/"]');
  await page.screenshot({ path: `${OUT}/02-pellicule-avec-photo-reelle.png`, fullPage: true });

  await page.locator('button[aria-label^="Voir la photo"]').first().click();
  await page.waitForSelector('button[aria-label="Fermer"]');
  await page.screenshot({ path: `${OUT}/03-visionneuse-photo-reelle.png`, fullPage: true });

  await browser.close();
  console.log("captured 3 états");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
