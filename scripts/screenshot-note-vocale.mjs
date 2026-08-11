import { chromium, devices } from "playwright";
import { mkdirSync } from "fs";

const OUT = "artifacts/screenshots/step-09-note-vocale";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const context = await browser.newContext({
  ...devices["iPhone 13"], });
const page = await context.newPage();

await page.goto("http://localhost:3000/design/note-vocale", { waitUntil: "networkidle" });

// État 1 — vide
await page.screenshot({ path: `${OUT}/01-vide.png` });

// État 2 — enregistrement en cours
await page.click('button:has-text("Enregistrer une note vocale")');
await page.waitForTimeout(2200); // laisse le minuteur avancer un peu, visible sur la capture
await page.screenshot({ path: `${OUT}/02-enregistrement.png` });

// État 3 — note enregistrée
await page.click('button:has-text("Arrêter l\'enregistrement")');
await page.waitForTimeout(150);
await page.screenshot({ path: `${OUT}/03-note-enregistree.png` });

// État 4 — confirmation de remplacement
await page.click("text=Remplacer la note");
await page.waitForTimeout(150);
await page.screenshot({ path: `${OUT}/04-confirmation-remplacement.png` });

await browser.close();
console.log("captured 4 états");
