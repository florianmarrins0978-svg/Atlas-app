import { chromium } from "playwright";
import { mkdirSync } from "fs";

const OUT = "artifacts/screenshots/step-23-prix-reel";
mkdirSync(OUT, { recursive: true });

async function main() {
  const browser = await chromium.launch({
    executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  });
  const context = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3 });
  const page = await context.newPage();

  await page.goto("http://localhost:3000/chantiers/nouveau", { waitUntil: "networkidle" });
  await page.fill('input[placeholder="M. Bernard"]', `Chantier capture prix ${Date.now()}`);
  await page.click('button:has-text("Créer le chantier")');
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/);
  const prixUrl = `${page.url()}/prix`;

  await page.goto(prixUrl, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${OUT}/01-etat-vide.png`, fullPage: true });

  await page.click("text=+ Ajouter une ligne");
  await page.waitForTimeout(200);
  await page.click("text=+ Ajouter une ligne");
  await page.waitForTimeout(200);
  await page.click("text=+ Ajouter une ligne");
  await page.waitForTimeout(300);
  const inputs = page.locator("form input");
  await inputs.nth(0).fill("Main d'œuvre — 2 hommes × 2 jours");
  await inputs.nth(1).fill("1120.00");
  await inputs.nth(2).fill("Dépose carrelage — 8 m²");
  await inputs.nth(3).fill("144.00");
  await inputs.nth(4).fill("Forfait déplacement");
  await inputs.nth(5).fill("35.00");
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/02-rempli-total.png`, fullPage: true });

  await browser.close();
  console.log("captured 2 états");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
