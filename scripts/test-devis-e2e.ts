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

  const client = `M. Bernard ${Date.now()}`;
  await page.goto("http://localhost:3000/chantiers/nouveau", { waitUntil: "networkidle" });
  // Client et coordonnée : sans canal d'envoi convenu, l'écran devis refuse
  // — à juste titre — de partir chez le client.
  await page.fill('input[placeholder="Bernard"]', client);
  await page.fill('input[placeholder="06 12 34 56 78"]', "06 12 34 56 78");
  await page.click('[data-atlas="action-dicter"]');
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 5000 });
  const chantierUrl = page.url();

  // Ajoute une ligne de prix réelle pour que le devis ait un contenu non nul.
  await page.goto(`${chantierUrl}/prix`, { waitUntil: "networkidle" });
  await page.click("text=+ Ajouter une ligne");
  await page.waitForTimeout(300);
  const inputs = page.locator("form input");
  await inputs.nth(0).fill("Main d'œuvre");
  await inputs.nth(1).fill("1000.00");
  await inputs.nth(1).blur();
  await page.waitForTimeout(400);

  // --- Écran Devis : aperçu PDF avant envoi ---
  // L'adresse `/export` renvoie au devis tant que rien n'est parti (20 août
  // 2026, `ARCHITECTURE.md` §135) : on y va donc directement.
  await page.goto(`${chantierUrl}/devis-complet`, { waitUntil: "networkidle" });
  assert.ok(await page.locator("text=Aperçu du PDF").isVisible());

  const apercuHref = await page.locator("text=Aperçu du PDF").getAttribute("href");
  const reponseApercu = await page.request.get(`http://localhost:3000${apercuHref}`);
  assert.equal(reponseApercu.status(), 200);
  assert.equal(reponseApercu.headers()["content-type"], "application/pdf");
  const octetsApercu = await reponseApercu.body();
  assert.ok(octetsApercu.slice(0, 5).toString("ascii") === "%PDF-", "Le fichier doit être un vrai PDF");
  assert.ok(octetsApercu.length > 200);

  // Le total TTC doit refléter 1000 HT + 20% TVA = 1200,00 €.
  assert.ok(await page.locator("text=/1\\s?200,00\\s?€/").isVisible(), "Le total TTC doit être exact (1 200,00 €)");

  // --- Envoi au client ---
  await page.click("text=Choisir la date");
  await page.waitForSelector("text=Une date, ou deux au choix du client ?", { timeout: 10000 });
  await page.getByRole("button", { name: "Envoyer le devis" }).click();
  await page.waitForSelector("text=Devis prêt pour", { timeout: 10000 });

  // --- Persistance après rechargement : reste "envoyé" ---
  // L'écran ne répète plus « devis prêt » : rechargé, il dit où en est le devis
  // parti — ici, en attente de la réponse du client.
  await page.reload({ waitUntil: "networkidle" });
  assert.ok(
    await page.locator('p:text-is("En attente de réponse")').isVisible(),
    "L'état envoyé doit persister après rechargement"
  );
  assert.ok(await page.locator("text=Télécharger le PDF").isVisible());
  assert.ok(!(await page.locator("text=Choisir la date").isVisible()));

  // --- Le PDF téléchargé (envoyé) est un vrai PDF avec les bonnes données ---
  const telechargementHref = await page.locator("text=Télécharger le PDF").getAttribute("href");
  const reponsePdf = await page.request.get(`http://localhost:3000${telechargementHref}`);
  assert.equal(reponsePdf.status(), 200);
  assert.equal(reponsePdf.headers()["content-type"], "application/pdf");
  const octetsPdf = await reponsePdf.body();
  assert.equal(octetsPdf.slice(0, 5).toString("ascii"), "%PDF-");

  await browser.close();
  console.log("✅ Test bout-en-bout Devis/Export réussi.");
}

main().catch((err) => {
  console.error("❌", err);
  process.exit(1);
});
