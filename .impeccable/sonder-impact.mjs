// Trois instants serrés autour de l'impact, pour voir ce qui coupe la page.
import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
const n = await chromium.launch();
const p = await n.newPage({ viewport: { width: 390, height: 744 } });
await p.goto(pathToFileURL("appli/la-goutte-d-eau.html").href, { waitUntil: "networkidle" });
await p.waitForSelector("body.pose", { timeout: 9000 });
await p.click("#revoir");
const t0 = Date.now();
for (const [t, nom] of [[3100,"i-3100"],[3200,"i-3200"],[3240,"i-3240"]]) {
  const reste = t0 + t - Date.now();
  if (reste > 0) await p.waitForTimeout(reste);
  await p.screenshot({ path: `.impeccable/review-goutte/${nom}.png` });
}
await n.close();
console.log("ok");
