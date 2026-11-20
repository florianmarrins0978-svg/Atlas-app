import { session, TRAVAIL } from "./fige.mjs";
import { readFileSync } from "node:fs";
const id = readFileSync(`${TRAVAIL}/chantier.txt`, "utf8").trim();
const { page, va, fige, fin } = await session();
const pas = (t = 700) => page.waitForTimeout(t);
try {
  await va(`/chantiers/${id}/devis-complet`);
  await page.click('button:has-text("Choisir la date")');
  await pas(2500);
  await fige("13-choisir-date");
  const feuille = page.locator('text=Proposez une ou deux dates').locator("xpath=ancestor::*[contains(@class,'atlas-feuille') or @role='dialog'][1]");
  await page.locator('button[aria-label^="25 novembre"]:visible').first().click();
  await pas(1200);
  await fige("14-date-choisie");
  await page.screenshot({ path: `${TRAVAIL}/s4-a.png`, fullPage: true });
  await page.click('button:has-text("Envoyer le devis")');
  await pas(5000);
  await fige("15-devis-envoye");
  await page.screenshot({ path: `${TRAVAIL}/s4-b.png`, fullPage: true });
  console.log(page.url());
  console.log((await page.evaluate(() => document.body.innerText)).slice(0, 800));
} catch (e) { console.log("ÉCHEC", e.message.split("\n")[0]); await page.screenshot({ path: `${TRAVAIL}/echec.png`, fullPage: true }); }
await fin();
