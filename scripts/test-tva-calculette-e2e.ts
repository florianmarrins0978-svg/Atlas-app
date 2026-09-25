import assert from "node:assert";
import type { Page, BrowserContext } from "playwright";
import { lancerNavigateur } from "./e2e-browser";
import { pool } from "../src/server/db/client";
import { periodeCourante } from "../src/server/periode-tva";
import { ADRESSE } from "./_adresse";

/**
 * Ma TVA, à la calculette : le MOT ouvre la page, le CHIFFRE copie.
 *
 * **Sa planche du 25 septembre 2026** (`appli/tva-collectee-a-la-calculette.html`)
 * et sa retouche du même jour : *« la page doit s'ouvrir seulement si je clique
 * sur le mot TVA déductible et collectée ; si on clique sur les chiffres à côté,
 * ça doit copier comme ça le fait déjà »*.
 *
 * **Ce que cette suite garde, par le chemin qu'il emprunte, lui** (`CLAUDE.md`
 * §5 quater) :
 *
 *   1. un appui sur le chiffre copie, et l'on reste sur Ma TVA ;
 *   2. un appui sur le mot ouvre la page, sur la MÊME période ;
 *   3. le total de TVA de la page est le chiffre de Ma TVA, au centime ;
 *   4. un achat sans montant ni taux s'y lit « non noté », jamais zéro.
 */

const BASE = ADRESSE;
const FOURNISSEUR = "Location du contrôle calculette";

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

/** Le chiffre d'une rangée de Ma TVA, tel qu'il s'affiche : « 60,00 € ». */
async function chiffreDe(page: Page, marque: string): Promise<string> {
  const texte = (await page.locator(`[data-atlas="${marque}"] button`).first().textContent()) ?? "";
  const m = texte.match(/[\d\s  ]+,\d{2}\s?€/);
  assert.ok(m, `« ${marque} » ne porte aucun montant lisible : « ${texte} »`);
  return m[0].replace(/[\s  ]/g, "");
}

async function main() {
  // Le mois, posé et non supposé : une autre suite déplace ce réglage.
  await pool.query(`UPDATE entreprises SET periodicite_tva = 'mensuelle'`);
  await pool.query(`DELETE FROM achats_tva WHERE fournisseur = $1`, [FOURNISSEUR]);
  const courante = periodeCourante("mensuelle");
  // Un achat écrit à la main, sans son total ni son taux : 60 € de TVA seule.
  await pool.query(
    `INSERT INTO achats_tva (entreprise_id, date_achat, fournisseur, total_ttc, taux_tva, tva_deductible, saisie)
     SELECT id, $1::date, $2, NULL, NULL, 60, 'main' FROM entreprises WHERE nom = 'Atelier Démo'`,
    [courante.debut, FOURNISSEUR]
  );

  const browser = await lancerNavigateur();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE });
  const page = await seConnecter(context);
  const maTva = `${BASE}/termines/tva?annee=${courante.annee}&t=${courante.numero}`;

  await page.goto(maTva, { waitUntil: "networkidle" });
  const deductible = await chiffreDe(page, "montant-deductible");
  const collectee = await chiffreDe(page, "montant-collectee");

  await test("un appui sur le chiffre le copie, et l'on reste sur Ma TVA", async () => {
    await page.locator('[data-atlas="montant-deductible"] button').click();
    await page.locator('[data-atlas="montant-deductible-ouvrir"]', { hasText: "copié" }).waitFor({ timeout: 5_000 });
    assert.equal(new URL(page.url()).pathname, "/termines/tva");
    const copie = (await page.evaluate(() => navigator.clipboard.readText())).replace(/[\s  ]/g, "");
    assert.equal(copie, deductible);
  });

  await test("un appui sur le mot « TVA déductible » ouvre sa page, sur la même période", async () => {
    await page.waitForTimeout(1_800); // le mot redevient « TVA déductible »
    await page.locator('[data-atlas="montant-deductible-ouvrir"]').click();
    await page.waitForURL(/\/termines\/tva\/deductible\?/, { timeout: 30_000 });
    const u = new URL(page.url());
    assert.equal(u.searchParams.get("annee"), String(courante.annee));
    assert.equal(u.searchParams.get("t"), String(courante.numero));
  });

  await test("le total de TVA déductible de la page est celui de Ma TVA", async () => {
    const total = page.locator('[data-atlas="total-calculette"]');
    await total.waitFor({ timeout: 30_000 });
    const texte = ((await total.textContent()) ?? "").replace(/[\s  ]/g, "");
    assert.ok(texte.includes(deductible), `le total de la page (« ${texte} ») ne porte pas ${deductible}`);
  });

  await test("l'achat sans montant ni taux se lit « non noté », deux fois", async () => {
    const ligne = page.locator('[data-atlas="ligne-calculette"]', { hasText: FOURNISSEUR });
    await ligne.waitFor({ timeout: 10_000 });
    const texte = (await ligne.textContent()) ?? "";
    assert.equal(texte.match(/non noté/g)?.length, 2, `la ligne dit : « ${texte} »`);
  });

  await test("un appui sur le mot « TVA collectée » ouvre sa page, au même total", async () => {
    await page.goto(maTva, { waitUntil: "networkidle" });
    await page.locator('[data-atlas="montant-collectee-ouvrir"]').click();
    await page.waitForURL(/\/termines\/tva\/collectee\?/, { timeout: 30_000 });
    await page.waitForLoadState("networkidle");
    const total = page.locator('[data-atlas="total-calculette"]');
    if ((await total.count()) === 0) {
      // Un mois sans règlement n'a pas de tableau : Ma TVA doit alors dire zéro.
      assert.equal(collectee, "0,00€", `la page est vide mais Ma TVA annonce ${collectee}`);
      return;
    }
    const texte = ((await total.textContent()) ?? "").replace(/[\s  ]/g, "");
    assert.ok(texte.includes(collectee), `le total de la page (« ${texte} ») ne porte pas ${collectee}`);
  });

  await context.close();
  await browser.close();
  await pool.query(`DELETE FROM achats_tva WHERE fournisseur = $1`, [FOURNISSEUR]);

  console.log(`\n${passed} réussis, ${failed} échoués`);
  await pool.end();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
