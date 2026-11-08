// Parcourt une planche comme lui : chaque étape, chaque geste, à 390 px
// (`CLAUDE.md` §3 bis, 2 quater : aucun geste muet). Usage :
//   node scripts/planche-figee/parcourir.mjs <planche absolue> <dossier des images> '<sélecteur>=><étape attendue>' …
import { lancer } from "./figer.mjs";
const [fichier, sortie, ...gestes] = process.argv.slice(2);
const nav = await lancer();
const page = await (await nav.newContext({ viewport: { width: 390, height: 844 } })).newPage();
const erreurs = [];
page.on("pageerror", (e) => erreurs.push(e.message));
page.on("console", (m) => m.type() === "error" && erreurs.push(m.text()));
await page.goto(`file://${fichier}`);
let i = 0;
const photo = async (nom) => { await page.waitForTimeout(450); await page.screenshot({ path: `${sortie}/${String(++i).padStart(2, "0")}-${nom}.png` }); };
const visible = () => page.evaluate(() => document.querySelector("[data-planche]:not([hidden])")?.dataset.planche);
const dit = () => page.evaluate(() => { const d = document.querySelector(".planche-dit"); return d.classList.contains("visible") ? d.textContent : ""; });
console.log("départ :", await visible(), "largeur", await page.evaluate(() => document.documentElement.scrollWidth));
await photo("depart");
for (const g of gestes) {
  const [sel, attendu] = g.split("=>");
  const cible = page.locator(`[data-planche]:not([hidden]) ${sel}, .planche-tete ${sel}`).first();
  await cible.scrollIntoViewIfNeeded();
  await cible.click();
  await page.waitForTimeout(300);
  const v = await visible(), d = await dit();
  console.log(`${sel} :: état ${v}${d ? " :: dit « " + d + " »" : ""}${attendu && attendu !== v ? "   <<< ATTENDU " + attendu : ""}`);
  await photo(sel.replace(/[^a-z0-9]+/gi, "_").slice(0, 40));
}
// Tout geste de l'état visible répond-il ?
const muets = await page.evaluate(() => [...document.querySelectorAll("[data-planche] a, [data-planche] button")].filter((e) => !e.dataset.va && !e.dataset.dit && e.getAttribute("role") !== "tab" && !(e.getAttribute("aria-label") || e.textContent || "").trim()).length);
console.log("gestes sans mot ni réponse :", muets, "| erreurs :", erreurs.length ? erreurs : "aucune");
await nav.close();
