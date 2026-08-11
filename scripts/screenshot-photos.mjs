import { chromium, devices } from "playwright";
import { mkdirSync } from "fs";

const OUT = "artifacts/screenshots/step-07-photos";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const context = await browser.newContext({
  ...devices["iPhone 13"], });
const page = await context.newPage();

await page.goto("http://localhost:3000/design/photos", { waitUntil: "networkidle" });

// État 1 — grille remplie (état par défaut de la maquette : 6 photos)
await page.screenshot({ path: `${OUT}/01-grille-remplie.png` });

// État 2 — visionneuse plein écran
await page.click('button[aria-label="Voir la photo 1"]');
await page.waitForTimeout(150);
await page.screenshot({ path: `${OUT}/02-visionneuse.png` });

// État 3 — retour à la grille après fermeture, puis vidage complet pour montrer l'état vide
await page.click('button[aria-label="Fermer"]');
await page.waitForTimeout(150);
for (let i = 0; i < 6; i++) {
  const first = await page.$('button[aria-label^="Voir la photo"]');
  if (first) {
    await first.click();
    await page.waitForTimeout(100);
    await page.click('button[aria-label="Supprimer cette photo"]');
    await page.waitForTimeout(100);
  }
}
await page.screenshot({ path: `${OUT}/03-etat-vide.png` });

await browser.close();
console.log("captured 3 états");
