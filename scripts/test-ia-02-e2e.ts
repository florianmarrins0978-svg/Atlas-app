import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert";

async function main() {
  const browser = await lancerNavigateur();
  const context = await browser.newContext({ deviceScaleFactor: 3 });
  const page = await context.newPage();

  // Connexion réelle (Auth.js) — toutes les routes applicatives sont
  // désormais protégées par le middleware d'authentification.
  await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL("http://localhost:3000/", { timeout: 10000 });

  const nomUnique = `Chantier copilote e2e ${Date.now()}`;
  await page.goto("http://localhost:3000/chantiers/nouveau", { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Bernard"]', nomUnique);
  await page.click('button:has-text("Créer le chantier")');
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 5000 });
  const chantierUrl = page.url();

  // Ajoute une prestation réelle pour que l'assistant ait quelque chose à lire.
  await page.goto(`${chantierUrl}/informations`, { waitUntil: "networkidle" });
  await page.click("text=+ Ajouter une prestation");
  await page.waitForTimeout(300);
  const inputs = page.locator("form input");
  await inputs.first().fill("Poser la faïence murale");
  await inputs.first().blur();
  await page.waitForTimeout(300);

  // --- Ouverture de l'assistant ---
  await page.goto(chantierUrl, { waitUntil: "networkidle" });
  assert.equal(await page.locator("text=Assistant").count(), 0, "L'assistant doit être fermé par défaut");
  await page.click('button[aria-label="Ouvrir l\'assistant"]');
  await page.waitForSelector("text=Assistant");

  // --- Question sur les prestations ---
  await page.fill('input[placeholder="Votre question…"]', "Quelles sont les prestations prévues sur ce chantier ?");
  await page.click('button[aria-label="Envoyer"]');
  await page.waitForSelector("text=Sources", { timeout: 10000 });
  assert.ok(await page.locator("li", { hasText: "Prestations" }).isVisible(), "La source 'Prestations' doit être affichée");

  // --- Aucune mutation : la prestation existante est toujours là après l'échange ---
  await page.goto(`${chantierUrl}/informations`, { waitUntil: "networkidle" });
  assert.equal(await page.locator('input[value="Poser la faïence murale"]').count(), 1);

  // --- Fermeture ---
  await page.goto(chantierUrl, { waitUntil: "networkidle" });
  await page.click('button[aria-label="Ouvrir l\'assistant"]');
  await page.waitForSelector("text=Assistant");
  await page.click('button[aria-label="Fermer"]');
  await page.waitForTimeout(300);
  assert.equal(await page.locator("text=Assistant").count(), 0, "L'assistant doit se fermer correctement");

  await browser.close();
  console.log("✅ Test bout-en-bout Assistant (IA-02) réussi.");
}

main().catch((err) => {
  console.error("❌", err);
  process.exit(1);
});
