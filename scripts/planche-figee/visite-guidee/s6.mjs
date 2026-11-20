import { session, TRAVAIL } from "./fige.mjs";
const { page, va, fige, fin } = await session();
const pas = (t = 700) => page.waitForTimeout(t);
try {
  // Le client vient de signer : l'accueil le dit, avant le planning.
  await va("/");
  await fige("19b-accueil-accepte");
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
  // La fiche de sécurité : ouverte sur le planning, puis sa page, qui s'ouvre sur le décret.
  await page.click('[data-atlas="ouvrir-fiche-de-securite"]'); await pas(1200);
  await page.locator('[data-atlas="remplir-la-fiche"]').scrollIntoViewIfNeeded(); await page.evaluate(() => window.scrollBy(0, 160)); await pas(700);
  await fige("24b-fiche-securite");
  const fiche = await page.locator('[data-atlas="remplir-la-fiche"]').getAttribute("href");
  await va(fiche); await pas(1500);
  await fige("24c-fiche-decret");
  // Les travaux à faire, ouverts sur la même journée.
  await va("/planning");
  await page.locator('button[aria-label^="25 novembre"]:visible').first().click(); await pas(2000);
  await page.click('[data-atlas="ouvrir-travaux"]'); await pas(1200);
  await page.locator('[data-atlas="travaux-a-faire"]').scrollIntoViewIfNeeded(); await page.evaluate(() => window.scrollBy(0, 120)); await pas(700);
  await fige("24d-travaux");
} catch (e) { console.log("ÉCHEC", e.message.split("\n")[0]); await page.screenshot({ path: `${TRAVAIL}/echec.png`, fullPage: true }); }
await fin();
