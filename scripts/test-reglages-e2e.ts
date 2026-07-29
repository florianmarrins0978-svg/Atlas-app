import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert";

async function main() {
  const browser = await lancerNavigateur();
  const context = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3 });
  const page = await context.newPage();

  // Connexion réelle (Auth.js) — toutes les routes applicatives sont
  // désormais protégées par le middleware d'authentification.
  await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL("http://localhost:3000/", { timeout: 10000 });

  await page.goto("http://localhost:3000/reglages", { waitUntil: "networkidle" });
  assert.ok(await page.locator("text=Tarifs").first().isVisible());

  const libelleUnique = `Tarif e2e ${Date.now()}`;

  // --- Ajout ---
  await page.click("text=Ajouter un tarif");
  await page.waitForTimeout(300);
  const lignes = page.locator("li");
  const derniereLigne = lignes.last();
  const inputs = derniereLigne.locator("input");
  await inputs.nth(0).fill(libelleUnique);
  await inputs.nth(1).fill("42.50");
  await inputs.nth(1).blur();
  await page.waitForTimeout(400);

  // --- Persistance après rechargement ---
  await page.reload({ waitUntil: "networkidle" });
  const ligneApresReload = page.locator("li", { has: page.locator(`input[value="${libelleUnique}"]`) });
  assert.equal(await ligneApresReload.locator("input").nth(1).inputValue(), "42.50");

  // --- Modification ---
  await ligneApresReload.locator("input").nth(1).fill("50.00");
  await ligneApresReload.locator("input").nth(1).blur();
  await page.waitForTimeout(400);
  await page.reload({ waitUntil: "networkidle" });
  const ligneApresModif = page.locator("li", { has: page.locator(`input[value="${libelleUnique}"]`) });
  assert.equal(await ligneApresModif.locator("input").nth(1).inputValue(), "50.00");

  // --- Suppression ---
  const nbAvant = await page.locator("li").count();
  await ligneApresModif.locator('button[aria-label="Supprimer ce tarif"]').click();
  await page.waitForTimeout(400);
  await page.reload({ waitUntil: "networkidle" });
  const nbApres = await page.locator("li").count();
  assert.equal(nbApres, nbAvant - 1, "Le tarif supprimé ne doit plus apparaître après rechargement");
  assert.equal(await page.locator(`input[value="${libelleUnique}"]`).count(), 0);

  await browser.close();
  console.log("✅ Test bout-en-bout Tarifs réussi.");
}

main().catch((err) => {
  console.error("❌", err);
  process.exit(1);
});
