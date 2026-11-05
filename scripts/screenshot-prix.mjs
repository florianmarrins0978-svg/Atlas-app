import { chromium, devices } from "playwright";
import { mkdirSync } from "fs";

const OUT = "artifacts/screenshots/step-13-prix";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const context = await browser.newContext({
  ...devices["iPhone 13"], });
const page = await context.newPage();

await page.goto("http://localhost:3000/design/prix", { waitUntil: "networkidle" });

// État 1 — par défaut
await page.screenshot({ path: `${OUT}/01-defaut.png`, fullPage: true });

// État 2 — modification d'un montant, total recalculé en direct
const montants = page.locator('input[type="number"]');
await montants.first().fill("1300");
await montants.first().blur();
await page.waitForTimeout(150);
await page.screenshot({ path: `${OUT}/02-montant-modifie-total-recalcule.png`, fullPage: true });

// État 3 — suppression d'une ligne + toast
const retirer = page.locator('button[aria-label="Retirer cette ligne"]');
await retirer.last().click();
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/03-ligne-supprimee-toast.png`, fullPage: true });

await browser.close();
console.log("captured 3 états");
