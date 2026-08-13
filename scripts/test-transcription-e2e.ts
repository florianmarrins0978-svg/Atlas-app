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

  // --- Chantier avec transcription réelle (seed : Rénovation salle de bain) ---
  await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
  await page.click("text=Rénovation salle de bain");
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 5000 });
  // **L'adresse d'arrivée n'est plus forcément la fiche (13 août 2026).** La
  // liste ramène désormais à l'écran où le travail s'est arrêté
  // (`lienDeReprise`, `ARCHITECTURE.md` §76) : ce chantier de démonstration a
  // une dictée, donc on atterrit sur `/informations`. Déduire l'adresse de la
  // fiche en recopiant l'URL courante donnait `/informations/transcription`,
  // c'est-à-dire une page qui n'existe pas — et le rouge accusait la
  // transcription, qui n'y était pour rien.
  const chantierUrl = page.url().replace(/(\/chantiers\/[0-9a-f-]{36}).*$/, "$1");

  await page.goto(`${chantierUrl}/transcription`, { waitUntil: "networkidle" });
  assert.ok(await page.locator("text=Transcription").first().isVisible());
  assert.ok(
    await page.locator("text=/Alors pour la salle de bain/").isVisible(),
    "Le texte réel de la transcription du seed doit s'afficher"
  );

  // La transcription n'est pas une impasse : elle doit proposer la suite du
  // parcours plutôt que d'obliger à repasser par la fiche du chantier.
  //
  // Deux suites, depuis le 4 août 2026, et les deux comptent : la voie directe
  // — un appui, un devis chiffré — parce que c'est ce que le patron réclamait ;
  // et la voie détaillée, parce qu'un chantier douteux se relit ligne à ligne.
  assert.ok(
    await page.getByRole("button", { name: "Créer le devis à partir de ma dictée" }).isVisible(),
    "Une transcription disponible doit mener au devis en un seul geste"
  );
  assert.ok(
    await page.locator("text=vérifier les informations une par une").isVisible(),
    "La voie détaillée doit rester offerte à côté du raccourci"
  );

  // --- Persistance après rechargement ---
  await page.reload({ waitUntil: "networkidle" });
  assert.ok(await page.locator("text=/Alors pour la salle de bain/").isVisible());

  // --- Chantier neuf : note vocale absente ---
  const nomUnique = `Chantier transcription e2e ${Date.now()}`;
  await page.goto("http://localhost:3000/chantiers/nouveau", { waitUntil: "networkidle" });
  await page.fill('input[placeholder="M. Bernard"]', nomUnique);
  await page.click('button:has-text("Créer le chantier")');
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 5000 });
  const nouveauChantierUrl = page.url();

  await page.goto(`${nouveauChantierUrl}/transcription`, { waitUntil: "networkidle" });
  assert.ok(await page.locator("text=Aucune note vocale pour ce chantier.").isVisible());

  // --- Chantier introuvable ---
  await page.goto("http://localhost:3000/chantiers/00000000-0000-0000-0000-000000000000/transcription", {
    waitUntil: "networkidle",
  });
  assert.ok(await page.locator("text=404").first().isVisible(), "Le code 404 doit être visible");
  assert.ok(
    await page.locator("text=This page could not be found.").isVisible(),
    "Un chantier introuvable doit afficher la page 404"
  );

  await browser.close();
  console.log("✅ Test bout-en-bout Transcription réussi.");
}

main().catch((err) => {
  console.error("❌", err);
  process.exit(1);
});
