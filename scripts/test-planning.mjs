import { chromium } from "playwright";
import { mkdirSync } from "fs";
import assert from "node:assert";

const OUT = "artifacts/screenshots/step-18-planning-reel";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});
const context = await browser.newContext({
  viewport: { width: 393, height: 852 },
  deviceScaleFactor: 3,
});
const page = await context.newPage();

await page.goto("http://localhost:3000/planning", { waitUntil: "networkidle" });

// --- Test 1 : état initial — "Reprise de toiture" à planifier, rien encore planifié ---
assert.ok(await page.locator("text=Reprise de toiture").isVisible(), "Le chantier à planifier doit apparaître");
assert.ok(
  await page.locator("text=Aucun chantier planifié pour l'instant.").isVisible(),
  "Aucun chantier planifié au départ (données de démonstration inchangées : 4 chantiers)"
);
await page.screenshot({ path: `${OUT}/01-etat-initial.png`, fullPage: true });

// --- Test 2 : ouverture du choix de date ---
await page.click("text=Reprise de toiture");
await page.waitForTimeout(150);
assert.ok(await page.locator('input[type="date"]').isVisible(), "Le sélecteur de date doit être visible");
await page.screenshot({ path: `${OUT}/02-choix-date-ouvert.png`, fullPage: true });

// --- Test 3 : annulation — rien ne doit changer ---
await page.getByRole("button", { name: "Annuler" }).click();
await page.waitForTimeout(150);
assert.ok(await page.locator("text=Reprise de toiture").isVisible(), "Le chantier doit rester dans 'À planifier' après annulation");
const aPlanifierApresAnnulation = await page.locator("text=Choisir une date").count();
assert.equal(aPlanifierApresAnnulation, 1, "Toujours un seul chantier à planifier après annulation");
await page.screenshot({ path: `${OUT}/03-apres-annulation.png`, fullPage: true });

// --- Test 4 : choix d'une date ---
await page.click("text=Reprise de toiture");
await page.waitForTimeout(150);
await page.fill('input[type="date"]', "2026-08-05");
await page.waitForTimeout(150);

// --- Test 5 : formatage français de la date affichée dans la feuille ---
const dateAffichee = await page.locator("text=/^mercredi 5 août 2026$/").isVisible().catch(() => false);
console.log("Date formatée en français visible ('mercredi 5 août 2026'):", dateAffichee);
assert.ok(dateAffichee, "La date doit être formatée en toutes lettres en français");
await page.screenshot({ path: `${OUT}/04-date-formatee-francais.png`, fullPage: true });

// --- Test 6 : confirmation — passage de 'À planifier' vers 'Planifiés' ---
await page.click("text=Confirmer la planification");
await page.waitForTimeout(150);
const encoreAPlanifier = await page.locator("text=Choisir une date").count();
assert.equal(encoreAPlanifier, 0, "Plus aucun chantier ne doit rester dans 'À planifier'");
assert.ok(await page.locator("text=Aucun chantier en attente de planification.").isVisible(), "Message d'état vide pour 'À planifier'");
assert.ok(await page.locator("text=Reprise de toiture").isVisible(), "Le chantier doit maintenant apparaître dans 'Planifiés'");
await page.screenshot({ path: `${OUT}/05-apres-confirmation.png`, fullPage: true });

// --- Test 7 : un chantier déjà planifié ne peut pas être planifié une seconde fois ---
// Il ne doit plus apparaître dans "À planifier", et le rouvrir ne crée pas de doublon.
await page.click("text=Reprise de toiture");
await page.waitForTimeout(150);
const valeurPreRemplie = await page.locator('input[type="date"]').inputValue();
assert.equal(valeurPreRemplie, "2026-08-05", "Rouvrir un chantier déjà planifié doit pré-remplir sa date existante, pas la réinitialiser");
await page.getByRole("button", { name: "Annuler" }).click();
await page.waitForTimeout(150);
const totalPlanifiesApres = await page
  .locator("text=Planifiés")
  .locator("xpath=following-sibling::div[1]//button")
  .count();
assert.equal(totalPlanifiesApres, 1, "Toujours exactement 1 chantier planifié, pas de doublon");
const totalAPlanifierApres = await page.locator("text=Choisir une date").count();
assert.equal(totalAPlanifierApres, 0, "Le chantier ne doit pas réapparaître dans 'À planifier'");
await page.screenshot({ path: `${OUT}/06-pas-de-doublon.png`, fullPage: true });

await browser.close();
console.log("Tous les tests sont passés. Captures générées.");
console.log("Rappel : le tri chronologique est vérifié séparément par scripts/test-tri-planning.mjs (fixtures locales).");
