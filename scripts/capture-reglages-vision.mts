// La carte « Lecture d'image » de l'écran Atlas IA, PHOTOGRAPHIÉE — deux fois.
//
// **Deux vues, parce que c'est l'écart qui répond à sa question** (21 août 2026,
// « dis-moi si c'est bon ou s'il faut qu'on rajoute une clé ») : avec une clé
// posée, l'écran nomme le prestataire ; sans, il nomme la variable à poser.
// Un seul cliché ne dirait pas si l'écran sait distinguer les deux.
//
// **UN PIÈGE QUI A FAILLI FAIRE ANNONCER UN FAUX VERT, le 21 août 2026.** La
// capture « sans clé » montrait une carte verte : un serveur PRÉCÉDENT, lancé
// avec la clé, tenait encore le port 3000, et le nouveau était parti sur 3001
// en le disant dans une ligne de journal que personne ne lit. On photographiait
// donc l'ancien code avec l'ancienne configuration.
//
// **Avant de capturer : vérifier qu'un seul serveur tourne**, et que c'est bien
// le sien — `pgrep -af next-server` puis `kill -9`. La batterie de suites porte
// déjà ce garde-fou (`run-e2e-tests.ts` refuse de démarrer si le port est pris) ;
// une capture lancée à la main ne l'a pas.
//
// Usage : npx tsx scripts/capture-reglages-vision.mts <dossier>
import { mkdirSync } from "node:fs";
import { devices } from "playwright";
import { lancerNavigateur } from "./e2e-browser";

const dossier = process.argv[2];
if (!dossier) {
  console.error("usage: capture-reglages-vision.mts <dossier>");
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

await page.goto(`${BASE}/reglages/ia`, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
await page.screenshot({ path: `${dossier}/reglages-ia.png`, fullPage: true });

console.log((await page.locator("body").innerText()).slice(0, 1400));
await navigateur.close();
process.exit(0);
