/**
 * LA NOURRICE ÉCLATÉE, PHOTOGRAPHIÉE POUR LE PDF DU PLAN — sa demande du
 * 22 novembre 2026 : *« ton plan d'arrosage ne comprend pas la nourrice [...]
 * prends la vue éclatée [...] tu utiliseras ça pour faire le plan de la
 * nourrice »*.
 *
 * Le PDF se compose sur le serveur, sans navigateur ni WebGL : la 3D ne peut
 * pas s'y dessiner. Ce script ouvre la planche de la nourrice en 3D
 * (`appli/arrosage-nourrice-3d.html`, son module `appli/nourrice-3d/`, le même
 * que l'écran du plan), l'éclate, la regarde du dessus, et la photographie pour
 * chaque nourrice possible : de 1 à 6 voies, de 0 à toutes en goutte-à-goutte.
 * La photo est recadrée sur les pièces et rangée dans
 * `public/arrosage-photos/nourrice-3d/`, où `plan-arrosage-pdf.ts` la lit.
 *
 * **Du dessus**, parce que c'est la vue où chaque pièce est séparée des autres,
 * dans l'ordre du montage, colonne par colonne : de biais, les colonnes se
 * cachent l'une l'autre.
 *
 * **À rejouer dès que les pièces de la 3D changent** : `empreinte.json` garde
 * l'empreinte des fichiers qui les dessinent, et `test-pdf-du-plan-arrosage.ts`
 * rougit quand elle ne correspond plus.
 *
 *   npx tsx scripts/rendre-nourrice-eclatee.mts
 *
 * N'occupe ni le port 3000 ni la base : un petit serveur de fichiers sur un
 * port libre, pour la seule planche.
 */
import http from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";
import { cheminDuNavigateur } from "./_navigateur.mjs";
import { empreinteDeLaNourrice3D, FICHIER_D_EMPREINTE } from "./_nourrice-3d";
import { photoDeLaNourrice } from "../src/lib/arrosage/nourrice-en-photo";

const RACINE = path.resolve("appli");
const enPublic = (chemin: string) => path.join(path.resolve("public"), chemin);
const TYPES: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".json": "application/json" };

const serveur = http.createServer(async (req, res) => {
  const fichier = path.join(RACINE, decodeURIComponent(new URL(req.url ?? "/", "http://ici").pathname));
  if (!fichier.startsWith(RACINE + path.sep)) {
    res.writeHead(403);
    res.end();
    return;
  }
  try {
    const octets = await readFile(fichier);
    res.writeHead(200, { "content-type": TYPES[path.extname(fichier)] ?? "application/octet-stream" });
    res.end(octets);
  } catch {
    // Une ressource absente (l'icône de l'onglet) n'empêche pas la photo : la page le dit dans sa console.
    res.writeHead(404);
    res.end();
  }
});
await new Promise<void>((ok) => serveur.listen(0, "127.0.0.1", ok));
const ecoute = serveur.address();
if (!ecoute || typeof ecoute === "string") throw new Error("le petit serveur de la planche n'écoute pas");
const adresse = `http://127.0.0.1:${ecoute.port}/arrosage-nourrice-3d.html`;

// WebGL 2 sans carte graphique : le moteur logiciel de Chromium.
const navigateur = await chromium.launch({ executablePath: cheminDuNavigateur(), args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await navigateur.newPage({ viewport: { width: 600, height: 900 }, deviceScaleFactor: 2 });
const erreurs: string[] = [];
page.on("pageerror", (e) => erreurs.push(String(e)));
await page.goto(adresse);
// La planche expose son état pour ses contrôles (`window.__nourrice3d`).
type Planche = { __nourrice3d: { etat: { voies: number; goutte: number; eclatee: boolean; vue: string }; scene: { etat(): { images: number; enMouvement: boolean } } } };
await page.waitForFunction(() => (window as unknown as Planche).__nourrice3d?.scene.etat().images > 0, null, { timeout: 120_000 });
if (erreurs.length) throw new Error(`La planche 3D ne s'ouvre pas : ${erreurs.join(" ; ")}`);

// La photo est celle de la scène, sans le cadre arrondi de la planche.
await page.addStyleTag({ content: ".vue.photo, .vue.photo canvas { border-radius: 0; box-shadow: none; } .vue.photo::after { display: none; }" });
await page.evaluate(() => document.querySelector(".vue")?.classList.add("photo"));

/** Attendre que les pièces aient fini de bouger, puis que la scène ait fini d'affiner l'image. */
async function calme() {
  await page.waitForFunction(() => !(window as unknown as Planche).__nourrice3d.scene.etat().enMouvement, null, { timeout: 120_000 });
  let avant = -1;
  for (;;) {
    await page.waitForTimeout(800);
    const images = await page.evaluate(() => (window as unknown as Planche).__nourrice3d.scene.etat().images);
    if (images === avant) return;
    avant = images;
  }
}

/** Recadrer sur ce qui n'est pas le fond, avec un peu d'air, et rendre un JPEG. */
async function recadrer(png: Buffer): Promise<string> {
  return page.evaluate(async (donnees) => {
    const image = new Image();
    image.src = `data:image/png;base64,${donnees}`;
    await image.decode();
    const c = document.createElement("canvas");
    c.width = image.width;
    c.height = image.height;
    const g = c.getContext("2d");
    if (!g) throw new Error("pas de dessin 2D dans ce navigateur");
    g.drawImage(image, 0, 0);
    const { data, width, height } = g.getImageData(0, 0, c.width, c.height);
    const fond = [data[0], data[1], data[2]];
    let x0 = width, y0 = height, x1 = -1, y1 = -1;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        if (Math.abs(data[i] - fond[0]) + Math.abs(data[i + 1] - fond[1]) + Math.abs(data[i + 2] - fond[2]) > 30) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    if (x1 < 0) throw new Error("la photo est vide");
    const air = Math.round(Math.max(x1 - x0, y1 - y0) * 0.05);
    x0 = Math.max(0, x0 - air); y0 = Math.max(0, y0 - air);
    x1 = Math.min(width - 1, x1 + air); y1 = Math.min(height - 1, y1 + air);
    const r = document.createElement("canvas");
    r.width = x1 - x0 + 1;
    r.height = y1 - y0 + 1;
    r.getContext("2d")?.drawImage(c, x0, y0, r.width, r.height, 0, 0, r.width, r.height);
    return r.toDataURL("image/jpeg", 0.86).split(",")[1];
  }, png.toString("base64"));
}

await mkdir(path.dirname(enPublic(photoDeLaNourrice(1, 0))), { recursive: true });
await page.click('[data-montage="eclatee"]');
await calme();
await page.click('[data-vue="dessus"]');
await calme();
let n = 0;
for (let voies = 1; voies <= 6; voies++) {
  await page.click(`[data-voies="${voies}"]`);
  for (let goutte = 0; goutte <= voies; goutte++) {
    await page.click(`[data-goutte="${goutte}"]`);
    await calme();
    // Le point de vue et l'éclaté tiennent d'une nourrice à l'autre ; on le vérifie plutôt que de le croire.
    const etat = await page.evaluate(() => (window as unknown as Planche).__nourrice3d.etat);
    if (!etat.eclatee || etat.vue !== "dessus" || etat.voies !== voies || etat.goutte !== goutte) {
      throw new Error(`La planche n'est pas où on l'attend : ${JSON.stringify(etat)}`);
    }
    const png = await page.locator(".vue canvas").screenshot();
    await writeFile(enPublic(photoDeLaNourrice(voies, goutte)), Buffer.from(await recadrer(png), "base64"));
    n++;
  }
}
await writeFile(FICHIER_D_EMPREINTE, `${JSON.stringify({ empreinte: await empreinteDeLaNourrice3D() }, null, 2)}\n`);
await navigateur.close();
serveur.close();
console.log(`${n} photos de la nourrice éclatée, à côté de ${path.relative(process.cwd(), FICHIER_D_EMPREINTE)}`);
