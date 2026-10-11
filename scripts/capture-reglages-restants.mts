// Les six derniers écrans des Réglages, photographiés avant d’y toucher — lot 6.
//
//   ATLAS_BASE=http://localhost:3003 npx tsx scripts/capture-reglages-restants.mts <dossier>
//
// **Pourquoi une capture et pas une suite.** Ce qu’on cherche ne s’écrit pas en
// assertion : des mots de trop, un titre de bloc collé à l’étiquette du champ
// suivant, des noms de variables d’environnement affichés à un artisan. Tout
// cela est vert dans chaque test du dépôt, et se voit en une image
// (`CLAUDE.md` §5).
//
// Il compte aussi les MOTS et la HAUTEUR : c’est ce qui classe les six écrans
// par urgence, et ce qui permet de dire après coup ce que le lot a retiré.
//
// **`localhost`, JAMAIS `127.0.0.1`** — en développement, Next refuse alors de
// servir le JavaScript de la page.
import { lancerNavigateur } from "./e2e-browser";
import type { Page } from "playwright";
import { mkdirSync } from "node:fs";
const BASE = process.env.ATLAS_BASE ?? "http://localhost:3000";
const d = process.argv[2];
mkdirSync(d, { recursive: true });
const ECRANS: [string, string][] = [
  ["connexion", "/reglages/connexion"],
  ["donnees", "/reglages/donnees"],
  ["apparence", "/reglages/apparence"],
  ["ia", "/reglages/ia"],
  ["abonnement", "/reglages/abonnement"],
  ["compte", "/reglages/compte"],
];
const n = await lancerNavigateur();
const c = await n.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const p: Page = await c.newPage();
await p.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await p.locator('input[name="email"]').waitFor();
await p.fill('input[name="email"]', "demo@atlas.local");
await p.fill('input[name="password"]', "demo1234");
await p.click('button[type="submit"]');
await p.waitForURL(`${BASE}/`, { timeout: 30_000 });
for (const [nom, adresse] of ECRANS) {
  const r = await p.goto(`${BASE}${adresse}`, { waitUntil: "networkidle" });
  await p.waitForTimeout(600);
  const titre = (await p.locator("h1").first().textContent().catch(() => null))?.trim() ?? "—";
  const texte = await p.locator("body").innerText();
  const mots = texte.split(/\s+/).filter(Boolean).length;
  const haut = await p.evaluate(() => document.body.scrollHeight);
  console.log(`${nom.padEnd(12)} ${r?.status()} · « ${titre} » · ${String(mots).padStart(4)} mots · ${haut} px`);
  await p.screenshot({ path: `${d}/lot6-${nom}.png`, fullPage: true });
}
await n.close();
