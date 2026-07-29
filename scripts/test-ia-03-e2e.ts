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

  const nomUnique = `Chantier propositions e2e ${Date.now()}`;
  await page.goto("http://localhost:3000/chantiers/nouveau", { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Rénovation salle de bain"]', nomUnique);
  await page.click('button:has-text("Créer le chantier")');
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 5000 });
  const chantierUrl = page.url();

  // --- Ouvre l'assistant et demande un ajout de prestation ---
  await page.goto(chantierUrl, { waitUntil: "networkidle" });
  await page.click('button[aria-label="Ouvrir l\'assistant"]');
  await page.waitForSelector("text=Assistant");
  await page.fill('input[placeholder="Votre question…"]', "Ajoute la prestation Élagage chêne");
  await page.click('button[aria-label="Envoyer"]');
  await page.waitForSelector("text=Appliquer les modifications", { timeout: 10000 });
  assert.ok(await page.locator("span", { hasText: "Ajouter prestation : Élagage chêne" }).isVisible());

  // --- Confirme l'application ---
  await page.click("text=Appliquer les modifications");
  await page.waitForSelector("text=/— Appliqué/", { timeout: 10000 });

  // --- Vérifie la persistance réelle sur l'écran Informations ---
  await page.goto(`${chantierUrl}/informations`, { waitUntil: "networkidle" });
  assert.equal(await page.locator('input[value="Élagage chêne"]').count(), 1);

  // --- Nouvelle demande, annulée cette fois : aucune écriture ---
  await page.goto(chantierUrl, { waitUntil: "networkidle" });
  await page.click('button[aria-label="Ouvrir l\'assistant"]');
  await page.waitForSelector("text=Assistant");
  await page.fill('input[placeholder="Votre question…"]', "Ajoute la prestation Ne jamais appliquer ceci");
  await page.click('button[aria-label="Envoyer"]');
  await page.waitForSelector("text=Appliquer les modifications", { timeout: 10000 });
  await page.click("text=Annuler");
  await page.waitForSelector("text=Annulé.");

  await page.goto(`${chantierUrl}/informations`, { waitUntil: "networkidle" });
  assert.equal(
    await page.locator('input[value="Ne jamais appliquer ceci"]').count(),
    0,
    "Une proposition annulée ne doit jamais être écrite"
  );

  await browser.close();
  console.log("✅ Test bout-en-bout Propositions (IA-03) réussi.");
}

main().catch((err) => {
  console.error("❌", err);
  process.exit(1);
});
