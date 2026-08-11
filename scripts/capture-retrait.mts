/**
 * Le retrait, écran par écran : au repos, glissé, puis tiroir ouvert.
 *
 * **Pourquoi ce script existe.** Sur ce lot de maquettes, tous les défauts ont
 * été trouvés à l'œil et aucun aux contrôles — dont une cible tactile qui
 * mesurait zéro pixel. Un geste ne se relit pas, il se regarde ; et une cible
 * ne se déduit pas, elle se mesure.
 *
 * Il ne juge rien, sauf deux choses qu'aucun œil ne voit :
 *
 *   - **le centre de « Retirer » tombe-t-il dans sa propre cible**, et cette
 *     cible fait-elle au moins 44 px de haut ;
 *   - **une seule ligne part-elle** — le défaut classique est un sélecteur qui
 *     frappe toutes les suivantes, et il reste invisible tant qu'on ne regarde
 *     qu'une ligne à la fois.
 *
 * Suppose un serveur déjà en écoute.
 *
 *   npx tsx scripts/capture-retrait.mts <dossier> <nom> <url> [selecteurLigne]
 */
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { chromium, type Page, devices } from "playwright";

const dossier = process.argv[2];
const nom = process.argv[3];
const chemin = process.argv[4];
const selecteurLigne = process.argv[5] ?? ".atlas-ligne";
/**
 * Un écran peut arriver vide — un devis neuf n'a aucune ligne. Le libellé
 * donné ici est touché deux fois avant la capture, pour qu'il y ait quelque
 * chose à retirer. Sans cela le contrôle n'éprouverait rien, et il le dit.
 */
const boutonPrealable = process.argv[6];
// **`localhost`, et surtout PAS `127.0.0.1`.** Next refuse de servir ses
// ressources de développement à une origine qu'il juge étrangère : sur
// `127.0.0.1`, `/_next/*` répond en refus, la page s'affiche — rendue par le
// serveur — et n'est JAMAIS hydratée. Les boutons existent alors dans le HTML
// sans le moindre écouteur : on clique dans le vide, et le contrôle accuse
// l'écran d'être cassé. Une heure perdue là-dessus le 10 août 2026, sur du
// code qui était juste.
const base = `http://localhost:${process.env.PORT_BANC ?? "3000"}`;

if (!dossier || !nom || !chemin) {
  console.error("usage : npx tsx scripts/capture-retrait.mts <dossier> <nom> <url> [selecteurLigne]");
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

/** Le geste : pousser la colonne du texte jusqu'au bout de sa course. */
async function glisser(page: Page, index: number) {
  await page.locator(`${selecteurLigne} .atlas-glisse`).nth(index).evaluate((el) => {
    el.scrollTo({ left: el.scrollWidth, behavior: "instant" as ScrollBehavior });
  });
  await page.waitForTimeout(450);
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

await page.goto(`${base}${chemin}`, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
// **Attendre que l'écran soit VIVANT, pas seulement affiché.** En développement,
// Next compile à l'ouverture : le bouton existe dans le HTML rendu par le
// serveur bien avant que React ne lui ait attaché quoi que ce soit. Cliquer
// trop tôt ne fait rien du tout — et le contrôle accusait alors le retrait
// d'être cassé alors qu'il n'était pas encore branché. Une heure perdue.
//
// Il ÉCHOUE si le marqueur n'arrive pas : un contrôle qui avale cette attente
// passerait au vert en cliquant dans le vide, ce qui est le pire des deux
// mondes. Et le message doit désigner le bon coupable — l'écran n'est pas
// cassé, il n'est pas branché.
try {
  await page.locator("[data-atlas-vivant='oui']").first().waitFor({ state: "attached", timeout: 60_000 });
} catch {
  console.error(
    `✗ ${nom} : l'écran ne s'est jamais hydraté. Ce n'est pas le retrait qui est en cause — ` +
      `vérifier que l'adresse est bien « localhost » (Next bloque ses ressources sur 127.0.0.1) ` +
      `et que le serveur a fini de compiler.`
  );
  await navigateur.close();
  process.exit(1);
}
await page.waitForTimeout(700);
if (boutonPrealable) {
  for (let i = 0; i < 2; i++) {
    await page.getByText(boutonPrealable, { exact: true }).first().click();
    await page.waitForTimeout(900);
  }
}

await page.screenshot({ path: `${dossier}/${nom}-1-repos.png`, fullPage: true });

const lignes = page.locator(selecteurLigne);
const avant = await lignes.count();
if (avant === 0) {
  console.error(`✗ ${nom} : aucune ligne retirable sur ${chemin} — ce contrôle n'a rien éprouvé.`);
  await navigateur.close();
  process.exit(1);
}

await glisser(page, 0);
await page.screenshot({ path: `${dossier}/${nom}-2-glisse.png`, fullPage: true });

// La cible, mesurée. Une pastille dessinée à côté de sa zone donne un « rien ne
// se passe » que rien d'autre ne détecte.
const bouton = page.locator(`${selecteurLigne} .atlas-decouvre`).first();
const cible = await bouton.boundingBox();
if (!cible) {
  console.error(`✗ ${nom} : « Retirer » n'a aucune boîte — cible de zéro pixel.`);
  await navigateur.close();
  process.exit(1);
}
const centre = { x: cible.x + cible.width / 2, y: cible.y + cible.height / 2 };
const auCentre = await page.evaluate(
  ([x, y]) => {
    const el = document.elementFromPoint(x as number, y as number);
    return el ? !!el.closest(".atlas-decouvre") : false;
  },
  [centre.x, centre.y]
);
console.log(
  `  ${nom} — cible « Retirer » : ${Math.round(cible.width)} × ${Math.round(cible.height)} px, ` +
    `centre dans la cible : ${auCentre ? "oui" : "NON"}`
);
if (!auCentre || cible.height < 44) {
  console.error(`✗ ${nom} : la cible de « Retirer » n'est pas atteignable au doigt.`);
  await navigateur.close();
  process.exit(1);
}

await bouton.click();
await page.waitForTimeout(1100);
await page.screenshot({ path: `${dossier}/${nom}-3-tiroir.png`, fullPage: true });

// Une seule ligne part.
const restantes = await page.locator(`${selecteurLigne}:not([data-retiree="oui"])`).count();
const parties = avant - restantes;
console.log(`  ${nom} — lignes avant : ${avant}, parties : ${parties}`);
if (parties !== 1) {
  console.error(`✗ ${nom} : ${parties} ligne(s) sont parties au lieu d'une seule.`);
  await navigateur.close();
  process.exit(1);
}

const tiroir = page.locator(".atlas-tiroir[data-ouvert='oui']");
if ((await tiroir.count()) === 0) {
  console.error(`✗ ${nom} : le tiroir ne s'est pas ouvert.`);
  await navigateur.close();
  process.exit(1);
}
console.log(`  ${nom} — tiroir : « ${(await tiroir.first().innerText()).replace(/\s+/g, " ")} »`);
console.log(`✅ ${nom} : captures écrites dans ${dossier}`);

await navigateur.close();
