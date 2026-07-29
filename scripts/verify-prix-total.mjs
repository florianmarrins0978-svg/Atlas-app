import { chromium } from "playwright";
import assert from "node:assert";

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await (await browser.newContext()).newPage();
await page.goto("http://localhost:3000/design/prix", { waitUntil: "networkidle" });

const totalText = await page.locator("text=/\\d[\\d\\s]*€/").first().textContent();
console.log("Total initial:", totalText);
assert.ok(totalText.includes("1"), "total should show a number");

const montants = page.locator('input[type="number"]');
await montants.first().fill("1300");
await montants.first().blur();
await page.waitForTimeout(150);
const totalApres = await page.locator(`text=/\\d[\\d\\s]*€/`).first().textContent();
console.log("Total après modif (1120->1300, +180):", totalApres);
// 1120+144+360+35 = 1659 initial; changer 1120->1300 => 1659-1120+1300=1839
assert.ok(totalApres.includes("1839") || totalApres.replace(/\s/g,'').includes("1839"), `Total attendu 1839€, obtenu ${totalApres}`);

await browser.close();
console.log("OK: le total se recalcule correctement en direct.");
