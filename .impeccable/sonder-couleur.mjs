// Doute sur la teinte réelle des petites capitales : on lit le pixel, on ne débat pas.
import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
const n = await chromium.launch();
const p = await n.newPage({ viewport:{width:390,height:800}, deviceScaleFactor:4 });
await p.goto(pathToFileURL("appli/cadran-des-chantiers.html").href, { waitUntil:"networkidle" });
await p.locator(".brin:nth-child(2) .etat").screenshot({ path:".impeccable/review/etat-zoom.png" });
await p.locator(".guichet-ligne").screenshot({ path:".impeccable/review/guichet-zoom.png" });
await n.close();
console.log("ok");
