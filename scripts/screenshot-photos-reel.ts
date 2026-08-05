import { chromium } from "playwright";
import { mkdirSync } from "fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(__dirname, "fixtures", "test-photo.jpg");
const OUT = "artifacts/screenshots/step-20-photos-reel";
mkdirSync(OUT, { recursive: true });

async function main() {
  const browser = await chromium.launch({
    executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  });
  const context = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3 });
  const page = await context.newPage();

  await page.goto("http://localhost:3000/chantiers/nouveau", { waitUntil: "networkidle" });
  await page.fill('input[placeholder="M. Bernard"]', `Chantier capture ${Date.now()}`);
  await page.click('button:has-text("Créer le chantier")');
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/);
  const photosUrl = `${page.url()}/photos`;

  await page.goto(photosUrl, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${OUT}/01-grille-vide.png`, fullPage: true });

  const [fileChooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.click('button:has-text("Ajouter une photo")'),
  ]);
  await fileChooser.setFiles(FIXTURE);
  await page.waitForSelector("text=1 photo");
  await page.screenshot({ path: `${OUT}/02-grille-avec-photo-reelle.png`, fullPage: true });

  await page.locator('button[aria-label="Voir la photo"]').first().click();
  await page.waitForSelector('button[aria-label="Fermer"]');
  await page.screenshot({ path: `${OUT}/03-visionneuse-photo-reelle.png`, fullPage: true });

  await browser.close();
  console.log("captured 3 états");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
