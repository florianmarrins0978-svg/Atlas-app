import { chromium, devices } from "playwright";
import { mkdirSync } from "fs";
import { cheminDuNavigateur } from "./_navigateur.mjs";

const OUT = "artifacts/screenshots/step-28-dashboard-reel";
mkdirSync(OUT, { recursive: true });

async function main() {
  const browser = await chromium.launch({
    executablePath: cheminDuNavigateur(),
  });
  const context = await browser.newContext({ ...devices["iPhone 13"], });
  const page = await context.newPage();

  await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  await page.screenshot({ path: `${OUT}/01-accueil-reel.png`, fullPage: true });

  await browser.close();
  console.log("captured 1 état");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
