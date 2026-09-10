// Chronomètre absolu, sept instants mobile + la paire desktop sur le
// fichier corrigé.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { pathToFileURL } from "node:url";
const sortie = ".impeccable/review-goutte";
mkdirSync(sortie, { recursive: true });
const url = pathToFileURL("appli/la-goutte-d-eau.html").href;
const n = await chromium.launch();

const p = await n.newPage({ viewport: { width: 390, height: 744 } });
await p.goto(url, { waitUntil: "networkidle" });
await p.waitForSelector("body.pose", { timeout: 9000 });
await p.click("#revoir");
let t0 = Date.now();
for (const [t, nom] of [[500,"1-perle"],[1400,"2-chute"],[2400,"3-orbite"],[3050,"4-approche"],[3350,"5-impact"],[3800,"6-eclosion"],[5000,"7-posee"]]) {
  const reste = t0 + t - Date.now();
  if (reste > 0) await p.waitForTimeout(reste);
  await p.screenshot({ path: `${sortie}/${nom}.png` });
}
await p.close();

const b = await n.newPage({ viewport: { width: 1440, height: 900 } });
await b.goto(url, { waitUntil: "networkidle" });
await b.waitForSelector("body.pose", { timeout: 9000 });
await b.click("#revoir");
t0 = Date.now();
for (const [t, nom] of [[2400,"desktop-orbite"],[5000,"desktop-posee"]]) {
  const reste = t0 + t - Date.now();
  if (reste > 0) await b.waitForTimeout(reste);
  await b.screenshot({ path: `${sortie}/${nom}.png` });
}
await n.close();
console.log("ok");
