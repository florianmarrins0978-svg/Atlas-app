// Prend les deux captures de l'écran d'erreur après un morceau manquant.
//   npx tsx scripts/capture-reprise-morceau.mts <dossier>
// Sert à REGARDER l'écran : trois défauts réels de ce dépôt n'ont été vus que là.
import { lancerNavigateur } from "./e2e-browser";
import type { Page } from "playwright";
import { mkdirSync } from "node:fs";
import path from "node:path";

const BASE = "http://localhost:3000";
const dossier = process.argv[2] ?? "/tmp/captures-reprise";
mkdirSync(dossier, { recursive: true });

async function connecter(page: Page) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });
}

const navigateur = await lancerNavigateur();
const contexte = await navigateur.newContext({ deviceScaleFactor: 3 });
const page = await contexte.newPage();
await connecter(page);
await page.goto(`${BASE}/planning`, { waitUntil: "networkidle" });
await page.goto(`${BASE}/`, { waitUntil: "networkidle" });

// Rechargement déjà consommé : c'est l'état qui S'AFFICHE et se regarde.
await page.evaluate(() => window.sessionStorage.setItem("atlas:rechargement-morceau", String(Date.now())));
await page.route("**/*", async (route) => {
  const r = route.request();
  if (r.resourceType() !== "document" && r.url().includes("/_next/static/chunks/")) {
    return route.fulfill({ status: 404, contentType: "text/plain", body: "" });
  }
  return route.continue();
});
await page.click('a[href="/planning"]');
await page.waitForSelector('button:has-text("Recharger")', { timeout: 60_000 });
await page.screenshot({ path: path.join(dossier, "reprise-apres-echec.png"), fullPage: true });
console.log("→", path.join(dossier, "reprise-apres-echec.png"));

// Mesurer plutôt que regarder de loin : le bouton est-il sous la bulle ?
const mesures = await page.evaluate(() => {
  const b = [...document.querySelectorAll("button")].find((x) => x.textContent?.trim() === "Recharger");
  const bulle = document.querySelector('[aria-label*="ssistant"], [data-atlas="assistant"]') as HTMLElement | null;
  return {
    bouton: b ? b.getBoundingClientRect().toJSON() : null,
    bulle: bulle ? bulle.getBoundingClientRect().toJSON() : null,
    defile: document.documentElement.scrollHeight > window.innerHeight,
  };
});
console.log(JSON.stringify(mesures, null, 2));

await navigateur.close();
