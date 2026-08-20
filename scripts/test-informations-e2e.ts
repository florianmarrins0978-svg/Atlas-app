import type { Page, Locator } from "playwright";
import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert";

function section(page: Page, label: string): Locator {
  return page.locator("div.flex.flex-col.gap-2", { has: page.locator("span", { hasText: label }) });
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

  const nomUnique = `Chantier informations e2e ${Date.now()}`;
  await page.goto("http://localhost:3000/chantiers/nouveau", { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Bernard"]', nomUnique);
  await page.click('[data-atlas="action-dicter"]');
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 5000 });
  const infoUrl = `${page.url()}/informations`;

  // --- État vide ---
  await page.goto(infoUrl, { waitUntil: "networkidle" });
  assert.ok(await page.locator("text=Aucune prestation pour l'instant.").isVisible());
  assert.ok(await page.locator("text=Aucun matériel pour l'instant.").isVisible());

  // --- Ajout réel d'une prestation ---
  await page.click("text=+ Ajouter une prestation");
  await page.waitForTimeout(300);
  const prestationInput = section(page, "Prestations").locator("input").first();
  await prestationInput.fill("Dépose carrelage");
  await prestationInput.blur();
  await page.waitForTimeout(500); // laisse la persistance (onBlur) s'exécuter

  // Recharge la page pour vérifier que la prestation est bien persistée en base
  // (nouvelle instance de page pour repartir d'un DOM neuf, sélecteurs stables).
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(
    await section(page, "Prestations").locator("input").first().inputValue(),
    "Dépose carrelage",
    "La prestation doit être persistée après rechargement"
  );

  // --- Ajout du matériel ---
  await page.click("text=+ Ajouter un matériel");
  await page.waitForTimeout(300);
  const materielInput = section(page, "Matériel").locator("input").first();
  await materielInput.fill("Colle flex");
  await materielInput.blur();
  await page.waitForTimeout(500);
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(
    await section(page, "Matériel").locator("input").first().inputValue(),
    "Colle flex",
    "Le matériel doit être persisté après rechargement"
  );

  // --- Durée et équipe ---
  //
  // La durée se choisit désormais à la molette, ici comme sur l'écran d'envoi :
  // le patron l'y cherchait (« elle a disparu !!!! », le 2026-08-04) et ne la
  // trouvait qu'au bout du parcours. Ce qui est enregistré reste du texte —
  // « 3 jours » — lu par le chiffrage et par la planification.
  const duree = page.getByLabel("Durée du chantier");
  await duree.selectOption({ label: "3 jours" });
  const equipeInput = page.locator("label", { hasText: "Équipe" }).locator("input");
  await equipeInput.fill("2 hommes");
  await equipeInput.blur();
  await page.waitForTimeout(700);
  await page.reload({ waitUntil: "networkidle" });
  // 6 demi-journées = 3 jours : la bande relit le texte enregistré, elle ne
  // garde aucun état à elle.
  assert.equal(await page.getByLabel("Durée du chantier").inputValue(), "6");
  assert.equal(await page.locator("label", { hasText: "Équipe" }).locator("input").inputValue(), "2 hommes");

  // --- Modification d'une prestation ---
  const prestationAModifier = section(page, "Prestations").locator("input").first();
  await prestationAModifier.fill("Dépose carrelage (terminé)");
  await prestationAModifier.blur();

  // **On attend que ce soit ENREGISTRÉ, pas 500 millisecondes.** Le 13 août
  // 2026, ce cas a rougi en pleine batterie — « 'Dépose carrelage' == 'Dépose
  // carrelage (terminé)' » — et fut vert seul l'instant d'après : le délai fixe
  // avait suffi cent fois, et pas la cent-unième, l'action serveur ayant mis
  // plus longtemps sous la charge des cinquante suites. Un contrôle qui échoue
  // au hasard apprend à ignorer le rouge, et l'on perd avec lui la seule suite
  // qui garde la saisie des informations.
  //
  // On recharge jusqu'à trois fois, en laissant à l'enregistrement le temps
  // qu'il lui faut. Le contrôle reste entier : si le libellé n'est jamais
  // enregistré, il rougit toujours — simplement pour la bonne raison.
  let relu = "";
  for (const essai of [1, 2, 3]) {
    await page.waitForTimeout(essai * 500);
    await page.reload({ waitUntil: "networkidle" });
    relu = await section(page, "Prestations").locator("input").first().inputValue();
    if (relu === "Dépose carrelage (terminé)") break;
  }
  assert.equal(relu, "Dépose carrelage (terminé)");

  // --- Suppression avec toast Annuler ---
  // Depuis le 10 août 2026 : « Retirer » découvert par glissement, et un tiroir
  // en bas d'écran qui rattrape. Ce que la suite tient reste le même —
  // l'annulation doit RENDRE la ligne.
  await section(page, "Prestations").getByRole("button", { name: /^Retirer / }).first().click();
  await page.waitForTimeout(500);
  assert.ok(
    await page.locator(".atlas-tiroir[data-ouvert='oui']").first().isVisible(),
    "Le tiroir des retirés ne s'est pas ouvert."
  );
  await page.getByRole("button", { name: /^Annuler le retrait/ }).click();
  await page.waitForTimeout(500);
  const prestationsApresAnnulation = await section(page, "Prestations").locator("input").count();
  assert.equal(prestationsApresAnnulation, 1, "La prestation doit être restaurée après annulation");

  await browser.close();
  console.log("✅ Test bout-en-bout Informations réussi.");
}

main().catch((err) => {
  console.error("❌", err);
  process.exit(1);
});
