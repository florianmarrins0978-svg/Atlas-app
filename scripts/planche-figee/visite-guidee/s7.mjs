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
  // Ce qui s'essaie sur la facture, sauf l'envoi : le PDF, les travaux en plus,
  // « Facture acquittée » (posé puis retiré : le paiement viendra de la banque).
  await page.click('[data-atlas="voir-facture"]');
  await page.waitForURL(/documents\/pdf/, { timeout: 60000 });
  await page.waitForSelector("canvas", { timeout: 60000 }); await pas(5000);
  await fige("27-facture-pdf");
  await va(`/chantiers/${id}/facture`);
  await page.click('[data-atlas="ajouter-travaux-supplementaires"]');
  await page.waitForURL(/travaux-supplementaires/, { timeout: 60000 }); await pas(2000);
  await fige("27-travaux-en-plus");
  await va(`/chantiers/${id}/facture`);
  await page.locator('[data-atlas="facture-acquittee"]').scrollIntoViewIfNeeded();
  await page.click('[data-atlas="facture-acquittee"]'); await pas(3000);
  await page.locator('[data-atlas="reglements-recus"]').scrollIntoViewIfNeeded(); await page.evaluate(() => window.scrollBy(0, 120)); await pas(700);
  await fige("27-facture-acquittee");
  await page.click('[data-atlas="facture-acquittee"]'); await pas(3000);
  await va(`/chantiers/${id}/facture`);
  console.log("net à payer après l'essai :", await page.locator('[data-atlas="net-a-payer"]').innerText());
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
