import { session, TRAVAIL } from "./fige.mjs";
import { readFileSync } from "node:fs";
const id = readFileSync(`${TRAVAIL}/chantier.txt`, "utf8").trim();
const { page, va, fige, fin } = await session();
const pas = (t = 700) => page.waitForTimeout(t);
try {
  await va("/termines");
  await fige("25-termines");
  await page.click('[data-atlas="onglet-retours"]'); await page.waitForURL(/retours/); await pas(2000);
  await fige("25b-retours");
  await page.locator('[data-atlas="carte-de-retour"]').first().click(); await pas(2000);
  await fige("25c-retour");
  await va(`/chantiers/${id}/facture`);
  const creer = page.getByRole("button", { name: "Créer la facture" });
  if (await creer.count()) { await fige("26-facture-realise"); await creer.click(); await pas(6000); }
  await fige("27-facture");
  await page.locator('[data-atlas="envoyer-la-facture"]').scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, 120));
  await pas(800);
  await fige("28-facture-envoi");
  await page.locator('[data-atlas="envoyer-la-facture"]').click();
  await pas(6000);
  await fige("29-facture-envoyee");
  console.log((await page.evaluate(() => document.body.innerText)).slice(0, 900));
} catch (e) { console.log("ÉCHEC", e.message.split("\n")[0]); await page.screenshot({ path: `${TRAVAIL}/echec.png`, fullPage: true }); }
await fin();
