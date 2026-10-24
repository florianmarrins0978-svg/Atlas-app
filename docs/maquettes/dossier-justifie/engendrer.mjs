// Imprime `modele.html` en `appli/dossier-justifie-exemple.pdf`, l'exemple que
// la planche `appli/pour-mon-comptable.html` ouvre.
//
//   node docs/maquettes/dossier-justifie/engendrer.mjs          (renvois)
//   node docs/maquettes/dossier-justifie/engendrer.mjs cote     (côte à côte)
//
// Playwright se prend dans le node_modules du dossier d'où l'on lance : une
// copie de travail sans dépendances peut l'emprunter au dossier principal.
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const ici = path.dirname(fileURLToPath(import.meta.url));
const { chromium } = createRequire(path.join(process.cwd(), "x.js"))("playwright");
// « cote » imprime la seconde mise en page, chaque pièce à droite de sa ligne.
const cote = process.argv[2] === "cote";
const sortie = path.resolve(ici, `../../../appli/dossier-justifie-exemple${cote ? "-cote-a-cote" : ""}.pdf`);

const navigateur = await chromium.launch();
const page = await navigateur.newPage();
await page.goto(pathToFileURL(path.join(ici, "modele.html")).href + (cote ? "?mise=cote" : ""), { waitUntil: "networkidle" });
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

// Les liens internes, réécrits vers une PAGE au lieu d'un NOM.
//
// Chromium écrit « va à la destination piece-T-01-04 », un nom rangé dans le
// catalogue. Sa remarque du 23 octobre : « j'ai pas pu l'essayer, ça marche
// pas ». Les lecteurs de téléphone suivent mal ces noms ; une destination
// écrite en clair (cette page, à cette hauteur) est la forme que tous lisent.
const { PDFName, PDFArray } = createRequire(path.join(process.cwd(), "x.js"))("pdf-lib");
const { writeFileSync } = await import("node:fs");
const doc = await PDFDocument.load(readFileSync(sortie));
const nommees = doc.catalog.lookup(PDFName.of("Dests"));
// Le côte à côte a désormais ses liens aussi : la photo, et le retour à la ligne.
if (!nommees) { console.error("Aucune destination nommée : les liens internes ont disparu."); process.exit(1); }
const cible = new Map();
for (const [nom, val] of nommees.entries()) cible.set(nom.toString(), val instanceof PDFArray ? val : val.lookup(PDFName.of("D")));
let reecrits = 0, orphelins = 0;
for (const p of doc.getPages()) {
  const annots = p.node.lookup(PDFName.of("Annots"));
  if (!annots) continue;
  for (let i = 0; i < annots.size(); i++) {
    const a = annots.lookup(i), dest = a.get(PDFName.of("Dest"));
    if (!dest || dest instanceof PDFArray) continue;
    const d = cible.get(dest.toString());
    if (!d) { orphelins++; continue; }
    a.set(PDFName.of("Dest"), d);
    reecrits++;
  }
}
if (orphelins) { console.error(`${orphelins} liens visent une pièce introuvable.`); process.exit(1); }
writeFileSync(sortie, await doc.save());
console.log(`${reecrits} liens internes, tous vers une page.`);
