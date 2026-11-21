import { session, TRAVAIL } from "./fige.mjs";
const { page, va, fige, fin } = await session();
const pas = (t = 700) => page.waitForTimeout(t);
const feuille = () => page.locator('[data-atlas="ajouter-aux-achats"]').locator("xpath=ancestor::*[.//input[@placeholder='Station, magasin…']][1]");
async function remplir({ ou, date, nature, total }) {
  await page.getByPlaceholder("Station, magasin…").fill(ou);
  await page.locator('input[type="date"]').first().fill(date);
  await page.locator('[data-atlas="nature-achat"] button', { hasText: nature }).click(); await pas(500);
  if (nature === "Carburant") { await page.locator('[data-atlas="vehicule-achat"] button', { hasText: "Utilitaire" }).click(); await pas(400); }
  await page.getByPlaceholder("0,00 €").fill(total);
  await page.getByPlaceholder("0,00 €").blur();
  await pas(900);
}
try {
  // Le chemin vers Ma TVA, comme il le prend : Terminés, puis la carte du haut.
  await va("/termines");
  await fige("33b-termines");
  await va("/termines/tva");
  await fige("34-tva");
  await page.click('button:has-text("Écrire à la main")'); await pas(1200);
  await remplir({ ou: "Pépinière des Saules", date: "2026-11-04", nature: "Matériel", total: "186" });
  await fige("35-tva-a-la-main");
  await page.click('[data-atlas="ajouter-aux-achats"]'); await pas(3500);
  await fige("36-tva-achat-ajoute");
  const [fc] = await Promise.all([page.waitForEvent("filechooser"), page.click('button:has-text("Scanner un ticket")')]);
  await fc.setFiles(`${TRAVAIL}/ticket-carburant.jpg`);
  await page.getByPlaceholder("Station, magasin…").waitFor({ timeout: 30000 }); await pas(2500);
  await remplir({ ou: "Station du Rond-Point", date: "2026-11-17", nature: "Carburant", total: "72,40" });
  await fige("37-tva-ticket-lu");
  await page.click('[data-atlas="ajouter-aux-achats"]'); await pas(3500);
  await page.evaluate(() => window.scrollTo(0, 0)); await pas(500);
  await fige("38-tva-ticket-ajoute");
  await page.click('[data-atlas="montant-collectee-ouvrir"]'); await page.waitForURL(/collectee/); await pas(2000);
  await fige("39-tva-collectee");
  await va("/termines/tva");
  await page.click('[data-atlas="montant-deductible-ouvrir"]'); await page.waitForURL(/deductible/); await pas(2000);
  await fige("40-tva-deductible");
} catch (e) { console.log("ÉCHEC", e.message.split("\n")[0]); await page.screenshot({ path: `${TRAVAIL}/echec.png`, fullPage: true }); }
await fin();
