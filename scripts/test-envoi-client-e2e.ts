import assert from "node:assert";
import type { Page, BrowserContext } from "playwright";
import { lancerNavigateur } from "./e2e-browser";

// L'envoi du devis au client, vu depuis l'écran du patron (docs/AGENT.md §2.2).
//
// C'est le maillon qui rend tout le reste atteignable : sans lui, la page
// publique de réponse — pourtant complète et testée — n'est joignable par
// aucun chemin réel. Cette suite parcourt donc la chaîne entière, du
// formulaire de création jusqu'au lien que le client ouvrira.

const BASE = "http://localhost:3000";

let passed = 0;
let failed = 0;
async function test(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`✅ ${nom}`);
    passed++;
  } catch (err) {
    console.error(`❌ ${nom}`);
    console.error(`   ${err instanceof Error ? err.message : err}`);
    failed++;
  }
}

async function seConnecter(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 15000 });
  return page;
}

/** Crée un chantier chiffré, prêt à être envoyé. Renvoie l'URL de sa fiche. */
async function creerChantierFacturable(
  page: Page,
  suffixe: string,
  client: { nom?: string; telephone?: string; email?: string } = {
    nom: "M. Bernard",
    telephone: "06 12 34 56 78",
  }
) {
  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Rénovation salle de bain"]', `Envoi e2e ${suffixe} ${Date.now()}`);
  if (client.nom) await page.fill('input[placeholder="M. Bernard"]', client.nom);
  if (client.telephone) await page.fill('input[placeholder="06 12 34 56 78"]', client.telephone);
  if (client.email) await page.fill('input[placeholder="bernard@exemple.fr"]', client.email);
  await page.click('button:has-text("Créer le chantier")');
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 10000 });
  const url = page.url();

  // Un devis à zéro euro n'a pas de sens : on lui donne une ligne de prix.
  await page.goto(`${url}/prix`, { waitUntil: "networkidle" });
  await page.click("text=+ Ajouter une ligne");
  await page.waitForTimeout(300);
  const champs = page.locator("form input");
  await champs.nth(0).fill("Main d'œuvre");
  await champs.nth(1).fill("800.00");
  await champs.nth(1).blur();
  await page.waitForTimeout(500);

  return url;
}

async function main() {
  const browser = await lancerNavigateur();
  const context = await browser.newContext({ viewport: { width: 393, height: 852 } });
  const page = await seConnecter(context);

  await test("sans canal convenu, l'envoi est refusé avec la marche à suivre", async () => {
    // Client nommé mais sans aucune coordonnée : le patron n'a rien convenu.
    const url = await creerChantierFacturable(page, "sanscanal", { nom: "M. Sans-Contact" });
    await page.goto(`${url}/export`, { waitUntil: "networkidle" });
    await page.click("text=Envoyer au client");

    await page.waitForSelector("text=Indiquez d'abord comment joindre ce client", { timeout: 10000 });
    // Le bouton ne doit pas rester cliquable : il ne mènerait qu'à un échec.
    assert.strictEqual(
      await page.getByRole("button", { name: "Envoyer le devis" }).isDisabled(),
      true,
      "l'envoi reste proposé alors qu'il est impossible"
    );
    await page.click('button:has-text("Annuler")');
  });

  await test("le canal se déduit de la seule coordonnée renseignée", async () => {
    const url = await creerChantierFacturable(page, "canalmail", {
      nom: "Mme Dupuis",
      email: "dupuis@exemple.fr",
    });
    await page.goto(`${url}/export`, { waitUntil: "networkidle" });
    await page.click("text=Envoyer au client");
    await page.waitForSelector("text=Une date, ou deux au choix du client ?", { timeout: 10000 });

    assert.ok(
      await page.locator("text=Par e-mail au dupuis@exemple.fr").isVisible(),
      "le canal déduit n'est pas celui de la coordonnée saisie"
    );
    await page.click('button:has-text("Annuler")');
  });

  await test("le patron ne propose jamais plus de deux dates", async () => {
    const url = await creerChantierFacturable(page, "deuxmax");
    await page.goto(`${url}/export`, { waitUntil: "networkidle" });
    await page.click("text=Envoyer au client");
    await page.waitForSelector("text=Une date, ou deux au choix du client ?", { timeout: 10000 });

    const jours = page.locator('button[aria-pressed]');
    const total = await jours.count();
    assert.ok(total >= 3, `pas assez de jours libres proposés (${total})`);

    // Le premier est pré-sélectionné : on en ajoute deux de plus.
    await jours.nth(1).click();
    await jours.nth(2).click();

    const selectionnes = await page.locator('button[aria-pressed="true"]').count();
    assert.strictEqual(selectionnes, 2, `${selectionnes} dates retenues au lieu de 2`);
    await page.click('button:has-text("Annuler")');
  });

  await test("l'envoi produit un lien que le client peut ouvrir seul", async () => {
    const url = await creerChantierFacturable(page, "cycle");
    await page.goto(`${url}/export`, { waitUntil: "networkidle" });
    await page.click("text=Envoyer au client");
    await page.waitForSelector("text=Une date, ou deux au choix du client ?", { timeout: 10000 });

    // Deux dates : c'est le cas qui laisse le client choisir.
    await page.locator('button[aria-pressed]').nth(1).click();
    await page.getByRole("button", { name: "Envoyer le devis" }).click();
    await page.waitForSelector("text=Devis prêt pour", { timeout: 15000 });

    const lien = await page.locator("text=/\\/devis\\/[A-Za-z0-9_-]+/").first().innerText();
    const chemin = lien.slice(lien.indexOf("/devis/"));
    assert.ok(chemin.startsWith("/devis/"), `lien inattendu : ${lien}`);

    // Ouvert dans un contexte vierge : c'est bien la situation du client, qui
    // n'a ni session ni cookie de l'application.
    const contexteClient = await browser.newContext({ viewport: { width: 393, height: 852 } });
    const pageClient = await contexteClient.newPage();
    await pageClient.goto(`${BASE}${chemin}`, { waitUntil: "networkidle" });

    assert.ok(
      await pageClient.locator("text=Quelle date vous arrange").isVisible(),
      "la page du client ne présente pas le choix de date"
    );
    assert.strictEqual(
      await pageClient.locator('input[name="choixDate"]').count(),
      3,
      "deux dates proposées et l'option « autre date » devaient être offertes"
    );
    await contexteClient.close();
  });

  await test("le devis envoyé ne peut plus repartir deux fois", async () => {
    const url = await creerChantierFacturable(page, "rejoue");
    await page.goto(`${url}/export`, { waitUntil: "networkidle" });
    await page.click("text=Envoyer au client");
    await page.waitForSelector("text=Une date, ou deux au choix du client ?", { timeout: 10000 });
    await page.getByRole("button", { name: "Envoyer le devis" }).click();
    await page.waitForSelector("text=Devis prêt pour", { timeout: 15000 });

    await page.reload({ waitUntil: "networkidle" });
    assert.strictEqual(
      await page.locator("text=Envoyer au client").count(),
      0,
      "l'envoi est reproposé après rechargement"
    );
  });

  await context.close();
  await browser.close();
  console.log(`\n${passed} réussis, ${failed} échoués`);
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
