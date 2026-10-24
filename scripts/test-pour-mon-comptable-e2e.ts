import assert from "node:assert";
import type { BrowserContext, Page } from "playwright";
import { lancerNavigateur } from "./e2e-browser";
import { pool } from "../src/server/db/client";
import { ADRESSE } from "./_adresse";

/**
 * POUR MON COMPTABLE, LOT 2 — le parcours du patron, du doigt jusqu'à la ligne.
 *
 * Ses choix des 23 et 24 octobre 2026 sur `appli/pour-mon-comptable.html`.
 * Les suites base éprouvent les règles et le dépôt
 * (`test-pour-mon-comptable.ts`, `test-pour-mon-comptable-db.ts`) ; celle-ci
 * traverse les écrans, là où vivent les raccords :
 *
 *   1. Terminés porte la carte, et son compte est CELUI du dossier ;
 *   2. le Check up relie le ticket qui tombe juste, et dit ce qu'il a fait ;
 *   3. « Ticket perdu » prévient AVANT de valider que la TVA ne se déduit pas ;
 *   4. un virement se justifie par sa nature ;
 *   5. le relevé du mois montre chaque ligne avec sa pièce, la plus récente
 *      en haut, et le filtre « Sans ticket » ne garde que ce qui manque.
 *
 * **Les dates partent d'aujourd'hui**, jamais d'un jour figé : le dossier en
 * cours est l'année courante, et une date écrite en dur sortirait du dossier
 * le 1ᵉʳ janvier suivant, rendant cette suite verte sans rien éprouver.
 */

const BASE = ADRESSE;
const MARQUE = "E2E-COMPTABLE";

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
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });
  return page;
}

const jour = (decalage: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + decalage);
  return d.toISOString().slice(0, 10);
};

async function sansTicket(page: Page): Promise<number> {
  await page.goto(`${BASE}/termines`, { waitUntil: "networkidle" });
  const texte = (await page.locator('[data-atlas="carte-comptable"]').textContent()) ?? "";
  if (/Tout est justifié/.test(texte)) return 0;
  const m = /(\d+) sans ticket/.exec(texte);
  assert.ok(m, `la carte du dossier est illisible : « ${texte} »`);
  return Number(m[1]);
}

async function main() {
  const { rows } = await pool.query(
    `SELECT m.entreprise_id AS entreprise FROM membres_entreprise m JOIN users u ON u.id = m.utilisateur_id WHERE u.email = 'demo@atlas.local' LIMIT 1`
  );
  assert.ok(rows[0], "le compte de démonstration est absent : la base n'est pas amorcée");
  const { entreprise } = rows[0] as { entreprise: string };

  await pool.query(`DELETE FROM mouvements_bancaires WHERE entreprise_id = $1 AND cle LIKE $2`, [entreprise, `${MARQUE}%`]);
  await pool.query(`DELETE FROM achats_tva WHERE entreprise_id = $1 AND fournisseur LIKE $2`, [entreprise, `${MARQUE}%`]);

  const aujourdhui = jour(0);
  const mouvement = (cle: string, j: string, montant: string, libelle: string) =>
    pool.query(
      `INSERT INTO mouvements_bancaires (entreprise_id, cle, jour, montant, sens, libelle) VALUES ($1, $2, $3, $4, 'sortie', $5)`,
      [entreprise, `${MARQUE}-${cle}`, j, montant, libelle]
    );
  await mouvement("PLEIN", aujourdhui, "67.89", "CB STATION E2E");
  await mouvement("PERDU", aujourdhui, "12.34", "CB BOULANGERIE E2E");
  await mouvement("URSSAF", aujourdhui, "456.78", "PRLV URSSAF E2E");
  await pool.query(
    `INSERT INTO achats_tva (entreprise_id, date_achat, fournisseur, total_ttc, taux_tva, tva_deductible, saisie, nature, vehicule) VALUES ($1, $2, $3, 67.89, 20, 11.31, 'main', 'carburant', 'utilitaire')`,
    [entreprise, jour(-1), `${MARQUE} station`]
  );

  const browser = await lancerNavigateur();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await seConnecter(context);

  let avant = 0;
  await test("Terminés porte la carte « Pour mon comptable »", async () => {
    avant = await sansTicket(page);
    assert.ok(avant >= 3, `la carte annonce ${avant} sans ticket, il en faut au moins trois`);
  });

  await test("la carte mène au dossier, qui montre les lignes à regarder", async () => {
    await page.click('[data-atlas="carte-comptable"]');
    await page.waitForURL(`${BASE}/termines/comptable`, { timeout: 30_000 });
    await page.waitForSelector('[data-atlas="check-up"]');
    assert.equal(await page.locator('[data-atlas="ligne-a-regarder"]', { hasText: "12,34" }).count(), 1);
  });

  await test("le Check up relie le ticket qui tombe juste, et dit ce qu'il a fait", async () => {
    await page.click('[data-atlas="check-up"]');
    const bilan = await page.locator('[data-atlas="bilan-check-up"]').textContent({ timeout: 30_000 });
    assert.match(bilan ?? "", /reliée?s?/);
    await page.waitForFunction(
      () => ![...document.querySelectorAll('[data-atlas="ligne-a-regarder"]')].some((e) => e.textContent?.includes("67,89")),
      null,
      { timeout: 30_000 }
    );
  });

  await test("« Ticket perdu » prévient avant de valider, puis la ligne quitte la liste", async () => {
    const carte = page.locator('[data-atlas="ligne-a-regarder"]', { hasText: "12,34" });
    await carte.locator('[data-atlas="ticket-perdu"]').click();
    assert.match((await carte.textContent()) ?? "", /Sa TVA ne sera pas déduite/);
    await carte.locator('[data-atlas="valider-ticket-perdu"]').click();
    await page.waitForFunction(
      () => ![...document.querySelectorAll('[data-atlas="ligne-a-regarder"]')].some((e) => e.textContent?.includes("12,34")),
      null,
      { timeout: 30_000 }
    );
  });

  await test("un prélèvement se justifie par sa nature", async () => {
    const carte = page.locator('[data-atlas="ligne-a-regarder"]', { hasText: "456,78" });
    await carte.locator('[data-atlas="autre-chose"]').click();
    await carte.locator('[data-atlas="choix-motif"]', { hasText: "Impôts, cotisations" }).click();
    await page.waitForFunction(
      () => ![...document.querySelectorAll('[data-atlas="ligne-a-regarder"]')].some((e) => e.textContent?.includes("456,78")),
      null,
      { timeout: 30_000 }
    );
  });

  await test("Terminés dit désormais trois de moins, comme le dossier", async () => {
    assert.equal(await sansTicket(page), avant - 3);
  });

  await test("le relevé du mois montre chaque pièce, la plus récente en haut", async () => {
    await page.goto(`${BASE}/termines/comptable/${aujourdhui.slice(0, 7)}`, { waitUntil: "networkidle" });
    const texte = (await page.locator('[data-atlas="releve"]').textContent()) ?? "";
    assert.match(texte, /CB STATION E2E[\s\S]*Ticket du [\s\S]*relié par Atlas/);
    assert.match(texte, /CB BOULANGERIE E2E[\s\S]*Ticket perdu, mention validée/);
    assert.match(texte, /PRLV URSSAF E2E[\s\S]*Impôts, cotisations/);
    const jours = await page.locator('[data-atlas="releve"] li > p').allTextContents();
    assert.ok(jours.length > 0, "aucun jour affiché : le relevé ne mesure rien");
  });

  await test("le filtre « Sans ticket » ne garde que ce qui manque", async () => {
    // Une ligne À ELLE qui manque : sans elle, la suite dépendait des restes
    // d'autres suites, et une base fraîche affichait « Rien ne manque. ».
    await mouvement("MANQUE", aujourdhui, "9.99", "CB SANS PIECE E2E");
    await page.reload({ waitUntil: "networkidle" });
    await page.click('[data-atlas="filtre-sans-ticket"]');
    // La LISTE, et elle seule : le texte de toute la page porte aussi les
    // données que Next.js range au bas du document, où les lignes filtrées
    // figurent encore sans être affichées.
    const texte = (await page.locator('[data-atlas="releve"]').innerText()) ?? "";
    assert.match(texte, /CB SANS PIECE E2E/);
    assert.doesNotMatch(texte, /CB STATION E2E/);
    assert.doesNotMatch(texte, /CB BOULANGERIE E2E/);
  });

  await test("une période illisible et un ticket inconnu ne s'ouvrent pas", async () => {
    // Le statut ne dit rien ici : l'écran de chargement a déjà répondu 200
    // quand la page refuse. On regarde donc ce qui est AFFICHÉ.
    await page.goto(`${BASE}/termines/comptable/2026-13`, { waitUntil: "networkidle" });
    assert.equal(await page.locator('[data-atlas="releve"]').count(), 0);
    assert.match(await page.locator("body").innerText(), /404|could not be found|introuvable/i);
    const t = await page.request.get(`${BASE}/termines/comptable/ticket/00000000-0000-0000-0000-000000000000`);
    assert.equal(t.status(), 404);
  });

  await pool.query(`DELETE FROM mouvements_bancaires WHERE entreprise_id = $1 AND cle LIKE $2`, [entreprise, `${MARQUE}%`]);
  await pool.query(`DELETE FROM achats_tva WHERE entreprise_id = $1 AND fournisseur LIKE $2`, [entreprise, `${MARQUE}%`]);
  await browser.close();
  await pool.end();
  console.log(`\n${passed} réussi(s), ${failed} échoué(s)`);
  if (failed > 0) process.exit(1);
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
