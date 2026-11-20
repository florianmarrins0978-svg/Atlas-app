import { session, TRAVAIL } from "./fige.mjs";
const { page, va, fige, fin } = await session();
const pas = (t = 700) => page.waitForTimeout(t);
try {
  await va("/planning");
  await fige("20-planning");
  await page.locator('button[aria-label^="25 novembre"]:visible').first().click();
  await pas(2000);
  await page.locator('[data-atlas="carte-jour"]').scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -60));
  await pas(600);
  await fige("21-planning-jour");
  await page.locator('[data-atlas="equipe"]').first().click();
  await pas(900);
  await fige("22-planning-choisir");
  const choisir = page.locator('[data-atlas="choisir"]').first();
  await choisir.getByRole("button", { name: "Paul" }).click(); await pas(1200);
  await choisir.getByRole("button", { name: "Kévin" }).click().catch(async () => {
    await page.locator('[data-atlas="choisir"] button:has-text("Kévin")').first().click();
  });
  await pas(1200);
  await page.locator('[data-atlas="choisir"] button:has-text("Fermer")').first().click().catch(() => {});
  await pas(1500);
  await page.locator('[data-atlas="equipe"][data-vide="1"]').first().click(); await pas(900);
  await page.locator('[data-atlas="choisir"] button:has-text("Paul")').first().click(); await pas(1200);
  await page.locator('[data-atlas="choisir"] button:has-text("Kévin")').first().click(); await pas(1200);
  await page.locator('[data-atlas="choisir"] button:has-text("Fermer")').first().click().catch(() => {});
  await pas(1500);
  console.log(await page.locator('[data-atlas="bloc-chantier"]').first().innerText());
  await fige("23-planning-salaries");
  await page.locator('[data-atlas="feuille"]').first().scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, 180));
  await pas(900);
  await fige("24-planning-fiche");
} catch (e) { console.log("ÉCHEC", e.message.split("\n")[0]); await page.screenshot({ path: `${TRAVAIL}/echec.png`, fullPage: true }); }
await fin();
