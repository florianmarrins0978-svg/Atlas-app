// Capture de la maquette « Le Cadran » — mobile (390, l'écran du patron),
// desktop (1440), et la feuille ouverte. Mouvement réglé avant capture.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { pathToFileURL } from "node:url";

const sortie = process.argv[2];
mkdirSync(sortie, { recursive: true });
const url = pathToFileURL("appli/cadran-des-chantiers.html").href;

const navigateur = await chromium.launch();

// Mobile — la taille relevée de son téléphone (390 × 664).
const mobile = await navigateur.newPage({ viewport: { width: 390, height: 664 } });
await mobile.goto(url, { waitUntil: "networkidle" });
await mobile.screenshot({ path: `${sortie}/mobile.png` });
// La feuille ouverte, après le geste complet.
await mobile.click("#remontoir");
await mobile.waitForTimeout(1200);
await mobile.screenshot({ path: `${sortie}/mobile-feuille.png` });
await mobile.close();

// Desktop.
const bureau = await navigateur.newPage({ viewport: { width: 1440, height: 900 } });
await bureau.goto(url, { waitUntil: "networkidle" });
await bureau.screenshot({ path: `${sortie}/desktop.png`, fullPage: true });
await bureau.close();

await navigateur.close();
console.log("captures écrites dans", sortie);
