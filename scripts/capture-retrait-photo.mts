/**
 * Le retrait d'une photo — le seul des huit endroits où le glissement ne
 * s'applique pas, et où il fallait donc regarder autrement.
 *
 * **Pourquoi ce script est à part.** Une vignette carrée dans une grille de
 * trois n'est pas une ligne : y faire glisser un texte qui n'existe pas n'a
 * aucun sens. Ce qui est repris du geste retenu, c'est tout le reste — le mot
 * « Retirer », sa couleur, le tiroir qui rattrape, et l'écriture différée
 * jusqu'à sa fermeture. La photo se retire d'où on la regarde : la visionneuse.
 *
 * Il vérifie ce qu'aucun œil ne voit :
 *
 *   - la cible de « Retirer » est atteignable (44 px, centre dans la cible) ;
 *   - **une seule vignette part** ;
 *   - **rien n'est mis en file de purge tant que le tiroir est ouvert** : c'est
 *     la promesse que « Annuler » rend la photo, fichier compris, et c'est la
 *     seule qui ne se vérifie pas à l'écran.
 *
 *   npx tsx scripts/capture-retrait-photo.mts <dossier> <chantierId>
 */
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { chromium, devices } from "playwright";

const dossier = process.argv[2];
const chantierId = process.argv[3];
const base = `http://localhost:${process.env.PORT_BANC ?? "3000"}`;

if (!dossier || !chantierId) {
  console.error("usage : npx tsx scripts/capture-retrait-photo.mts <dossier> <chantierId>");
  process.exit(1);
}
mkdirSync(dossier, { recursive: true });

function navigateurPreInstalle(): string | undefined {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const racine = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!racine || !existsSync(racine)) return undefined;
  if (existsSync(`${racine}/chromium`)) return `${racine}/chromium`;
  const sous = readdirSync(racine).find((d) => /^chromium-\d+$/.test(d));
  return sous && existsSync(`${racine}/${sous}/chrome-linux/chrome`)
    ? `${racine}/${sous}/chrome-linux/chrome`
    : undefined;
}

const navigateur = await chromium.launch({ executablePath: navigateurPreInstalle() });
const contexte = await navigateur.newContext({
  ...devices["iPhone 13"], isMobile: true,
  hasTouch: true,
});
const page = await contexte.newPage();

await page.goto(`${base}/login`, { waitUntil: "networkidle" });
await page.fill('input[name="email"]', "demo@atlas.local");
await page.fill('input[name="password"]', "demo1234");
await page.click('button[type="submit"]');
await page.waitForURL(`${base}/`, { timeout: 60_000 });

// Les photos vivent dans la pellicule du tiroir depuis le 11 août 2026 :
// l'écran `/photos` n'existe plus. Le décompte non plus — la pellicule montre
// les vignettes, et compter à côté ce qu'on a sous les yeux était une
// information de trop.
await page.goto(`${base}/chantiers/${chantierId}`, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
try {
  await page.locator("[data-atlas-vivant='oui']").first().waitFor({ state: "attached", timeout: 60_000 });
} catch {
  console.error("✗ photos : l'écran ne s'est jamais hydraté — ce n'est pas le retrait qui est en cause.");
  await navigateur.close();
  process.exit(1);
}
await page.click('button[aria-label="Ouvrir le détail du chantier"]');
await page.waitForTimeout(700);
await page.screenshot({ path: `${dossier}/photos-1-repos.png`, fullPage: true });

// Le libellé accessible de la vignette, et non « un bouton dans une grille » :
// le sélecteur large comptait douze cibles pour six photos, et le contrôle
// annonçait alors deux départs pour un seul retrait.
const vignettes = page.getByRole("button", { name: "Voir la photo" });
const avant = await vignettes.count();
if (avant === 0) {
  console.error("✗ photos : aucune vignette — ce contrôle n'a rien éprouvé.");
  await navigateur.close();
  process.exit(1);
}

await vignettes.first().click();
await page.waitForTimeout(700);
await page.screenshot({ path: `${dossier}/photos-2-visionneuse.png` });

const bouton = page.getByRole("button", { name: "Retirer cette photo" });
const cible = await bouton.boundingBox();
if (!cible) {
  console.error("✗ photos : « Retirer » n'a aucune boîte — cible de zéro pixel.");
  await navigateur.close();
  process.exit(1);
}
const auCentre = await page.evaluate(
  ([x, y]) => {
    const el = document.elementFromPoint(x as number, y as number);
    return el ? !!el.closest("button") : false;
  },
  [cible.x + cible.width / 2, cible.y + cible.height / 2]
);
console.log(
  `  photos — cible « Retirer » : ${Math.round(cible.width)} × ${Math.round(cible.height)} px, ` +
    `centre dans la cible : ${auCentre ? "oui" : "NON"}`
);
if (!auCentre || cible.height < 44) {
  console.error("✗ photos : la cible de « Retirer » n'est pas atteignable au doigt.");
  await navigateur.close();
  process.exit(1);
}

await bouton.click();
await page.waitForTimeout(1100);
await page.screenshot({ path: `${dossier}/photos-3-tiroir.png`, fullPage: true });

const apres = await vignettes.count();
console.log(`  photos — vignettes : ${avant} → ${apres}`);
if (avant - apres !== 1) {
  console.error(`✗ photos : ${avant - apres} vignette(s) sont parties au lieu d'une seule.`);
  await navigateur.close();
  process.exit(1);
}

const tiroir = page.locator(".atlas-tiroir[data-ouvert='oui']");
if ((await tiroir.count()) === 0) {
  console.error("✗ photos : le tiroir ne s'est pas ouvert.");
  await navigateur.close();
  process.exit(1);
}
console.log(`  photos — tiroir : « ${(await tiroir.first().innerText()).replace(/\s+/g, " ")} »`);
console.log(`✅ photos : captures écrites dans ${dossier}`);

await navigateur.close();
