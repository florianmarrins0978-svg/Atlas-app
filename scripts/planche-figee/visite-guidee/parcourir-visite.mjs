// Parcourt la visite comme un visiteur : touche le doigt à chaque étape (ou
// Suivant), photographie, et signale toute étape dont la cible manque.
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
const TRAVAIL = process.env.VISITE_TRAVAIL ?? "/tmp/visite-guidee";
const req = createRequire(import.meta.url);
const { chromium } = req("playwright");
const fichier = process.argv[2] ?? `${TRAVAIL}/visite.html`;
const sortie = process.argv[3] ?? `${TRAVAIL}/parcours`;
const largeur = Number(process.argv[4] ?? 390);
mkdirSync(sortie, { recursive: true });
const nav = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await (await nav.newContext({ viewport: { width: largeur, height: 844 } })).newPage();
const erreurs = [];
page.on("pageerror", (e) => erreurs.push(e.message));
await page.goto(`file://${fichier}`);
await page.waitForTimeout(800);
await page.screenshot({ path: `${sortie}/00-ouverture.png` });
await page.click(".v-ouverture button");
const n = await page.evaluate(() => document.querySelectorAll(".visite-ecran").length);
let i = 0;
const sansCible = [];
for (let k = 0; k < 60; k++) {
  await page.waitForTimeout(1600);
  // Pendant que les champs s'écrivent, le guide est en retrait : on attend qu'il revienne.
  await page.waitForSelector(".v-guide:not(.en-retrait)", { timeout: 15000 });
  await page.waitForTimeout(500);
  const etat = await page.evaluate(() => ({
    ecran: document.querySelector(".visite-ecran:not([hidden])")?.dataset.ecran,
    titre: document.querySelector(".v-guide h2").textContent,
    doigt: getComputedStyle(document.querySelector(".v-doigt")).opacity === "1",
    bouton: document.querySelector(".v-suivant").textContent,
    large: (() => { const y = scrollY; scrollTo(600, y); const x = scrollX; scrollTo(0, y); return x; })(),
  }));
  await page.screenshot({ path: `${sortie}/${String(++i).padStart(2, "0")}-${etat.ecran}.png` });
  console.log(i, etat.ecran, "«", etat.titre, "»", etat.doigt ? "doigt" : "", etat.bouton, etat.large > 0 ? `DÉBORDE ${etat.large}` : "");
  if (etat.bouton === "Recommencer") break;
  if (etat.doigt) {
    const b = await page.evaluate(() => { const r = document.querySelector(".v-doigt").getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    const avant = etat.ecran + etat.titre;
    await page.mouse.click(b.x, b.y);
    await page.waitForTimeout(500);
    const apres = await page.evaluate(() => document.querySelector(".visite-ecran:not([hidden])")?.dataset.ecran + document.querySelector(".v-guide h2").textContent);
    if (apres === avant) {
      console.log("   LE DOIGT NE MÈNE NULLE PART", JSON.stringify(b), await page.evaluate(({ x, y }) => { const e = document.elementFromPoint(x, y); return e?.outerHTML.slice(0, 160); }, b));
      await page.click(".v-suivant");
    }
  } else {
    if (etat.bouton === "Passer") sansCible.push(etat.ecran);
    await page.click(".v-suivant");
  }
}
// Les Réglages libres : chaque rubrique s'ouvre et revient.
const liens = await page.evaluate(() => [...document.querySelector(".visite-ecran:not([hidden])").querySelectorAll('a[href^="/reglages/"]')].map((a) => a.getAttribute("href")));
let ouvertes = 0;
for (const h of liens) {
  await page.locator(`.visite-ecran:not([hidden]) a[href="${h}"]`).first().scrollIntoViewIfNeeded();
  await page.locator(`.visite-ecran:not([hidden]) a[href="${h}"]`).first().click();
  await page.waitForTimeout(300);
  const e = await page.evaluate(() => document.querySelector(".visite-ecran:not([hidden])")?.dataset.ecran);
  if (e?.startsWith("r-")) ouvertes++; else console.log("rubrique muette", h, e);
  if (h === "/reglages/idee") await page.screenshot({ path: `${sortie}/zz-idee.png` });
  await page.click(".v-retour");
  await page.waitForTimeout(300);
}
console.log("rubriques ouvertes", ouvertes, "/", liens.length, "| cible manquante :", sansCible, "| erreurs", erreurs);
await nav.close();
