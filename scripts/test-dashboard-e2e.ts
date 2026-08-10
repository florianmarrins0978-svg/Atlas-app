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

  // `a.atlas-brin`, et non tout lien vers un chantier : depuis que les
  // notifications défilent AVEC la liste (10 août 2026), « devis retourné »
  // pose lui aussi un `a[href^="/chantiers/"]` sur l'accueil. Le contrôle
  // comptait donc une carte de plus que le compteur, et accusait le compteur.
  // `atlas-brin` est la classe d'un brin du fil — une étiquette de code, pas
  // un libellé, donc stable d'une maquette à l'autre.
  const compterChantiersAffiches = () => page.locator("a.atlas-brin").count();
  const nbAvant = await compterChantiersAffiches();

  // Le compteur s'écrit en toutes lettres depuis le 10 août 2026 (« HUIT EN
  // COURS ») : on ne peut plus le lire au `parseInt`. Il porte donc son nombre
  // en attribut — un libellé se réécrit à chaque maquette, une étiquette de
  // code non, et un contrôle accroché au libellé casse à la refonte suivante
  // sans qu'aucun défaut n'existe.
  const lireCompteur = async () =>
    Number(await page.locator('[data-atlas="compteur"]').getAttribute("data-compte"));
  const nombreAvant = await lireCompteur();
  assert.equal(nombreAvant, nbAvant, "L'indicateur affiché doit correspondre au nombre réel de cartes chantier");

  // --- Crée un nouveau chantier réel et vérifie que l'indicateur se met à jour ---
  const nomUnique = `Chantier dashboard e2e ${Date.now()}`;
  await page.goto("http://localhost:3000/chantiers/nouveau", { waitUntil: "networkidle" });
  await page.fill('input[placeholder="M. Bernard"]', nomUnique);
  await page.click('button:has-text("Créer le chantier")');
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 5000 });

  await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  const nbApres = await compterChantiersAffiches();
  assert.equal(nbApres, nbAvant + 1, "Un chantier de plus doit apparaître après création réelle");

  assert.equal(await lireCompteur(), nbAvant + 1, "L'indicateur doit refléter le nouveau total réel");
  assert.ok(
    await page.locator(`text=${nomUnique}`).first().isVisible(),
    "Le nouveau chantier doit apparaître dans la liste"
  );

  // --- Persistance après rechargement ---
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(await lireCompteur(), nbAvant + 1);

  await browser.close();
  console.log("✅ Test bout-en-bout Dashboard (accueil) réussi.");
}

main().catch((err) => {
  console.error("❌", err);
  process.exit(1);
});
