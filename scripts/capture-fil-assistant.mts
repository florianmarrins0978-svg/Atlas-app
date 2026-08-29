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

// **Un micro FACTICE, sinon rien à capturer.** Chromium sans ces deux drapeaux
// ouvre une demande d'autorisation qu'aucun test ne peut cocher, et
// `getUserMedia` reste bloqué.
const navigateur = await lancerNavigateur({
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
});
// **Le micro est ACCORDÉ, et une piste factice est jouée dedans.** Sans les
// deux, `getUserMedia` refuse et l'état « en train de parler » ne se capture
// jamais — or c'est précisément l'écran qu'il a demandé le 27 août 2026.
const contexte = await navigateur.newContext({
  viewport: { width: 390, height: 844 },
  permissions: ["microphone"],
});
const page = await contexte.newPage();

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

// **Le micro et l'appareil photo — sa demande du 27 août 2026.** Capturés dans
// la barre de saisie, là où ils vivent : c'est la seule façon de voir s'ils
// tiennent sans pousser le champ hors de l'écran.
const barre = page.locator('[data-atlas="micro-assistant"]').locator("xpath=..");
await barre.screenshot({ path: `${DOSSIER}/barre-micro-et-photo.png` });

// **L'ÉTAT « EN TRAIN DE PARLER » — sa demande du 27 août 2026.** Corbeille,
// zigzag, envoi : c'est la barre de WhatsApp, et elle ne se juge qu'à l'œil.
// **Le badge de développement de Next.js recouvre le coin bas-gauche**, donc le
// micro : Playwright refuse de cliquer un élément couvert, et le rouge accusait
// la barre d'un défaut qu'elle n'a pas. Il n'existe pas sur une version bâtie.
await page.evaluate(() => document.querySelector("nextjs-portal")?.remove());
await page.locator('[data-atlas="micro-assistant"]').click();
await page.locator('[data-atlas="barre-dictee"]').waitFor({ state: "visible", timeout: 20_000 });
// Deux secondes de son pour que l'onde ait de quoi dessiner : capturée dans la
// milliseconde, elle serait plate et ne prouverait rien.
await page.waitForTimeout(2000);
await page.evaluate(() => document.querySelector("nextjs-portal")?.remove());
await page.locator('[data-atlas="barre-dictee"]').screenshot({ path: `${DOSSIER}/barre-en-train-de-parler.png` });
await page.locator('[data-atlas="jeter-dictee"]').click();

await navigateur.close();
console.log(`Captures dans ${DOSSIER}/`);
