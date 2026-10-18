// Mesure les photos de la nourrice éclatée et écrit src/lib/arrosage/photos-nourrice.ts.
//
// POURQUOI UN SCRIPT, ET PAS UN CANVAS À L'ÉCRAN. La planche validée
// (appli/arrosage-plan.html) détourait chaque photo dans le navigateur, pixel par
// pixel, pour poser ses axes de vissage sur la pièce et non sur ses marges
// blanches. L'écran de l'application dessine la même nourrice en SVG, que les
// contrôles peuvent rendre sans navigateur : il lui faut donc ces boîtes
// mesurées d'avance. Les photos changent rarement ; quand l'une change, on
// rejoue ce script. Les fractions d'axe (HAUT, COLONNE) restent dans
// nourrice-eclatee.ts : ici, seulement ce que la photo mesure.
//
//   node scripts/mesurer-photos-nourrice.mjs
import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";
// Node 24 lit le TypeScript sans outil : la table des photos se lit à la source.
import { PHOTOS } from "../src/lib/arrosage/photos.ts";

const REFS = ["coude-mf", "coude-ff", "te-mmf", "clarinette-2v", "clarinette-3v", "clarinette-4v",
  "mamelon", "vanne-purge", "union", "raccord-male25", "pehd", "electrovanne-100dv",
  "electrovanne-100dv-ff", "mamelon-droit-1", "regulateur-ff34"];

const navigateur = await chromium.launch();
const page = await navigateur.newPage();
await page.goto("about:blank");
const mesures = {};
for (const ref of REFS) {
  const fichier = PHOTOS[ref];
  if (!fichier) throw new Error(`${ref} : aucune photo dans PHOTOS`);
  const octets = readFileSync(`appli/arrosage-photos/${fichier}`);
  const type = fichier.endsWith(".png") ? "image/png" : fichier.endsWith(".webp") ? "image/webp" : "image/jpeg";
  mesures[ref] = await page.evaluate(async (url) => {
    const img = new Image(); img.src = url; await img.decode();
    const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const g = c.getContext("2d"); g.drawImage(img, 0, 0);
    // La même règle que la planche : un pixel compte s'il n'est ni transparent ni blanc.
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0;
    for (let y = 0; y < c.height; y += 2) for (let x = 0; x < c.width; x += 2) {
      const i = (y * c.width + x) * 4;
      if (d[i + 3] > 20 && (d[i] < 225 || d[i + 1] < 225 || d[i + 2] < 225)) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    return { largeur: c.width, hauteur: c.height, x0, y0, x1: x1 + 1, y1: y1 + 1 };
  }, `data:${type};base64,${octets.toString("base64")}`);
}
await navigateur.close();

const lignes = Object.entries(mesures).map(([ref, m]) =>
  `  "${ref}": { largeur: ${m.largeur}, hauteur: ${m.hauteur}, x0: ${m.x0}, y0: ${m.y0}, x1: ${m.x1}, y1: ${m.y1} },`);
writeFileSync("src/lib/arrosage/photos-nourrice.ts", `/**
 * LES PHOTOS DE LA NOURRICE, MESURÉES — écrit par scripts/mesurer-photos-nourrice.mjs,
 * ne pas retoucher à la main.
 *
 * Pour chaque photo : sa taille, et la boîte de la pièce (sans les marges
 * blanches), en pixels. La nourrice éclatée (nourrice-eclatee.ts) pose ses axes
 * de vissage en fractions de CETTE boîte, comme la planche validée le faisait
 * en détourant dans le navigateur.
 */
export type PhotoMesuree = { largeur: number; hauteur: number; x0: number; y0: number; x1: number; y1: number };

export const PHOTOS_NOURRICE: Record<string, PhotoMesuree> = {
${lignes.join("\n")}
};
`);
console.log(`✅ ${REFS.length} photos mesurées, src/lib/arrosage/photos-nourrice.ts écrit.`);
