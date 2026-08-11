/**
 * Prend une capture de l'écran d'accueil, au format iPhone, et rien d'autre.
 *
 * **Pourquoi ce script existe.** Trois défauts réels de ce projet — une barre
 * de navigation sur la page publique du client, l'ordre des totaux d'une
 * facture, une pile de notifications qui poussait tout hors de l'écran — ont
 * été trouvés en REGARDANT une capture, jamais par une suite verte
 * (`CLAUDE.md` §5). Refaire un écran d'après une maquette sans jamais le
 * regarder revient à corriger à l'aveugle.
 *
 * Suppose un serveur déjà en écoute (`npm run banc`). Écrit le fichier demandé
 * et ne juge rien : c'est l'œil qui juge.
 *
 *   npx tsx scripts/capture-accueil.mts <fichier.png> [port]
 */
import { existsSync, readdirSync } from "node:fs";
import { chromium, devices } from "playwright";

const fichier = process.argv[2] ?? "accueil.png";
const port = process.argv[3] ?? "3000";
const base = `http://127.0.0.1:${port}`;

/** Playwright ne trouve pas seul un navigateur installé hors de son cache. */
function navigateurPreInstalle(): string | undefined {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const racine = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!racine || !existsSync(racine)) return undefined;
  const dossier = readdirSync(racine).find((d) => /^chromium-\d+$/.test(d));
  if (!dossier) return undefined;
  const chemin = `${racine}/${dossier}/chrome-linux/chrome`;
  return existsSync(chemin) ? chemin : undefined;
}

const navigateur = await chromium.launch({ executablePath: navigateurPreInstalle() });
// **L'écran du patron, barre du navigateur déduite.** Ces scripts posaient
// 393 × 852 — la dalle d'un iPhone 14, pas la place qui reste à la page une
// fois la barre d'adresse installée : 390 × 664. Sur le cadre trop haut, une
// capture montrait un bas d'écran que personne ne voit ainsi, et c'est
// exactement ce qui a laissé passer, le 11 août 2026, une bulle d'assistant
// qui recouvrait un lien. Une capture qui ment coûte plus cher qu'aucune
// capture : c'est sur elle qu'on décide.
const contexte = await navigateur.newContext({
  ...devices["iPhone 13"],
});
const page = await contexte.newPage();

await page.goto(`${base}/login`, { waitUntil: "networkidle" });
await page.fill('input[name="email"]', "demo@atlas.local");
await page.fill('input[name="password"]', "demo1234");
await page.click('button[type="submit"]');
await page.waitForURL(`${base}/`, { timeout: 60_000 });
await page.goto(`${base}/`, { waitUntil: "networkidle" });
// Les polices décident de la moitié des mesures qu'on vient de régler : les
// attendre évite de juger une capture en Times.
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(400);

await page.screenshot({ path: fichier });
// Le bas de l'écran compte autant que le haut : la barre de navigation y vit,
// et c'est elle qui a masqué une carte entière par le passé.
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(300);
await page.screenshot({ path: fichier.replace(/\.png$/, "-bas.png") });
// Et la barre elle-même, cadrée : une barre coupée par le bord de l'écran ne se
// voit pas sur une capture pleine page, et c'est exactement le genre de défaut
// qui arrive jusqu'au patron.
const barre = page.locator("nav[aria-label='Navigation principale']");
await barre.screenshot({ path: fichier.replace(/\.png$/, "-barre.png") });
console.log("boîte de la barre :", JSON.stringify(await barre.boundingBox()));
console.log(`capture écrite : ${fichier}`);

await navigateur.close();
