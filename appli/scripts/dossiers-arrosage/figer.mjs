// Fige le vrai écran d'arrosage pour la planche `appli/arrosage-dossiers.html`.
// Usage (serveur de démonstration lancé, base amorcée, voir LISEZ-MOI.md) :
//   ATLAS_ADRESSE=http://localhost:3000 node appli/scripts/dossiers-arrosage/figer.mjs <dossier de sortie>
// Il écrit css.txt, depart.json, plan.json, paysage.json, feuille.html, et
// donne les chiffres de la version d'avant (le même jardin sans le massif).
import { writeFileSync } from "node:fs";
import { ouvrir, feuilles, corps, BASE } from "../../../scripts/planche-figee/figer.mjs";

const SORTIE = process.argv[2];
if (!SORTIE) throw new Error("Donnez le dossier de sortie.");

// Le jardin de la planche du 18 octobre (`JARDIN_DE_LA_PLANCHE`, capture-plan-arrosage.ts),
// dans la forme que relit `lireLeDessin` : il part par le champ caché, comme « Faire le plan ».
export const JARDIN = {
  terrain: { L: 34, l: 16.4 },
  zones: [
    { type: "gazon", nom: "Pelouse arrière", x: 0, y: 0, L: 12, l: 12 },
    { type: "gazon", nom: "Pelouse avant", x: 14, y: 0, L: 8, l: 8 },
    { type: "massif", nom: "Massif", x: 14, y: 10, L: 20, l: 2.4 },
    { type: "gazon", nom: "Couloir", x: 0, y: 14, L: 10, l: 2 },
  ],
  nourrice: { x: 13, y: 6 },
  piquage: { x: 13, y: 0.5 },
};

const faireLePlan = async (page, jardin) => {
  await page.goto(`${BASE}/paysage/arrosage`);
  await page.waitForLoadState("networkidle");
  await page.evaluate((d) => {
    const champ = document.querySelector('input[name="dessin"]');
    champ.value = JSON.stringify(d);
    champ.form.requestSubmit();
  }, jardin);
  await page.waitForSelector('[data-atlas="plan-arrosage"]', { timeout: 120000 });
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(1500);
};

const { nav, contexte, page } = await ouvrir();
await page.goto(`${BASE}/paysage/arrosage`);
await page.waitForLoadState("networkidle");
await page.evaluate(() => document.fonts.ready);
writeFileSync(`${SORTIE}/css.txt`, await feuilles(page, contexte));
writeFileSync(`${SORTIE}/depart.json`, JSON.stringify(await corps(page, contexte)));

await faireLePlan(page, JARDIN);
writeFileSync(`${SORTIE}/plan.json`, JSON.stringify(await corps(page, contexte)));
await page.click('[data-atlas="envoyer-fournisseur"]');
await page.waitForSelector('[role="dialog"]');
await page.waitForTimeout(600);
writeFileSync(`${SORTIE}/feuille.html`, await page.evaluate(() => document.querySelector('[role="dialog"]').parentElement.outerHTML));

await page.goto(`${BASE}/paysage`);
await page.waitForLoadState("networkidle");
writeFileSync(`${SORTIE}/paysage.json`, JSON.stringify(await corps(page, contexte)));

// La version d'avant : le même jardin, sans le massif. Ses chiffres vont dans `composer.mjs` (v1).
await faireLePlan(page, { ...JARDIN, zones: JARDIN.zones.filter((z) => z.type !== "massif") });
console.log("version d'avant :", await page.evaluate(() => ({
  reseaux: document.querySelector('[data-atlas="reseaux"] h2')?.textContent,
  total: document.querySelector('[data-atlas="total-de-la-liste"]')?.textContent,
})));
await nav.close();
