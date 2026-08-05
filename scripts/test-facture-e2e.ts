import assert from "node:assert";
import type { Page, BrowserContext } from "playwright";
import { lancerNavigateur } from "./e2e-browser";
import { pool } from "../src/server/db/client";

// Fin de chantier, facture et relevé de TVA, vus depuis l'écran du patron
// (docs/AGENT.md §2.3). L'arrêt 3 est ici : rien ne part sans un appui.

const BASE = "http://localhost:3000";

/**
 * Requête d'inspection, hors application.
 *
 * Les tables sont cloisonnées par RLS et ces requêtes n'ont pas de contexte
 * d'entreprise : elles ne fonctionnent que parce que les suites e2e tournent
 * sous un rôle qui traverse RLS (voir .github/workflows/ci.yml). Si ce n'était
 * plus le cas, elles ne renverraient rien — silencieusement. D'où le contrôle
 * explicite ci-dessous : mieux vaut un test qui accuse son propre montage
 * qu'un test qui accuse le code.
 */
async function inspecter(sql: string, params: unknown[], attendu?: number) {
  const r = await pool.query(sql, params);
  if (attendu !== undefined && r.rowCount !== attendu) {
    throw new Error(
      `Inspection hors application : ${r.rowCount} ligne(s) au lieu de ${attendu}. ` +
        "Le rôle de test ne traverse probablement plus RLS."
    );
  }
  return r;
}

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

/**
 * Un chantier réalisé : devis envoyé au client, puis daté dans le passé.
 *
 * La planification passe par la base plutôt que par l'écran : l'application ne
 * permet — délibérément — de proposer que des dates à venir, alors qu'un
 * chantier à facturer est par nature derrière soi.
 */
async function chantierRealise(page: Page, suffixe: string) {
  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  // Le chantier n'a plus de nom saisi : il prend celui de son client
  // (« Chez … », voir `src/lib/nom-chantier.ts`). C'est donc le client qui
  // porte la marque unique, et le repère suit.
  const client = `M. Bernard ${suffixe} ${Date.now()}`;
  const nom = `Chez ${client}`;
  await page.fill('input[placeholder="M. Bernard"]', client);
  await page.fill('input[placeholder="06 12 34 56 78"]', "06 12 34 56 78");
  await page.click('button:has-text("Créer le chantier")');
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 10000 });
  const url = page.url();
  const chantierId = url.split("/").pop()!;

  await page.goto(`${url}/prix`, { waitUntil: "networkidle" });
  await page.click("text=+ Ajouter une ligne");
  await page.waitForTimeout(300);
  const champs = page.locator("form input");
  await champs.nth(0).fill("Main d'œuvre");
  await champs.nth(1).fill("1000.00");
  await champs.nth(1).blur();
  await page.waitForTimeout(500);

  await page.goto(`${url}/export`, { waitUntil: "networkidle" });
  await page.click("text=Envoyer au client");
  await page.waitForSelector("text=Une date, ou deux au choix du client ?", { timeout: 10000 });
  await page.getByRole("button", { name: "Envoyer le devis" }).click();
  await page.waitForSelector("text=Devis prêt pour", { timeout: 15000 });

  await inspecter("UPDATE chantiers SET date_planifiee = CURRENT_DATE - 3 WHERE id = $1", [chantierId], 1);

  return { chantierId, nom, url };
}

async function main() {
  const browser = await lancerNavigateur();
  const context = await browser.newContext({ viewport: { width: 393, height: 852 } });
  const page = await seConnecter(context);

  await test("le chantier réalisé apparaît dans l'onglet Terminés", async () => {
    const { nom } = await chantierRealise(page, "onglet");
    await page.goto(`${BASE}/termines`, { waitUntil: "networkidle" });

    assert.ok(await page.locator(`text=${nom}`).first().isVisible(), "le chantier n'apparaît pas");
    assert.ok(
      await page.locator("text=Fin de chantier").first().isVisible(),
      "le bouton de clôture est absent"
    );
  });

  await test("ouvrir l'écran facture ne crée aucune facture", async () => {
    const { chantierId } = await chantierRealise(page, "regard");
    await page.goto(`${BASE}/chantiers/${chantierId}/facture`, { waitUntil: "networkidle" });

    // Consulter n'est pas clôturer : la facture naît de l'appui, pas du regard.
    const { rows } = await inspecter(
      "SELECT count(*)::int AS n FROM factures WHERE chantier_id = $1",
      [chantierId],
      1
    );
    assert.strictEqual(rows[0].n, 0, "une facture a été créée par simple consultation");
    assert.ok(await page.locator("text=Le chantier est réalisé ?").isVisible());
  });

  await test("« Fin de chantier » prépare la facture sans l'émettre", async () => {
    const { chantierId } = await chantierRealise(page, "preparer");
    await page.goto(`${BASE}/chantiers/${chantierId}/facture`, { waitUntil: "networkidle" });
    await page.click("text=Fin de chantier");
    await page.waitForSelector("text=Rien n'a changé depuis le devis ?", { timeout: 15000 });

    assert.ok(
      await page.locator("text=/1\\s?200,00\\s?€/").isVisible(),
      "le total du devis n'est pas repris (1 200,00 €)"
    );

    const { rows } = await inspecter("SELECT statut FROM factures WHERE chantier_id = $1", [chantierId], 1);
    assert.strictEqual(rows[0].statut, "brouillon", "la facture est partie sans confirmation");
  });

  await test("la confirmation fige la facture et la porte au relevé de TVA", async () => {
    const { chantierId } = await chantierRealise(page, "emettre");
    await page.goto(`${BASE}/chantiers/${chantierId}/facture`, { waitUntil: "networkidle" });
    await page.click("text=Fin de chantier");
    await page.waitForSelector("text=Rien n'a changé depuis le devis ?", { timeout: 15000 });
    await page.click("text=Confirmer le départ de la facture");
    await page.waitForSelector("text=Elle figure au relevé de TVA collectée", { timeout: 15000 });

    const { rows } = await inspecter(
      "SELECT statut, total_tva, numero_commercial FROM factures WHERE chantier_id = $1",
      [chantierId],
      1
    );
    assert.strictEqual(rows[0].statut, "emise");
    assert.strictEqual(rows[0].total_tva, "200.00");

    // Le relevé n'est pas une table : il se recalcule à chaque affichage, et
    // doit donc porter cette facture sans qu'aucune écriture ne l'y ait mise.
    await page.goto(`${BASE}/termines/tva`, { waitUntil: "networkidle" });
    assert.ok(
      await page.locator(`text=${rows[0].numero_commercial}`).isVisible(),
      "la facture émise ne figure pas au relevé"
    );
    assert.ok(
      await page.locator("text=Ce relevé est préparé par Atlas").isVisible(),
      "la réserve sur la valeur du relevé n'est pas affichée"
    );
  });

  await test("une facture émise ne peut plus repartir", async () => {
    const { chantierId } = await chantierRealise(page, "rejeu");
    await page.goto(`${BASE}/chantiers/${chantierId}/facture`, { waitUntil: "networkidle" });
    await page.click("text=Fin de chantier");
    await page.waitForSelector("text=Rien n'a changé depuis le devis ?", { timeout: 15000 });
    await page.click("text=Confirmer le départ de la facture");
    await page.waitForSelector("text=Elle figure au relevé de TVA collectée", { timeout: 15000 });

    await page.reload({ waitUntil: "networkidle" });
    assert.strictEqual(
      await page.locator("text=Confirmer le départ de la facture").count(),
      0,
      "la facture peut être émise une seconde fois"
    );
  });

  await context.close();
  await browser.close();
  console.log(`\n${passed} réussis, ${failed} échoués`);
  await pool.end();
  if (failed > 0) process.exit(1);
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
