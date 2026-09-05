import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert";
import { creerPuisFiche } from "./_creer-chantier-e2e";

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

  const nomUnique = `Chantier propositions e2e ${Date.now()}`;
  await page.goto("http://localhost:3000/chantiers/nouveau", { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Bernard"]', nomUnique);
  const idChantier = await creerPuisFiche(page);
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 5000 });
  const chantierUrl = `http://localhost:3000/chantiers/${idChantier}`;

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
  // **Visé par son libellé EXACT.** Depuis que la pellicule vit sur la fiche
  // (11 août 2026), le tiroir des retirés y est rendu en permanence — replié,
  // mais présent — et il porte lui aussi un « Annuler ». `text=` en trouvait
  // deux et cliquait le mauvais, sous le panneau de l'assistant. Le libellé
  // accessible du tiroir est « Annuler le retrait » : la correspondance exacte
  // les sépare.
  await page.getByRole("button", { name: "Annuler", exact: true }).click();
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
