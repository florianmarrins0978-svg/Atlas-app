import { session, TRAVAIL } from "./fige.mjs";
import { readFileSync } from "node:fs";
const J = readFileSync(`${TRAVAIL}/jeton-facture.txt`, "utf8").trim();
{
  const { page, va, fige, fin } = await session({ anonyme: true });
  try {
    await va(`/factures/${J}`);
    await fige("30-client-facture");
    await page.getByRole("button", { name: /J'ai bien reçu/ }).click();
    await page.waitForTimeout(3000);
    await fige("31-client-facture-recue");
  } catch (e) { console.log("ÉCHEC client", e.message.split("\n")[0]); }
  await fin();
}
{
  const { page, va, fige, fin } = await session();
  try {
    await va("/");
    const vu = page.locator('[data-atlas="j-ai-vu"]');
    for (let i = 0; i < 6 && !(await page.locator('[data-atlas="carte-virement"]').first().isVisible().catch(() => false)); i++) {
      await vu.first().click(); await page.waitForTimeout(2000);
    }
    await fige("32-accueil-virement");
    await page.locator('[data-atlas="carte-virement"]').getByRole("button", { name: /^Oui/ }).first().click();
    await page.waitForTimeout(3000);
    await fige("33-accueil-virement-oui");
    console.log((await page.evaluate(() => document.body.innerText)).slice(0, 500));
  } catch (e) { console.log("ÉCHEC", e.message.split("\n")[0]); await page.screenshot({ path: `${TRAVAIL}/echec.png`, fullPage: true }); }
  await fin();
}
