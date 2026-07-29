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

  const nomUnique = `Chantier e2e ${Date.now()}`;

  await page.goto("http://localhost:3000/chantiers/nouveau", { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Rénovation salle de bain"]', nomUnique);
  await page.fill('input[placeholder="M. Bernard"]', "M. E2E");
  await page.click('button:has-text("Créer le chantier")');

  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 5000 });
  const url = page.url();
  console.log("Redirigé vers:", url);
  assert.match(url, /\/chantiers\/[0-9a-f-]{36}$/, "Doit rediriger vers un vrai UUID");

  // La page hub relit le chantier depuis la base — si ces valeurs s'affichent,
  // la création a bien été persistée (pas de simulation restante).
  await page.waitForSelector(`text=${nomUnique}`, { timeout: 5000 });
  assert.ok(await page.locator(`text=${nomUnique}`).isVisible(), "Le nom du chantier créé doit apparaître sur le hub");
  assert.ok(await page.locator("text=M. E2E").isVisible(), "Le client créé doit apparaître");
  assert.ok(await page.locator("text=Ajouter des photos").isVisible(), "Un chantier neuf doit proposer 'Ajouter des photos'");

  // Revérifie via la liste (autre écran, autre requête) que le chantier y figure aussi.
  await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  assert.ok(await page.locator(`text=${nomUnique}`).isVisible(), "Le nouveau chantier doit apparaître dans la liste");

  await browser.close();
  console.log("✅ Test bout-en-bout de création réussi.");
}

main().catch((err) => {
  console.error("❌", err);
  process.exit(1);
});
