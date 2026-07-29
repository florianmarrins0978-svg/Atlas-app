import { chromium } from "playwright";
import { mkdirSync } from "fs";

const OUT = "artifacts/screenshots/step-17-planning";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const context = await browser.newContext({
  viewport: { width: 393, height: 852 },
  deviceScaleFactor: 3,
});
const page = await context.newPage();

await page.goto("http://localhost:3000/design/planning", { waitUntil: "networkidle" });

// État 1 — deux chantiers à planifier, aucun planifié
await page.screenshot({ path: `${OUT}/01-a-planifier.png`, fullPage: true });

// État 2 — sheet de choix de date ouverte
await page.click("text=Reprise de toiture");
await page.waitForTimeout(150);
await page.fill('input[type="date"]', "2026-08-04");
await page.waitForTimeout(150);
await page.screenshot({ path: `${OUT}/02-choix-date.png`, fullPage: true });

// État 3 — après confirmation, le chantier passe dans "Planifiés"
await page.click("text=Confirmer la planification");
await page.waitForTimeout(150);
await page.screenshot({ path: `${OUT}/03-apres-confirmation.png`, fullPage: true });

await browser.close();
console.log("captured 3 états");
