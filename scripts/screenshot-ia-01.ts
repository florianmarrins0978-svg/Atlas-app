import { chromium } from "playwright";
import { mkdirSync } from "fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FAKE_MIC = path.join(__dirname, "fixtures", "fake-mic.wav");
const OUT = "artifacts/screenshots/step-29-ia-01";
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
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 3,
    permissions: ["microphone"],
  });
  const page = await context.newPage();

  await page.goto("http://localhost:3000/chantiers/nouveau", { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Rénovation salle de bain"]', `Chantier capture IA ${Date.now()}`);
  await page.click('button:has-text("Créer le chantier")');
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/);
  const chantierUrl = page.url();

  await page.goto(`${chantierUrl}/note-vocale`, { waitUntil: "networkidle" });
  await page.click('button:has-text("Enregistrer une note vocale")');
  await page.waitForSelector("text=Enregistrement en cours");
  await page.waitForTimeout(1000);
  await page.click("button:has-text(\"Arrêter l'enregistrement\")");
  await page.waitForSelector("text=Enregistrée à l'instant");
  await page.screenshot({ path: `${OUT}/01-note-vocale-avec-transcription-non-demandee.png`, fullPage: true });

  await page.click("text=Lancer la transcription");
  await page.waitForSelector("text=Transcription disponible", { timeout: 10000 });
  await page.screenshot({ path: `${OUT}/02-note-vocale-transcription-reussie.png`, fullPage: true });

  await page.goto(`${chantierUrl}/transcription`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${OUT}/03-transcription-reelle.png`, fullPage: true });

  await page.goto(`${chantierUrl}/informations`, { waitUntil: "networkidle" });
  await page.fill("textarea", "Deux jours, deux hommes, dix plaques de BA13, poser la cloison");
  await page.click('button:has-text("Analyser")');
  await page.waitForSelector("text=Informations détectées", { timeout: 10000 });
  await page.screenshot({ path: `${OUT}/04-informations-proposition.png`, fullPage: true });

  await browser.close();
  console.log("captured 4 états");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
