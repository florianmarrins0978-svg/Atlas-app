import assert from "node:assert";
import { mkdirSync } from "node:fs";
import { lancerNavigateur } from "./e2e-browser";

// Le parcours du patron sur l'écran « Catalogue », arrangement B (17 août 2026).
//
// **Pourquoi une suite navigateur EN PLUS de la suite base.** La suite base
// (`test-mots-catalogue.ts`) prouve l'isolation, les refus et la recherche —
// tout ce qui ne se voit pas. Elle ne prouve rien de ce qu'il a réellement
// signalé : *« On peut rien modifier rajouter »*. Ce qu'il faut éprouver ici,
// c'est le GESTE : ouvrir l'écran depuis les réglages, poser un mot, le
// retrouver après rechargement, et repartir par la flèche.
//
// **La flèche de retour est un cas à elle seule.** Elle manquait depuis le
// 14 août, sortie d'une de ses captures et d'aucun test. Rien ne l'aurait
// rattrapée : la page compilait, l'écran s'affichait, et il ne pouvait pas
// revenir.
//
// **Il sait échouer** : retirer `retour` de l'en-tête rend le cas de la flèche
// rouge ; ignorer le mot ajouté dans le rendu rend le cas de la persistance
// rouge, en disant ce qu'il attendait et ce qu'il a vu.

const RACINE = "http://localhost:3000";
const CAPTURES = process.env.CAPTURES_E2E ?? "/tmp/captures-atlas";

async function main() {
  const browser = await lancerNavigateur();
  const context = await browser.newContext({ deviceScaleFactor: 3 });
  const page = await context.newPage();

  await page.goto(`${RACINE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${RACINE}/`, { timeout: 10000 });

  // Son chemin, pas une adresse tapée : on y arrive par « Tarifs & catalogue ».
  await page.goto(`${RACINE}/reglages/tarifs`, { waitUntil: "networkidle" });
  await page.getByRole("link", { name: /Le catalogue/ }).click();
  await page.getByRole("heading", { name: "Catalogue" }).waitFor({ timeout: 15000 });

  // --- 1. Le mot du jargon a disparu de l'écran -----------------------------
  const texte = await page.locator("body").innerText();
  assert.ok(
    !/Synonymes|Variantes/.test(texte),
    "« Synonymes » et « Variantes » disaient la même chose : l'écran n'en garde qu'un, « Aussi appelé »."
  );
  assert.ok(
    !/prix encore constat/i.test(texte),
    "« Aucun prix encore constaté » lisait une mémoire jamais écrite : cette phrase ne devait jamais revenir."
  );

  // --- 2. Poser un mot, et le retrouver après rechargement -------------------
  const mot = `motessai${Date.now()}`;
  await page.getByRole("button", { name: "+ mon mot" }).first().click();
  await page.locator('input[placeholder*="Comme vous le dites"]').first().fill(mot);
  await page.getByRole("button", { name: "Ajouter" }).first().click();

  await page.getByText(mot, { exact: false }).first().waitFor({ timeout: 15000 });
  mkdirSync(CAPTURES, { recursive: true });
  await page.screenshot({ path: `${CAPTURES}/catalogue-mes-mots.png` });

  await page.reload({ waitUntil: "networkidle" });
  const apres = await page.locator("body").innerText();
  assert.ok(
    apres.includes(mot),
    `Le mot « ${mot} » a disparu au rechargement : il n'a pas été enregistré.`
  );
  assert.ok(
    /· vous/.test(apres),
    "Ses mots doivent être marqués « vous » : sans la marque, il croit corriger le vocabulaire commun."
  );

  // --- 3. Le retirer ---------------------------------------------------------
  await page.getByRole("button", { name: `Retirer le mot « ${mot} »` }).click();
  await page.waitForFunction(
    (m) => !document.body.innerText.includes(m as string),
    mot,
    { timeout: 15000 }
  );
  await page.reload({ waitUntil: "networkidle" });
  assert.ok(
    !(await page.locator("body").innerText()).includes(mot),
    `Le mot « ${mot} » est revenu au rechargement : le retrait n'a pas pris.`
  );

  // --- 4. La flèche de retour, le défaut du 14 août --------------------------
  const retour = page.getByRole("link", { name: "Retour aux tarifs" });
  assert.equal(
    await retour.count(),
    1,
    "Aucune flèche de retour sur le catalogue : on y arrive depuis « Tarifs & catalogue » et on n'en repartait que par la barre du bas."
  );
  await retour.click();
  await page.getByRole("heading", { name: "Tarifs & catalogue" }).waitFor({ timeout: 15000 });

  console.log("✅ Catalogue — ses mots se posent, se relisent, se retirent, et la flèche ramène.");
  await browser.close();
}

main().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
