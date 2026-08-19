import { chromium, devices } from "playwright";
import { mkdirSync } from "fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FAKE_MIC = path.join(__dirname, "fixtures", "fake-mic.wav");
const OUT = "artifacts/screenshots/step-21-note-vocale-reel";
mkdirSync(OUT, { recursive: true });

async function main() {
  const browser = await chromium.launch({
    executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream",
      `--use-file-for-fake-audio-capture=${FAKE_MIC}`,
    ],
  });
  const context = await browser.newContext({
    ...devices["iPhone 13"], permissions: ["microphone"],
  });
  const page = await context.newPage();

  await page.goto("http://localhost:3000/chantiers/nouveau", { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Bernard"]', `Chantier capture note ${Date.now()}`);
  await page.click('[data-atlas="action-dicter"]');
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/);
  const noteUrl = `${page.url()}/note-vocale`;

  await page.goto(noteUrl, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${OUT}/01-vide.png`, fullPage: true });

  await page.click('button:has-text("Enregistrer une note vocale")');
  await page.waitForSelector("text=Enregistrement en cours");
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/02-enregistrement.png`, fullPage: true });

  await page.click('button:has-text("Arrêter l\'enregistrement")');
  await page.waitForSelector("text=Enregistrée à l'instant");
  await page.screenshot({ path: `${OUT}/03-note-enregistree.png`, fullPage: true });

  await browser.close();
  console.log("captured 3 états");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
