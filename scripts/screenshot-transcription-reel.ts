import { chromium, devices } from "playwright";
import { mkdirSync } from "fs";

const OUT = "artifacts/screenshots/step-27-transcription-reel";
mkdirSync(OUT, { recursive: true });

async function main() {
  const browser = await chromium.launch({
    executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  });
  const context = await browser.newContext({ ...devices["iPhone 13"], });
  const page = await context.newPage();

  await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  await page.click("text=Rénovation salle de bain");
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/);
  await page.goto(`${page.url()}/transcription`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${OUT}/01-avec-transcription.png`, fullPage: true });

  await page.goto("http://localhost:3000/chantiers/nouveau", { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Bernard"]', `Chantier capture transcription ${Date.now()}`);
  await page.click('button:has-text("Créer le chantier")');
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/);
  await page.goto(`${page.url()}/transcription`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${OUT}/02-sans-note.png`, fullPage: true });

  await browser.close();
  console.log("captured 2 états");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
