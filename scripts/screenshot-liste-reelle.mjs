import { chromium, devices } from "playwright";
import { mkdirSync } from "fs";
import { cheminDuNavigateur } from "./_navigateur.mjs";

const OUT = "artifacts/screenshots/step-04-liste-reelle";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: cheminDuNavigateur(),
});
const context = await browser.newContext({
  ...devices["iPhone 13"], });
const page = await context.newPage();
await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
await page.screenshot({ path: `${OUT}/liste-chantiers-reelle.png` });
await browser.close();
console.log("captured liste-chantiers-reelle");
