// REGARDER l'aperçu collé en haut — sa réponse B du 25 août 2026.
//
// Un `sticky` ne se juge pas à l'arrêt : il faut faire DÉFILER, sinon on
// photographie exactement l'état où A et B se ressemblent. Ce script descend
// jusqu'aux typographies — l'endroit précis où l'aperçu disparaissait — et
// prend l'image là.
//
//   npx tsx scripts/capture-apercu-colle.mts <dossier>
import { lancerNavigateur } from "./e2e-browser";
import type { Page } from "playwright";
import { mkdirSync } from "node:fs";
import path from "node:path";

const BASE = process.env.ATLAS_BASE ?? "http://localhost:3000";
const dossier = process.argv[2] ?? "/tmp/captures-apercu";
mkdirSync(dossier, { recursive: true });

async function connecter(page: Page) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });
}

const navigateur = await lancerNavigateur();
const contexte = await navigateur.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
});
const page = await contexte.newPage();
await connecter(page);

await page.goto(`${BASE}/reglages/documents`, { waitUntil: "networkidle" });
await page.waitForTimeout(600);

const apercu = page.locator('[data-atlas="apercu-colle"]');
await apercu.scrollIntoViewIfNeeded();
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(dossier, "01-en-arrivant.png") });

// **Descendre POUR DE BON, par paliers.** Un `sticky` ne se juge pas à l'arrêt :
// photographié sans avoir défilé, A et B rendent exactement la même image. Et
// l'on descend d'une hauteur d'écran à la fois plutôt que de viser un élément :
// une cible nommée disparaît au premier remaniement, et le contrôle se tairait
// alors sans rien mesurer (`CLAUDE.md` §5).
for (const n of [1, 2]) {
  await page.evaluate(() => window.scrollBy(0, Math.round(window.innerHeight * 0.7)));
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(dossier, `02-${n}-descendu.png`) });
}

// Et plus bas encore : l'aperçu doit AVOIR QUITTÉ l'écran quand la rubrique est
// passée. Collé à l'écran entier, il recouvrirait les conditions de paiement,
// qui n'ont rien à voir avec l'apparence.
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(dossier, "03-tout-en-bas.png") });

await navigateur.close();
console.log("Captures écrites dans", dossier);
