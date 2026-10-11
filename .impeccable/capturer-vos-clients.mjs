// Capture de la maquette « Vos clients » — les quatre états du banc, dans les
// deux chartes, en un seul passage. Une planche qu'on ne regarde pas est une
// planche qu'on livre à l'aveugle (CLAUDE.md §5).
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { pathToFileURL } from "node:url";

const sortie = process.argv[2];
mkdirSync(sortie, { recursive: true });
const url = pathToFileURL("appli/vos-clients.html").href;

const navigateur = await chromium.launch();

async function planche(page, nom) {
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${sortie}/${nom}.png` });
}

// Mobile — 390 × 664, la taille relevée de son téléphone.
const mobile = await navigateur.newPage({ viewport: { width: 390, height: 900 } });
await mobile.goto(url, { waitUntil: "networkidle" });
await planche(mobile, "1-repos");

await mobile.click('[data-frappe="martins"]');
await planche(mobile, "2-martins");

await mobile.click('[data-frappe="dupont"]');
await planche(mobile, "3-dupont");

await mobile.click('[data-etat="vide"]');
await planche(mobile, "4-aucun-client");

await mobile.click('[data-etat="repos"]');
await mobile.click('[data-bascule="avant"]');
await planche(mobile, "5-aujourdhui");
await mobile.click('[data-bascule="avant"]');

await mobile.click('[data-bascule="nuit"]');
await planche(mobile, "6-nuit");
await mobile.click('[data-frappe="martins"]');
await planche(mobile, "7-nuit-martins");
await mobile.click('[data-etat="repos"]');

// La liste défilée : la barre de recherche doit rester en haut, et poser son filet.
await mobile.click('[data-bascule="nuit"]');
await mobile.evaluate(() => { document.getElementById("defile").scrollTop = 400; });
await planche(mobile, "8-defilee");
await mobile.close();

// Desktop — la page entière, notes comprises.
const bureau = await navigateur.newPage({ viewport: { width: 1440, height: 900 } });
await bureau.goto(url, { waitUntil: "networkidle" });
await bureau.screenshot({ path: `${sortie}/9-desktop.png`, fullPage: true });
await bureau.close();

await navigateur.close();
console.log("captures écrites dans", sortie);
