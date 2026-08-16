import type { Page, Locator } from "playwright";
import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert";

function section(page: Page): Locator {
  return page.locator("form");
}

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

  const nomUnique = `Chantier prix e2e ${Date.now()}`;
  await page.goto("http://localhost:3000/chantiers/nouveau", { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Bernard"]', nomUnique);
  await page.click('button:has-text("Créer le chantier")');
  // **Pas de délai écrit à la main ici.** Cinq secondes suffisent quand la
  // suite est jouée seule ; sous soixante suites enchaînées, la création d'un
  // chantier ne les tient pas, et le rouge accuse le produit au lieu de la
  // machine. Le délai commun — quarante-cinq secondes, posé par
  // `lancerNavigateur` — existe exactement pour cela (`e2e-browser.ts`).
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/);
  const prixUrl = `${page.url()}/prix`;

  // --- État vide ---
  await page.goto(prixUrl, { waitUntil: "networkidle" });
  assert.ok(await page.locator("text=Aucune ligne pour l'instant.").isVisible());

  // --- Ajout d'une ligne avec un montant décimal ---
  await page.click("text=+ Ajouter une ligne");
  await page.waitForTimeout(300);
  const inputs1 = section(page).locator("input");
  await inputs1.nth(0).fill("Main d'œuvre");
  await inputs1.nth(1).fill("1120.50");
  await inputs1.nth(1).blur();
  await page.waitForTimeout(400);

  // --- Ajout d'une seconde ligne ---
  await page.click("text=+ Ajouter une ligne");
  await page.waitForTimeout(300);
  const inputs2 = section(page).locator("input");
  await inputs2.nth(2).fill("Déplacement");
  await inputs2.nth(3).fill("34.50");
  await inputs2.nth(3).blur();
  await page.waitForTimeout(400);

  // --- Persistance après rechargement ---
  //
  // **On RELIT jusqu'à ce que la base ait reçu, au lieu d'attendre 400 ms.**
  // L'écran n'attend pas son enregistrement : il rend la main dès le doigt levé
  // et l'appel continue derrière. Quatre cents millisecondes suffisent quand la
  // suite est jouée seule ; sous quatre-vingts suites enchaînées, le
  // rechargement avorte l'appel en vol, et le contrôle accuse le calcul du prix
  // alors que rien n'est cassé — « '0.00' == '34.50' », le 16 août 2026.
  //
  // Même remède que `test-informations-e2e.ts`, `test-periodicite-tva-e2e.ts`
  // et `test-unite-tarif-e2e.ts` : **attendre ce qu'on affirme, jamais une
  // durée.**
  let inputsApresReload = section(page).locator("input");
  for (const essai of [1, 2, 3, 4]) {
    await page.reload({ waitUntil: "networkidle" });
    inputsApresReload = section(page).locator("input");
    if ((await inputsApresReload.nth(3).inputValue().catch(() => "")) === "34.50") break;
    await page.waitForTimeout(essai * 400);
  }
  assert.equal(await inputsApresReload.nth(0).inputValue(), "Main d'œuvre");
  assert.equal(await inputsApresReload.nth(1).inputValue(), "1120.50");
  assert.equal(await inputsApresReload.nth(2).inputValue(), "Déplacement");
  assert.equal(await inputsApresReload.nth(3).inputValue(), "34.50");

  // Le total doit afficher 1 155,00 € (formaté fr-FR), preuve d'un calcul exact.
  const totalApresReload = await page.locator("p", { hasText: "€" }).first().innerText();
  assert.match(totalApresReload.replace(/\s/g, " "), /1\s?155,00\s?€/);

  // --- Modification d'une ligne ---
  await inputsApresReload.nth(1).fill("1200.00");
  await inputsApresReload.nth(1).blur();
  await page.waitForTimeout(400);
  await page.reload({ waitUntil: "networkidle" });
  const totalApresModif = await page.locator("p", { hasText: "€" }).first().innerText();
  assert.match(totalApresModif.replace(/\s/g, " "), /1\s?234,50\s?€/);

  // --- Retrait, puis « Annuler » depuis le tiroir ---
  //
  // Le geste a changé le 10 août 2026 : plus de croix nue ni de bandeau
  // flottant, mais « Retirer » découvert par glissement et un tiroir en bas.
  // Ce qui compte ici n'a pas changé : **annuler doit RENDRE la ligne**. Et
  // c'est plus vrai qu'avant — rien n'est écrit tant que le tiroir est ouvert,
  // là où l'ancienne mécanique supprimait puis recréait une ligne neuve.
  await page.getByRole("button", { name: /^Retirer / }).first().click();
  await page.waitForTimeout(500);
  assert.ok(
    await page.locator(".atlas-tiroir[data-ouvert='oui']").first().isVisible(),
    "Le tiroir des retirés ne s'est pas ouvert."
  );
  await page.getByRole("button", { name: /^Annuler le retrait/ }).click();
  await page.waitForTimeout(1000);
  const nbLignesApresAnnulation = await section(page).locator("input").count();
  assert.equal(nbLignesApresAnnulation, 4, "Les deux lignes (4 champs) doivent être restaurées après annulation");

  await browser.close();
  console.log("✅ Test bout-en-bout Prix réussi.");
}

main().catch((err) => {
  console.error("❌", err);
  process.exit(1);
});
