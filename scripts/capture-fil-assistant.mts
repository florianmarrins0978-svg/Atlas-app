// Le panneau de l'assistant, avec un fil relu du serveur — regardé, pas déduit.
//
// Quatre défauts réels de ce dépôt sont sortis d'une capture et d'aucun test
// (`CLAUDE.md` §5). Celle-ci montre ce qu'il voit en rouvrant : le fil, et le
// mot « Oublier » à côté de la croix.
import { mkdirSync } from "node:fs";
import { lancerNavigateur } from "./e2e-browser";

const BASE = "http://localhost:3000";
const DOSSIER = process.argv[2] ?? "captures";
mkdirSync(DOSSIER, { recursive: true });

const navigateur = await lancerNavigateur();
const page = await (await navigateur.newContext({ viewport: { width: 390, height: 844 } })).newPage();

await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
await page.fill('input[name="email"]', "demo@atlas.local");
await page.fill('input[name="password"]', "demo1234");
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/`, { timeout: 30_000 });

await page.click('button[aria-label="Ouvrir l\'assistant"]');
await page.waitForSelector('input[placeholder="Votre question…"]', { timeout: 20_000 });
await page.fill('input[placeholder="Votre question…"]', "Comment je supprime un chantier ?");
await page.keyboard.press("Enter");
await page.waitForSelector('[data-atlas="bulle-assistant"]', { timeout: 40_000 });

// **Rechargée, puis rouverte** : c'est SON geste, et c'est le seul état qui
// prouve quelque chose. Un panneau capturé sans recharger montrerait l'état
// d'avant ce lot.
await page.reload({ waitUntil: "networkidle" });
await page.click('button[aria-label="Ouvrir l\'assistant"]');
await page.waitForSelector('input[placeholder="Votre question…"]', { timeout: 20_000 });
await page.waitForTimeout(900);
await page.screenshot({ path: `${DOSSIER}/fil-apres-rechargement.png` });

await navigateur.close();
console.log(`Capture dans ${DOSSIER}/fil-apres-rechargement.png`);
