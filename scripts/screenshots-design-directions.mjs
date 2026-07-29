import { chromium } from "playwright";
import { mkdirSync } from "fs";

const OUT = "artifacts/screenshots/step-02-design-directions";
mkdirSync(OUT, { recursive: true });

const pages = [
  { path: "/design/a", name: "option-a-apple" },
  { path: "/design/b", name: "option-b-linear" },
  { path: "/design/c", name: "option-c-atlas" },
  { path: "/design/d", name: "option-d-arborea" },
  { path: "/design/hub", name: "hub-fiche-chantier" },
];

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const context = await browser.newContext({
  viewport: { width: 393, height: 852 },
  deviceScaleFactor: 3,
});
const page = await context.newPage();

for (const { path, name } of pages) {
  await page.goto(`http://localhost:3000${path}`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(`captured ${name}`);
}

await browser.close();
