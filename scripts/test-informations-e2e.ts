import type { Page, Locator } from "playwright";
import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert";

function section(page: Page, label: string): Locator {
  return page.locator("div.flex.flex-col.gap-2", { has: page.locator("span", { hasText: label }) });
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

  const nomUnique = `Chantier informations e2e ${Date.now()}`;
  await page.goto("http://localhost:3000/chantiers/nouveau", { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Rénovation salle de bain"]', nomUnique);
  await page.click('button:has-text("Créer le chantier")');
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 5000 });
  const infoUrl = `${page.url()}/informations`;

  // --- État vide ---
  await page.goto(infoUrl, { waitUntil: "networkidle" });
  assert.ok(await page.locator("text=Aucune prestation pour l'instant.").isVisible());
  assert.ok(await page.locator("text=Aucun matériel pour l'instant.").isVisible());

  // --- Ajout réel d'une prestation ---
  await page.click("text=+ Ajouter une prestation");
  await page.waitForTimeout(300);
  const prestationInput = section(page, "Prestations").locator("input").first();
  await prestationInput.fill("Dépose carrelage");
  await prestationInput.blur();
  await page.waitForTimeout(500); // laisse la persistance (onBlur) s'exécuter

  // Recharge la page pour vérifier que la prestation est bien persistée en base
  // (nouvelle instance de page pour repartir d'un DOM neuf, sélecteurs stables).
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(
    await section(page, "Prestations").locator("input").first().inputValue(),
    "Dépose carrelage",
    "La prestation doit être persistée après rechargement"
  );

  // --- Ajout du matériel ---
  await page.click("text=+ Ajouter un matériel");
  await page.waitForTimeout(300);
  const materielInput = section(page, "Matériel").locator("input").first();
  await materielInput.fill("Colle flex");
  await materielInput.blur();
  await page.waitForTimeout(500);
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(
    await section(page, "Matériel").locator("input").first().inputValue(),
    "Colle flex",
    "Le matériel doit être persisté après rechargement"
  );

  // --- Durée et équipe ---
  const dureeInput = page.locator("label", { hasText: "Durée" }).locator("input");
  await dureeInput.fill("3 jours");
  await dureeInput.blur();
  const equipeInput = page.locator("label", { hasText: "Équipe" }).locator("input");
  await equipeInput.fill("2 hommes");
  await equipeInput.blur();
  await page.waitForTimeout(500);
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(await page.locator("label", { hasText: "Durée" }).locator("input").inputValue(), "3 jours");
  assert.equal(await page.locator("label", { hasText: "Équipe" }).locator("input").inputValue(), "2 hommes");

  // --- Modification d'une prestation ---
  const prestationAModifier = section(page, "Prestations").locator("input").first();
  await prestationAModifier.fill("Dépose carrelage (terminé)");
  await prestationAModifier.blur();
  await page.waitForTimeout(500);
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(await section(page, "Prestations").locator("input").first().inputValue(), "Dépose carrelage (terminé)");

  // --- Suppression avec toast Annuler ---
  await section(page, "Prestations").locator('button[aria-label="Retirer cette ligne"]').first().click();
  await page.waitForTimeout(300);
  assert.ok(await page.locator("text=Prestation supprimée").isVisible());
  await page.getByRole("button", { name: "Annuler" }).click();
  await page.waitForTimeout(300);
  const prestationsApresAnnulation = await section(page, "Prestations").locator("input").count();
  assert.equal(prestationsApresAnnulation, 1, "La prestation doit être restaurée après annulation");

  await browser.close();
  console.log("✅ Test bout-en-bout Informations réussi.");
}

main().catch((err) => {
  console.error("❌", err);
  process.exit(1);
});
