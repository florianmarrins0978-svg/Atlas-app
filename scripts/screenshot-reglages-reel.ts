import { chromium } from "playwright";
import { mkdirSync } from "fs";

const OUT = "artifacts/screenshots/step-26-reglages-reel";
mkdirSync(OUT, { recursive: true });

async function main() {
  const browser = await chromium.launch({
    executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  });
  const context = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3 });
  const page = await context.newPage();

  await page.goto("http://localhost:3000/reglages", { waitUntil: "networkidle" });
  await page.screenshot({ path: `${OUT}/01-liste-reelle.png`, fullPage: true });

  await page.click("text=Ajouter un tarif");
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/02-apres-ajout.png`, fullPage: true });

  await browser.close();
  console.log("captured 2 états");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
