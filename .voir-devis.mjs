import { chromium } from "playwright";
import { existsSync, readdirSync } from "node:fs";
const S = "/tmp/claude-0/-home-user-Atlas-app/d6b05d71-7c9b-5a25-9bf8-30191feb5677/scratchpad";
function nav() {
  const r = process.env.PLAYWRIGHT_BROWSERS_PATH;
  const d = r && existsSync(r) ? readdirSync(r).find((x) => /^chromium-\d+$/.test(x)) : null;
  return d ? `${r}/${d}/chrome-linux/chrome` : undefined;
}
const b = await chromium.launch({ executablePath: nav() });
const page = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await page.goto("http://127.0.0.1:3000/login", { waitUntil: "domcontentloaded" });
await page.locator('input[name="email"]').fill("demo@atlas.local");
await page.locator('input[name="password"]').fill("demo1234");
await page.locator('button[type="submit"]').click();
await page.getByRole("heading", { name: "Chantiers" }).waitFor({ timeout: 60000 });
// Le chantier de démonstration dont le devis est déjà parti.
await page.getByText("Reprise de toiture").first().click();
await page.waitForTimeout(1500);
const url = page.url();
await page.goto(`${url.replace(/\/$/, "")}/export`, { waitUntil: "networkidle" });
await page.waitForTimeout(2000);
console.log("--- texte visible ---");
console.log((await page.locator("body").innerText()).slice(0, 900));
await page.screenshot({ path: `${S}/devis.png`, fullPage: true });
await b.close();
