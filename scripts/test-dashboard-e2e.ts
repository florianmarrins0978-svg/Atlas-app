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

  await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  assert.ok(await page.locator("text=Chantiers").first().isVisible());

  const compterChantiersAffiches = () => page.locator('a[href^="/chantiers/"]:not([href="/chantiers/nouveau"])').count();
  const nbAvant = await compterChantiersAffiches();

  const texteCompteurAvant = await page.locator("text=/chantiers? en cours/").innerText();
  const nombreAvant = parseInt(texteCompteurAvant, 10);
  assert.equal(nombreAvant, nbAvant, "L'indicateur affiché doit correspondre au nombre réel de cartes chantier");

  // --- Crée un nouveau chantier réel et vérifie que l'indicateur se met à jour ---
  const nomUnique = `Chantier dashboard e2e ${Date.now()}`;
  await page.goto("http://localhost:3000/chantiers/nouveau", { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Rénovation salle de bain"]', nomUnique);
  await page.click('button:has-text("Créer le chantier")');
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 5000 });

  await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  const nbApres = await compterChantiersAffiches();
  assert.equal(nbApres, nbAvant + 1, "Un chantier de plus doit apparaître après création réelle");

  const texteCompteurApres = await page.locator("text=/chantiers? en cours/").innerText();
  const nombreApres = parseInt(texteCompteurApres, 10);
  assert.equal(nombreApres, nbAvant + 1, "L'indicateur doit refléter le nouveau total réel");
  assert.ok(await page.locator(`text=${nomUnique}`).isVisible(), "Le nouveau chantier doit apparaître dans la liste");

  // --- Persistance après rechargement ---
  await page.reload({ waitUntil: "networkidle" });
  const texteApresReload = await page.locator("text=/chantiers? en cours/").innerText();
  assert.equal(parseInt(texteApresReload, 10), nbAvant + 1);

  await browser.close();
  console.log("✅ Test bout-en-bout Dashboard (accueil) réussi.");
}

main().catch((err) => {
  console.error("❌", err);
  process.exit(1);
});
