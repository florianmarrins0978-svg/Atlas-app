import { chromium, devices } from "playwright";
import { mkdirSync } from "fs";

const OUT = "artifacts/screenshots/step-11-informations";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const context = await browser.newContext({
  ...devices["iPhone 13"], });
const page = await context.newPage();

await page.goto("http://localhost:3000/design/informations", { waitUntil: "networkidle" });

// État 1 — formulaire par défaut
await page.screenshot({ path: `${OUT}/01-formulaire-defaut.png`, fullPage: true });

// État 2 — ajout d'une prestation
await page.click("text=+ Ajouter une prestation");
await page.waitForTimeout(150);
await page.screenshot({ path: `${OUT}/02-apres-ajout-prestation.png`, fullPage: true });

// État 3 — retrait d'une ligne de matériel
const retirer = page.locator('button[aria-label="Retirer cette ligne"]');
await retirer.last().click();
await page.waitForTimeout(150);
await page.screenshot({ path: `${OUT}/03-apres-retrait-materiel.png`, fullPage: true });

await browser.close();
console.log("captured 3 états");
