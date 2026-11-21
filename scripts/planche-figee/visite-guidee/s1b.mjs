// La fiche d'un client qui a déjà une histoire (Mme Costa, `histoire.mjs`) :
// ses devis, ses factures, et son dernier devis repris d'un geste.
import { session } from "./fige.mjs";
import { execFileSync } from "node:child_process";
const P = (sql) => execFileSync("psql", ["-qtA", "postgresql://postgres@localhost:5432/atlas_test", "-c", sql]).toString().trim();
const { page, va, fige, fin } = await session();
const pas = (t = 700) => page.waitForTimeout(t);
try {
  // L'assistant connaît l'appli et les devis passés : il retrouve une ligne et son prix.
  // Avant « Dernier devis » : la copie ferait une seconde ligne de claustra à trouver.
  await va("/");
  await page.click('button[aria-label="Ouvrir l\'assistant"]'); await pas(1500);
  await fige("01b-assistant");
  await page.fill('input[placeholder="Votre question…"]', "Il me semble que dans le devis chez Costa il y avait une ligne de claustra. Retrouve-la avec son prix.");
  await pas(500);
  await fige("01c-assistant-question");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => /trouv/i.test(document.body.innerText.split("Retrouve-la avec son prix.")[1] || ""), null, { timeout: 60000 }); await pas(2500);
  await fige("01d-assistant-reponse");
  console.log("assistant :", (await page.evaluate(() => document.body.innerText.split("Retrouve-la avec son prix.")[1] || "")).slice(0, 400));
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
