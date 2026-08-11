/**
 * La ligne « Version » de Réglages, telle qu'il la lira.
 *
 * **Pourquoi cette capture existe.** Le 11 août 2026 au soir, cette ligne a
 * répondu « oui » à la seule question que le patron sache poser depuis un
 * téléphone — *« est-ce que j'ai les corrections ? »* — alors que la réponse
 * était non. Elle affichait « 11/08/2026 19:37 · b45cd5d » : une date juste, un
 * commit juste, et pas un mot sur la branche. Son espace suivait `main`, le
 * travail vivait ailleurs, et rien à l'écran ne pouvait les départager.
 *
 * Une suite mesure que la branche est dans la chaîne rendue
 * (`test-version-executee.ts`). Elle ne dit rien de ce que ça DONNE : une ligne
 * exacte mais coupée au bord de l'écran, ou illisible sur six pouces, ne
 * vaudrait pas mieux que l'ancienne. Les noms de branche de ce dépôt font
 * quarante-quatre caractères — c'est précisément le genre de chose qu'on ne
 * voit qu'en regardant (`CLAUDE.md` §5).
 *
 * Suppose un serveur en écoute et le jeu de démonstration en base.
 *
 *   npx tsx scripts/capture-version-branche.mts <dossier> [port]
 */
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { chromium, devices } from "playwright";

const dossier = process.argv[2] ?? "captures";
const port = process.argv[3] ?? "3000";
// « localhost », jamais « 127.0.0.1 » : Next refuse de servir ses ressources de
// développement à une adresse qu'il ne reconnaît pas, et la page arrive alors
// affichée mais jamais hydratée. Le même piège est noté dans `capture-retrait.mts`.
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
await page.goto(`${base}/reglages`, { waitUntil: "networkidle" });

// La ligne vit tout en bas de l'écran : sans cela, la capture montre les tarifs.
const titre = page.getByText("Version", { exact: true }).last();
await titre.scrollIntoViewIfNeeded();
await page.waitForTimeout(400);

await page.screenshot({ path: `${dossier}/version-1-ecran.png` });

// Et de près, parce que c'est un mot de quarante-quatre caractères qu'on juge,
// pas une mise en page.
const bloc = titre.locator("xpath=..");
await bloc.screenshot({ path: `${dossier}/version-2-la-ligne.png` });

// Écrit aussi en clair : une capture se regarde, un texte se cherche.
console.log("  ligne rendue :", (await bloc.innerText()).replace(/\n+/g, " | "));
// Le débordement se MESURE, il ne se devine pas sur une image : un nom de
// branche trop long pousserait la page à défiler en travers, ce qui est le
// défaut que cette capture cherche.
const deborde = await bloc.evaluate(
  (n) => n.scrollWidth > document.documentElement.clientWidth,
);
console.log(deborde ? "  ⚠ la ligne déborde de l'écran" : "  la ligne tient dans l'écran");

await navigateur.close();
console.log(`deux captures écrites dans ${dossier}/`);
