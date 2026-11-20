import { session, TRAVAIL } from "./fige.mjs";
import { readFileSync } from "node:fs";
const id = readFileSync(`${TRAVAIL}/chantier.txt`, "utf8").trim();
const { page, va, fige, fin } = await session();
try {
  await va(`/chantiers/${id}/devis-complet`);
  await page.locator('[data-atlas="apercu-pdf"]').click();
  await page.waitForURL(/documents\/pdf/, { timeout: 60000 });
  await page.waitForSelector("canvas", { timeout: 60000 });
  await page.waitForTimeout(4000);
  await fige("12-apercu-pdf");
  await page.screenshot({ path: `${TRAVAIL}/s3b.png`, fullPage: true });
} catch (e) { console.log("ÉCHEC", e.message.split("\n")[0]); await page.screenshot({ path: `${TRAVAIL}/echec.png`, fullPage: true }); }
await fin();
