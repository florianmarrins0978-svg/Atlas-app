// L'écran « Notifications » des Réglages, en entier.
//   npx tsx --env-file=.env scripts/capture-notifications.mts <dossier>
//
// **Pourquoi une capture et pas une suite.** Ce qu'on cherche ici ne s'écrit
// pas en assertion : de la prose de trop. Un paragraphe qui répète le titre
// d'à côté est vert dans tous les tests du dépôt, et se voit en une image.
import { lancerNavigateur } from "./e2e-browser";
import { mkdirSync } from "node:fs";

const BASE = process.env.ATLAS_BASE ?? "http://localhost:3000";
const dossier = process.argv[2] ?? "./captures-notifications";
mkdirSync(dossier, { recursive: true });

const navigateur = await lancerNavigateur();
const contexte = await navigateur.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
});
const page = await contexte.newPage();

await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill('input[name="email"]', "demo@atlas.local");
await page.fill('input[name="password"]', "demo1234");
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/`, { timeout: 30_000 });

const reponse = await page.goto(`${BASE}/reglages/notifications`, { waitUntil: "networkidle" });
await page.waitForTimeout(700);

// Le titre attendu, et pas seulement le code HTTP : une navigation côté client
// rend 200 sur la page « introuvable » de Next, dont on mesurerait alors la
// prose (payé le 6 septembre 2026 sur `capture-entetes-reglages`).
const titre = (await page.locator("h1").first().textContent().catch(() => null))?.trim() ?? null;
console.log("statut", reponse?.status(), "· titre", JSON.stringify(titre));
if (titre !== "Notifications") {
  console.log("ATTENTION : ce n'est pas l'écran attendu — rien n'est mesuré.");
  process.exitCode = 1;
} else {
  await page.screenshot({ path: `${dossier}/notifications.png`, fullPage: true });
  const texte = await page.locator("body").innerText();
  console.log("mots à l'écran :", texte.split(/\s+/).filter(Boolean).length);
}
await navigateur.close();
