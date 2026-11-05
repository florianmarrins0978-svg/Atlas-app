import { chromium, devices } from "playwright";
import { mkdirSync } from "fs";
import { cheminDuNavigateur } from "./_navigateur.mjs";

const OUT = "artifacts/screenshots/step-31-ia-05-catalogue";
mkdirSync(OUT, { recursive: true });

async function main() {
  const browser = await chromium.launch({
    executablePath: cheminDuNavigateur(),
  });
  const context = await browser.newContext({ ...devices["iPhone 13"], });
  const page = await context.newPage();

  await page.goto("http://localhost:3000/catalogue", { waitUntil: "networkidle" });
  await page.screenshot({ path: `${OUT}/01-catalogue.png`, fullPage: true });

  await browser.close();
  console.log("captured 1 état");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
