/**
 * Composer le PDF de la pièce jointe à l'INRAE.
 *
 *   node docs/piece-jointe-inrae/composer-pdf.mjs
 *
 * Les deux captures qu'il appelle ne sont PAS dans le dépôt (`captures/` est
 * ignoré). Les refaire d'abord — la marche à suivre est dans `LISEZ-MOI.md`.
 */
import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import { copyFileSync, existsSync, readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const racine = resolve(import.meta.dirname, "../..");
const source = resolve(racine, "docs/piece-jointe-inrae/document.html");
const atelier = resolve(racine, "captures/document-inrae.html");
const sortie = resolve(racine, "captures/Atlas-INRAE.pdf");

// **Le document se rend DEPUIS `captures/`, jamais depuis `docs/`.** Ses deux
// `<img>` sont relatifs, et les captures vivent dans `captures/`. Rendu depuis
// `docs/`, il compose sans une erreur, sans une page manquante — et sans les
// photos. C'est précisément ce que le dépôt appelle une mesure de zéro : rien
// n'échoue, et le résultat ne prouve rien.
for (const image of ["captures/inrae-ecran.png", "captures/inrae-sources.png"]) {
  if (!existsSync(resolve(racine, image))) {
    throw new Error(`${image} manque — refaire les captures (voir LISEZ-MOI.md) avant de composer le PDF.`);
  }
}
copyFileSync(source, atelier);

/**
 * Le Chromium déjà posé dans l'image, plutôt qu'un téléchargement que le
 * mandataire réseau refuse. Même mécanique que `scripts/capture-plan-arrosage.ts`
 * — env d'abord, jamais un chemin en dur qui sera faux à la prochaine image.
 */
function navigateurPreInstalle() {
  if (process.env.PLAYWRIGHT_EXECUTABLE_PATH) return process.env.PLAYWRIGHT_EXECUTABLE_PATH;
  const dossier = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!dossier || !existsSync(dossier)) return undefined;
  const sous = readdirSync(dossier).find((d) => /^chromium-\d+$/.test(d));
  const chemin = sous && `${dossier}/${sous}/chrome-linux/chrome`;
  return chemin && existsSync(chemin) ? chemin : undefined;
}

const nav = await chromium.launch({ executablePath: navigateurPreInstalle() });
// **La largeur COMPTE.** À 1280 px, la colonne est deux fois plus large qu'une
// A4 : l'image du téléphone, posée en pourcentage, grandit d'autant et la page
// paraît déborder de 466 px alors que le PDF tient en trois pages. 210 mm
// − 30 mm de marges = 180 mm, soit 680 px à 96 dpi : c'est LÀ qu'on mesure.
const page = await nav.newPage({ viewport: { width: 680, height: 1002 } });
await page.emulateMedia({ media: "print" });
await page.goto(pathToFileURL(atelier).href, { waitUntil: "networkidle" });

const hauteurs = await page.$$eval("section.page", (ss) =>
  ss.map((s) => Math.round(s.getBoundingClientRect().height)));
if (hauteurs.length !== 3) {
  throw new Error(`3 sections attendues, ${hauteurs.length} mesurée(s) — le document n'a pas chargé.`);
}
// Une boîte de zéro pixel n'est pas une page qui tient : c'est une mesure
// impossible (`CLAUDE.md` §5).
if (hauteurs.some((h) => h === 0)) {
  throw new Error(`une page mesure 0 px (${hauteurs.join(" · ")}) — la mise en page n'est pas appliquée.`);
}
console.log("hauteurs à la largeur d'une A4 :", hauteurs.join(" · "), "(limite 1002)");
const trop = hauteurs.filter((h) => h > 1002);
if (trop.length > 0) throw new Error(`débordement : ${trop.join(", ")} px pour 1002 disponibles.`);

await page.pdf({ path: sortie, format: "A4", printBackground: true });
await nav.close();

// **Le verdict qui tranche vraiment : le nombre de pages du PDF.** Une mesure
// peut se tromper de largeur ; un PDF de quatre pages, non.
const pages = (readFileSync(sortie).toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
if (pages !== 3) throw new Error(`le document doit tenir en 3 pages, il en fait ${pages}.`);
console.log(`✅ ${sortie} — ${pages} pages, photos comprises.`);
