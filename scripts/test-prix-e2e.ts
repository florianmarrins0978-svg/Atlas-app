import type { Page, Locator } from "playwright";
import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert";

function section(page: Page): Locator {
  return page.locator("form");
}

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

  const nomUnique = `Chantier prix e2e ${Date.now()}`;
  await page.goto("http://localhost:3000/chantiers/nouveau", { waitUntil: "networkidle" });
  await page.fill('input[placeholder="M. Bernard"]', nomUnique);
  await page.click('button:has-text("Créer le chantier")');
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 5000 });
  const prixUrl = `${page.url()}/prix`;

  // --- État vide ---
  await page.goto(prixUrl, { waitUntil: "networkidle" });
  assert.ok(await page.locator("text=Aucune ligne pour l'instant.").isVisible());

  // --- Ajout d'une ligne avec un montant décimal ---
  await page.click("text=+ Ajouter une ligne");
  await page.waitForTimeout(300);
  const inputs1 = section(page).locator("input");
  await inputs1.nth(0).fill("Main d'œuvre");
  await inputs1.nth(1).fill("1120.50");
  await inputs1.nth(1).blur();
  await page.waitForTimeout(400);

  // --- Ajout d'une seconde ligne ---
  await page.click("text=+ Ajouter une ligne");
  await page.waitForTimeout(300);
  const inputs2 = section(page).locator("input");
  await inputs2.nth(2).fill("Déplacement");
  await inputs2.nth(3).fill("34.50");
  await inputs2.nth(3).blur();
  await page.waitForTimeout(400);

  // --- Persistance après rechargement ---
  await page.reload({ waitUntil: "networkidle" });
  const inputsApresReload = section(page).locator("input");
  assert.equal(await inputsApresReload.nth(0).inputValue(), "Main d'œuvre");
  assert.equal(await inputsApresReload.nth(1).inputValue(), "1120.50");
  assert.equal(await inputsApresReload.nth(2).inputValue(), "Déplacement");
  assert.equal(await inputsApresReload.nth(3).inputValue(), "34.50");

  // Le total doit afficher 1 155,00 € (formaté fr-FR), preuve d'un calcul exact.
  const totalApresReload = await page.locator("p", { hasText: "€" }).first().innerText();
  assert.match(totalApresReload.replace(/\s/g, " "), /1\s?155,00\s?€/);

  // --- Modification d'une ligne ---
  await inputsApresReload.nth(1).fill("1200.00");
  await inputsApresReload.nth(1).blur();
  await page.waitForTimeout(400);
  await page.reload({ waitUntil: "networkidle" });
  const totalApresModif = await page.locator("p", { hasText: "€" }).first().innerText();
  assert.match(totalApresModif.replace(/\s/g, " "), /1\s?234,50\s?€/);

  // --- Suppression avec toast Annuler ---
  await section(page).locator('button[aria-label="Retirer cette ligne"]').first().click();
  await page.waitForTimeout(300);
  assert.ok(await page.locator("text=Ligne supprimée").isVisible());
  await page.getByRole("button", { name: "Annuler" }).click();
  await page.waitForTimeout(1000);
  const nbLignesApresAnnulation = await section(page).locator("input").count();
  assert.equal(nbLignesApresAnnulation, 4, "Les deux lignes (4 champs) doivent être restaurées après annulation");

  await browser.close();
  console.log("✅ Test bout-en-bout Prix réussi.");
}

main().catch((err) => {
  console.error("❌", err);
  process.exit(1);
});
