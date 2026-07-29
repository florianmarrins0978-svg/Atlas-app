import { chromium } from "playwright";
import { mkdirSync } from "fs";

const OUT = "artifacts/screenshots/step-05-nouveau-chantier";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const context = await browser.newContext({
  viewport: { width: 393, height: 852 },
  deviceScaleFactor: 3,
});
const page = await context.newPage();

await page.goto("http://localhost:3000/design/nouveau-chantier", { waitUntil: "networkidle" });

// État 1 — champ nom vide, bouton désactivé
await page.screenshot({ path: `${OUT}/01-nom-vide-bouton-desactive.png` });

// État 2 — nom renseigné, bouton actif
await page.fill('input[placeholder="Rénovation salle de bain"]', "Rénovation salle de bain");
await page.waitForTimeout(400); // laisse la transition CSS du bouton se stabiliser
await page.screenshot({ path: `${OUT}/02-nom-rempli-bouton-actif.png` });

// État 3 — adresse client dépliée
await page.click("text=+ Ajouter une adresse client différente");
await page.waitForTimeout(200);
await page.screenshot({ path: `${OUT}/03-adresse-client-depliee.png` });

await browser.close();
console.log("captured 3 états");
