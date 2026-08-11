/**
 * Trois captures du bouton « Nouveau chantier » : au repos, en plein geste, et
 * la feuille montée.
 *
 * **Pourquoi ce script existe.** La suite mesure le délai et l'existence des
 * animations ; elle ne dit rien de ce que ça DONNE. Sur les maquettes, trois
 * défauts n'ont été trouvés que par une capture : des grains qui pâlissaient
 * dès leur départ et restaient invisibles, une gerbe cachée sous le disque, et
 * un mot collé au bord de l'écran. Aucun contrôle ne les avait vus
 * (`CLAUDE.md` §5 : « et surtout : regarder l'écran »).
 *
 * Le vol est figé en posant `currentTime` sur les animations RÉELLES du
 * navigateur, jamais en recopiant l'étape voulue : une capture qui rejoue sa
 * propre idée de l'animation ne prouve rien de celle qui tourne.
 *
 * Suppose un serveur en écoute et le jeu de démonstration en base.
 *
 *   npx tsx scripts/capture-bouton-nouveau-chantier.mts <dossier> [port]
 */
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { chromium, devices } from "playwright";

const dossier = process.argv[2] ?? "captures";
const port = process.argv[3] ?? "3000";
// **« localhost », et surtout pas « 127.0.0.1 ».** Next refuse de servir ses
// ressources de développement à une adresse qu'il ne reconnaît pas : la page
// arrive alors affichée mais JAMAIS hydratée, et l'appui navigue au lieu de
// jouer le geste. Le même piège est noté dans `capture-retrait.mts`.
const base = `http://localhost:${port}`;
mkdirSync(dossier, { recursive: true });

function navigateurPreInstalle(): string | undefined {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const racine = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!racine || !existsSync(racine)) return undefined;
  const nom = readdirSync(racine).find((d) => /^chromium-\d+$/.test(d));
  if (!nom) return undefined;
  const chemin = `${racine}/${nom}/chrome-linux/chrome`;
  return existsSync(chemin) ? chemin : undefined;
}

const navigateur = await chromium.launch({ executablePath: navigateurPreInstalle() });
const contexte = await navigateur.newContext({
  ...devices["iPhone 14"],
  // L'écran du patron, barre d'adresse déduite — la même mesure que partout
  // ailleurs (`e2e-browser.ts`, ECRAN_DU_PATRON).
  viewport: { width: 390, height: 664 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
});
const page = await contexte.newPage();

await page.goto(`${base}/login`, { waitUntil: "networkidle" });
await page.fill('input[name="email"]', "demo@atlas.local");
await page.fill('input[name="password"]', "demo1234");
await page.click('button[type="submit"]');
await page.waitForURL(`${base}/`, { timeout: 20_000 });
await page.goto(`${base}/`, { waitUntil: "networkidle" });

// Attendre que l'écran soit VIVANT, pas seulement affiché : avant l'hydratation,
// l'appui navigue vers la page entière (le repli voulu), et la capture montre
// alors le formulaire au lieu du geste.
try {
  await page.locator("[data-atlas-vivant='oui']").first().waitFor({ state: "attached", timeout: 60_000 });
} catch {
  console.error(
    "✗ l'écran ne s'est jamais hydraté : ce n'est pas le bouton qui est en cause. " +
      "Vérifier que le serveur a fini de compiler.",
  );
  process.exit(1);
}

const bouton = page.locator('[data-atlas="nouveau-chantier"]');
await bouton.waitFor({ state: "visible" });

// 1 · Au repos, le battement à sa plus grande extension — c'est l'état qu'il
// verra dix fois par jour.
await page.evaluate(() => {
  document.querySelectorAll(".atlas-pouls").forEach((n) =>
    n.getAnimations().forEach((a) => {
      a.currentTime = 3400 * 0.3;
      a.pause();
    }),
  );
});
await page.screenshot({ path: `${dossier}/bouton-1-attente.png` });

// 2 · En plein geste : le tour et les onze grains, figés à mi-course.
await page.evaluate(() => {
  document.querySelectorAll(".atlas-pouls").forEach((n) =>
    n.getAnimations().forEach((a) => a.play()),
  );
});
await bouton.evaluate((n) => (n as HTMLElement).click());
await page.waitForTimeout(40);
await page.evaluate(() => {
  document
    .querySelectorAll('[data-atlas="nouveau-chantier"] .atlas-signe, [data-atlas="nouveau-chantier"] .atlas-gerbe i')
    .forEach((n) =>
      n.getAnimations().forEach((a) => {
        a.currentTime = 300;
        a.pause();
      }),
    );
});
await page.screenshot({ path: `${dossier}/bouton-2-geste.png` });

// 3 · La feuille, une demi-seconde après l'appui.
await page.evaluate(() => {
  document.querySelectorAll("*").forEach((n) => n.getAnimations().forEach((a) => a.play()));
});
await page.waitForTimeout(1200);
await page.screenshot({ path: `${dossier}/bouton-3-feuille.png` });

await navigateur.close();
console.log(`trois captures écrites dans ${dossier}/`);
