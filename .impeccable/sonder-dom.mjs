// Qui occupe le bas de l'écran à 3200 ms ? On interroge le DOM, on ne devine pas.
import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
const n = await chromium.launch();
const p = await n.newPage({ viewport: { width: 390, height: 744 } });
await p.goto(pathToFileURL("appli/la-goutte-d-eau.html").href, { waitUntil: "networkidle" });
await p.waitForSelector("body.pose", { timeout: 9000 });
await p.click("#revoir");
await p.waitForTimeout(3200);
const r = await p.evaluate(() => {
  const qui = (x,y) => { const e = document.elementFromPoint(x,y); return e ? (e.id || e.className || e.tagName) : "rien"; };
  const pl = document.getElementById("plaque").getBoundingClientRect();
  return {
    dessus_500: qui(195,500), dessus_650: qui(195,650), dessus_300: qui(195,300),
    plaque: { t: Math.round(pl.top), b: Math.round(pl.bottom), l: Math.round(pl.left), r: Math.round(pl.right) },
  };
});
console.log(JSON.stringify(r));
await n.close();
