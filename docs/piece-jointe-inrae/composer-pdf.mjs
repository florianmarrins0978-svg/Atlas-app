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
import { copyFileSync, existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const racine = resolve(import.meta.dirname, "../..");
const source = resolve(racine, "docs/piece-jointe-inrae/document.html");
const atelier = resolve(racine, "captures/document-inrae.html");
// Le fichier ne porte plus de marque non plus : c'est la première chose
// que le destinataire lit, avant même d'ouvrir.
const sortie = resolve(racine, "captures/Anthracnose-du-platane.pdf");

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
 * Les captures passent en JPEG avant d'entrer dans le PDF.
 *
 * **Payé le 24 août 2026.** Le document pesait 2,8 Mo, puis 1,4 : son téléphone
 * renonçait à l'afficher, et son application de courrier a fini par répondre
 * « Impossible d'ajouter la pièce jointe ». Chromium embarque les PNG tels
 * quels, et une photographie en PNG pèse quatre fois son JPEG sans qu'un œil
 * voie la différence — le PNG est fait pour les aplats, pas pour une feuille de
 * platane. 261 ko au lieu de 1 009 pour la même image, et le PDF passe de
 * 1,4 Mo à 375 ko.
 *
 * La conversion se fait ICI plutôt qu'à la capture : `capture-inrae.mts` rend
 * des PNG, qui restent la bonne matière pour REGARDER un écran de près.
 */
async function convertirEnJpeg(page) {
  for (const nom of ["inrae-ecran", "inrae-sources"]) {
    const b64 = readFileSync(resolve(racine, `captures/${nom}.png`)).toString("base64");
    const jpeg = await page.evaluate(async (data) => {
      const img = new Image();
      img.src = "data:image/png;base64," + data;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext("2d");
      // Un fond blanc D'ABORD : le JPEG ne connaît pas la transparence, et sans
      // lui les zones transparentes ressortent en NOIR.
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0);
      return c.toDataURL("image/jpeg", 0.86).split(",")[1];
    }, b64);
    const cible = resolve(racine, `captures/${nom}.jpg`);
    writeFileSync(cible, Buffer.from(jpeg, "base64"));
    // Une image de quelques octets n'est pas une image : c'est une conversion
    // qui a échoué en silence.
    if (statSync(cible).size < 5000) {
      throw new Error(`${nom}.jpg fait ${statSync(cible).size} octets — la conversion n'a rien rendu.`);
    }
  }
}

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
//
// **Et la borne est 970, pas 1002.** Le 23 août 2026, une page mesurée à 1002
// pile est passée au vert et le PDF est sorti en QUATRE pages : la pagination
// de Chromium arrondit, et une page qui touche exactement sa limite bascule.
// Un contrôle qui accepte le cas limite ne protège pas du cas limite — c'est
// pour cela qu'il reste 32 px de marge, et que le compte de pages du PDF a le
// dernier mot juste en dessous.
const page = await nav.newPage({ viewport: { width: 680, height: 1002 } });
await convertirEnJpeg(page);
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
console.log("hauteurs à la largeur d'une A4 :", hauteurs.join(" · "), "(limite 970)");
const trop = hauteurs.filter((h) => h > 970);
if (trop.length > 0) throw new Error(`débordement : ${trop.join(", ")} px pour 970 tolérés (1002 disponibles, 32 de marge).`);

await page.pdf({ path: sortie, format: "A4", printBackground: true });
await nav.close();

// **Le verdict qui tranche vraiment : le nombre de pages du PDF.** Une mesure
// peut se tromper de largeur ; un PDF de quatre pages, non.
const pages = (readFileSync(sortie).toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
if (pages !== 3) throw new Error(`le document doit tenir en 3 pages, il en fait ${pages}.`);
console.log(`✅ ${sortie} — ${pages} pages, photos comprises.`);
