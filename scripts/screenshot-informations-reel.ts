import { chromium, devices } from "playwright";
import { mkdirSync } from "fs";

const OUT = "artifacts/screenshots/step-22-informations-reel";
mkdirSync(OUT, { recursive: true });

async function main() {
  const browser = await chromium.launch({
    executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  });
  const context = await browser.newContext({ ...devices["iPhone 13"], });
  const page = await context.newPage();

  await page.goto("http://localhost:3000/chantiers/nouveau", { waitUntil: "networkidle" });
  await page.fill('input[placeholder="M. Bernard"]', `Chantier capture info ${Date.now()}`);
  await page.click('button:has-text("Créer le chantier")');
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/);
  const infoUrl = `${page.url()}/informations`;

  await page.goto(infoUrl, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${OUT}/01-etat-vide.png`, fullPage: true });

  await page.click("text=+ Ajouter une prestation");
  await page.waitForTimeout(300);
  await page.click("text=+ Ajouter un matériel");
  await page.waitForTimeout(300);
  const prestationInput = page
    .locator("div.flex.flex-col.gap-2", { has: page.locator("span", { hasText: "Prestations" }) })
    .locator("input")
    .first();
  await prestationInput.fill("Dépose carrelage");
  const materielInput = page
    .locator("div.flex.flex-col.gap-2", { has: page.locator("span", { hasText: "Matériel" }) })
    .locator("input")
    .first();
  await materielInput.fill("Colle flex");
  await page.locator("label", { hasText: "Durée" }).locator("input").fill("3 jours");
  await page.locator("label", { hasText: "Équipe" }).locator("input").fill("2 hommes");
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/02-rempli.png`, fullPage: true });

  await browser.close();
  console.log("captured 2 états");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
