// La fiche d'un client qui a déjà une histoire (Mme Costa, `histoire.mjs`) :
// ses devis, ses factures, et son dernier devis repris d'un geste.
import { session } from "./fige.mjs";
import { execFileSync } from "node:child_process";
const P = (sql) => execFileSync("psql", ["-qtA", "postgresql://postgres@localhost:5432/atlas_test", "-c", sql]).toString().trim();
const { page, va, fige, fin } = await session();
const pas = (t = 700) => page.waitForTimeout(t);
try {
  await va("/clients");
  await page.locator("text=Costa").first().click();
  await page.waitForURL(/\/clients\/[0-9a-f-]{36}/, { timeout: 60000 }); await pas(2500);
  await fige("02b-client-devis");
  await page.click('[data-atlas="registre"]:has-text("Factures")'); await pas(1200);
  await fige("02c-client-factures");
  await page.click('button:has-text("Dernier devis")');
  await page.waitForURL(/devis-complet/, { timeout: 60000 }); await pas(3500);
  const nouveau = page.url().match(/chantiers\/([0-9a-f-]{36})/)[1];
  await fige("02d-dernier-devis");
  await page.locator('button:has-text("+ 10 %")').first().click(); await pas(2500);
  await fige("02e-dernier-devis-hausse");
  // Le devis repris ne sert qu'à la visite : il quitte la liste des chantiers.
  P(`update chantiers set deleted_at=now() where id='${nouveau}'`);
} catch (e) { console.log("ÉCHEC", e.message.split("\n")[0]); }
await fin();
