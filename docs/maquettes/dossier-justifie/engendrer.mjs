// Imprime `modele.html` en `appli/dossier-justifie-exemple.pdf`, l'exemple que
// la planche `appli/pour-mon-comptable.html` ouvre.
//
//   node docs/maquettes/dossier-justifie/engendrer.mjs
//
// Playwright se prend dans le node_modules du dossier d'où l'on lance : une
// copie de travail sans dépendances peut l'emprunter au dossier principal.
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const ici = path.dirname(fileURLToPath(import.meta.url));
const { chromium } = createRequire(path.join(process.cwd(), "x.js"))("playwright");
const sortie = path.resolve(ici, "../../../appli/dossier-justifie-exemple.pdf");

const navigateur = await chromium.launch();
const page = await navigateur.newPage();
await page.goto(pathToFileURL(path.join(ici, "modele.html")).href, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
// Le sommaire et les « p. 4 » du relevé sont comptés par le modèle : si une
// page déborde à l.impression, ils mentent. On refuse plutôt que d.imprimer faux.
const attendues = Number(await page.evaluate(() => document.body.dataset.pages));
await page.pdf({
  path: sortie,
  format: "A4",
  printBackground: true,
  preferCSSPageSize: true,
  displayHeaderFooter: true,
  headerTemplate: "<span></span>",
  footerTemplate: `<div style="width:100%;font:7pt Helvetica,Arial,sans-serif;color:#8a8578;padding:0 15mm;display:flex;justify-content:space-between">
    <span>Dossier justifié 2025, Jardins Exemple</span><span>Page <span class="pageNumber"></span> sur <span class="totalPages"></span></span></div>`,
});
await navigateur.close();
console.log(sortie);
const { PDFDocument } = createRequire(path.join(process.cwd(), "x.js"))("pdf-lib");
const { readFileSync } = await import("node:fs");
const reelles = (await PDFDocument.load(readFileSync(sortie))).getPageCount();
if (reelles !== attendues) {
  console.error(`Le PDF fait ${reelles} pages, le sommaire en annonce ${attendues} : une page déborde.`);
  process.exit(1);
}
console.log(`${reelles} pages, comme le sommaire.`);
