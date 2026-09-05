// Regarder les écrans dont les boutons viennent de changer de vert.
// `localhost`, jamais `127.0.0.1` : Next refuse ses ressources de dev à une
// origine étrangère, et la page n'est alors jamais hydratée.
import { mkdirSync } from "node:fs";
import { chromium, devices } from "playwright";

const dossier = process.argv[2];
mkdirSync(dossier, { recursive: true });

const navigateur = await chromium.launch();
const contexte = await navigateur.newContext({ ...devices["iPhone 13"], isMobile: true, hasTouch: true });
const page = await contexte.newPage();

await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
await page.fill('input[name="email"]', "demo@atlas.local");
await page.fill('input[name="password"]', "demo1234");
await page.click('button[type="submit"]');
await page.waitForURL("http://localhost:3000/", { timeout: 60000 });

const ecrans: [string, string][] = [
  ["termines", "/termines"],
  ["tva", "/termines/tva"],
  ["reglages-compte", "/reglages/compte"],
  ["reglages-identite", "/reglages/identite"],
  ["reglages-connexion", "/reglages/connexion"],
  ["reglages-notifications", "/reglages/notifications"],
  ["reglages-documents", "/reglages/documents"],
];

for (const [nom, chemin] of ecrans) {
  try {
    await page.goto(`http://localhost:3000${chemin}`, { waitUntil: "networkidle", timeout: 45000 });
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${dossier}/${nom}.png`, fullPage: true });
    console.log(`ok ${nom}`);
  } catch (e) {
    console.log(`X  ${nom} — ${(e as Error).message.split("\n")[0]}`);
  }
}

// Ce que l'œil ne mesure pas : la couleur RENDUE des aplats de chaque écran.
await page.goto("http://localhost:3000/termines/tva", { waitUntil: "networkidle" });
const fonds = await page.evaluate(() =>
  [...document.querySelectorAll("button, a")]
    .map((e) => getComputedStyle(e).backgroundColor)
    .filter((c) => c !== "rgba(0, 0, 0, 0)" && c !== "transparent")
);
console.log("TVA — aplats rendus :", [...new Set(fonds)].join(" | "));

// ─── LES BOUTONS QU'IL FAUT RÉVEILLER POUR LES VOIR ─────────────────────────
//
// Une barre « Enregistrer » naît ÉTEINTE, donc creuse et grise : la capturer au
// repos ne montre pas la couleur qu'on vient de changer. On tape d'abord, comme
// lui. Même chose pour le calendrier des périodes, qui vit derrière l'année.

await page.goto("http://localhost:3000/termines/tva", { waitUntil: "networkidle" });
await page.locator("button", { hasText: /^2026$/ }).first().click();
await page.waitForTimeout(500);
await page.screenshot({ path: `${dossier}/tva-calendrier.png`, fullPage: true });
console.log("ok tva-calendrier");

await page.goto("http://localhost:3000/reglages/identite", { waitUntil: "networkidle" });
const champ = page.locator("input[type=text]").first();
await champ.fill((await champ.inputValue()) + " ");
await page.waitForTimeout(400);
await page.screenshot({ path: `${dossier}/reglages-identite-eveille.png`, fullPage: true });
const fondEnregistrer = await page.evaluate(() => {
  const b = [...document.querySelectorAll("button")].find((e) => /Enregistrer/.test(e.textContent ?? ""));
  return b ? getComputedStyle(b).backgroundColor : "aucun bouton trouvé";
});
console.log("Identité — « Enregistrer » rendu :", fondEnregistrer);

await navigateur.close();
