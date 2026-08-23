// L'écran d'arrosage, PHOTOGRAPHIÉ — au compteur, puis au robinet de jardin.
//
// **Pourquoi une capture, alors que la suite est verte.** Trois défauts réels de
// ce projet ont été trouvés en regardant une image, jamais par un test vert
// (`CLAUDE.md` §5). Et le dernier retour du patron sur cet écran — « quand je
// clique sur croquis et que j'ajoute une photo, rien ne se passe » — portait sur
// ce qu'on VOIT, pas sur ce qu'on calcule.
//
// Deux vues, parce que l'écran a deux visages et que c'est l'écart qui compte :
// au compteur il ne demande RIEN (« il ne doit pas y avoir marqué dix litres,
// vingt, trois bars ») ; au robinet il ouvre le kit et ses deux pressions.
//
// Usage : npx tsx scripts/capture-arrosage-kit.mts <dossier>
import { mkdirSync } from "node:fs";
import { devices } from "playwright";
import { lancerNavigateur } from "./e2e-browser";

const dossier = process.argv[2];
if (!dossier) {
  console.error("usage: capture-arrosage-kit.mts <dossier>");
  process.exit(1);
}
mkdirSync(dossier, { recursive: true });

const BASE = "http://localhost:3000";

const navigateur = await lancerNavigateur();
const page = await (await navigateur.newContext({ ...devices["iPhone 13"] })).newPage();

await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill('input[name="email"]', "demo@atlas.local");
await page.fill('input[name="password"]', "demo1234");
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/`, { timeout: 60_000 });

await page.goto(`${BASE}/paysage/arrosage`, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
await page.screenshot({ path: `${dossier}/arrosage-au-compteur.png`, fullPage: true });

await page.selectOption("#piquage", "ailleurs");
await page.waitForTimeout(500);
await page.screenshot({ path: `${dossier}/arrosage-robinet-kit.png`, fullPage: true });

// **La pleine page MENT sur la barre du bas, et il faut le savoir avant de
// corriger un défaut qui n'existe pas.** En `fullPage`, une barre `fixed` se
// dessine à la hauteur de la fenêtre, donc au MILIEU de l'image dès que la page
// dépasse un écran : le bouton du croquis paraît recouvert. Mesuré au bas de la
// vraie fenêtre, rien ne l'est. La troisième vue est celle qui dit vrai — c'est
// elle qu'on regarde pour juger d'un recouvrement.
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(400);
await page.screenshot({ path: `${dossier}/arrosage-bas-de-page.png` });

// L'image se regarde ; le texte se cite. Ce que l'écran porte vraiment, en clair.
const vu = await page.evaluate(() => ({
  mots: ((document.querySelector("form") as HTMLElement | null)?.innerText ?? "")
    .split(/\s+/)
    .filter(Boolean).length,
  encart: (document.querySelector('[data-atlas="mesures"]') as HTMLElement | null)?.innerText ?? "",
  choix: [...document.querySelectorAll("#piquage option")].map((o) => (o.textContent ?? "").trim()),
}));
console.log(JSON.stringify(vu, null, 2));

await navigateur.close();
process.exit(0);
