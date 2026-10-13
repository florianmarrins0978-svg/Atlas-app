import assert from "node:assert";
import type { Page, BrowserContext } from "playwright";
import { lancerNavigateur } from "./e2e-browser";
import { pool } from "../src/server/db/client";
import { ADRESSE } from "./_adresse";

/**
 * Tout se note, seul ce qui se récupère compte.
 *
 * **Sa demande du 13 octobre 2026 :** *« chaque entrée et chaque sortie doit
 * être notée, mais si c'est une catégorie où il ne récupère pas la TVA, elle
 * ne doit pas être comptabilisée »*. Avant, tout achat entrait en entier au
 * total : un hôtel faisait baisser la TVA à payer. Planche :
 * `appli/tva-ticket-carburant.html`.
 *
 * **Pourquoi une suite navigateur, et pas seulement la règle et le dépôt.**
 * `test-achat-tva.ts` éprouve la règle, `test-achats-tva-repo.ts` ce que la
 * base pose. Ce qui reste, c'est SON geste (`CLAUDE.md` §5 quater) : une puce
 * qu'il touche, un bouton qui s'arme, la ligne qu'il relit, et le « Compléter »
 * du repas noté sans stylo à table. Un composant oublié dans l'écran, et les
 * deux autres suites resteraient vertes.
 *
 * Ce qu'elle garde, dans l'ordre :
 *   1. sans nature, « Ajouter » reste fermé : rien n'est supposé ;
 *   2. un hôtel est noté, « Non récupérable », et le total ne bouge pas ;
 *   3. un repas d'affaires sans preuves est noté, « Pas encore », total
 *      inchangé ;
 *   4. complété depuis la liste, il compte : le total monte de sa TVA.
 */

const BASE = ADRESSE;
const HOTEL = "Hôtel du contrôle non récupérable";
const RESTO = "Restaurant du contrôle non récupérable";

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

async function nettoyer() {
  await pool.query(`DELETE FROM achats_tva WHERE fournisseur = ANY($1)`, [[HOTEL, RESTO]]);
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

/** Le montant « Déductible » de l'addition, en centimes. */
async function deductible(page: Page): Promise<number> {
  const texte = (await page.locator('[data-atlas="montant-deductible"]').last().textContent()) ?? "";
  const valeur = Number(texte.replace("Déductible", "").replace(/[^\d,]/g, "").replace(",", "."));
  assert.ok(Number.isFinite(valeur), `« Déductible » illisible : « ${texte} »`);
  return Math.round(valeur * 100);
}

async function ouvrirTva(page: Page) {
  await page.goto(`${BASE}/termines/tva`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-atlas="montant-reste"]', { timeout: 30_000 });
}

/** Écrire un achat à la main, sans l'ajouter : la feuille reste ouverte. */
async function ecrire(page: Page, fournisseur: string, total: string, taux: string) {
  await page.getByRole("button", { name: "Écrire à la main" }).click();
  await page.waitForSelector("text=À la main", { timeout: 10_000 });
  await page.getByPlaceholder("Station, magasin…").fill(fournisseur);
  await page.getByPlaceholder("0,00 €").fill(total);
  await page.getByPlaceholder("20").fill(taux);
}

async function ligne(page: Page, fournisseur: string) {
  const l = page.locator('[data-atlas="ligne-achat"]').filter({ hasText: fournisseur }).last();
  await l.waitFor({ state: "visible", timeout: 20_000 });
  return l;
}

async function main() {
  await nettoyer();
  const browser = await lancerNavigateur();
  const context = await browser.newContext();
  const page = await seConnecter(context);
  await ouvrirTva(page);
  const avant = await deductible(page);

  await ecrire(page, HOTEL, "89,00", "10");

  await test("Sans dire ce qu'est l'achat, « Ajouter » reste fermé", async () => {
    assert.equal(await page.getByRole("button", { name: "Ajouter aux achats" }).isDisabled(), true);
  });

  await page.getByRole("button", { name: "Hôtel", exact: true }).click();

  await test("L'hôtel s'annonce non récupérable avant l'appui", async () => {
    const texte = (await page.locator('[data-atlas="tva-recuperee"]').textContent()) ?? "";
    assert.ok(texte.includes("Non récupérable"), `la feuille affiche « ${texte} »`);
  });

  await page.getByRole("button", { name: "Ajouter aux achats" }).click();

  await test("L'hôtel est noté, « Non récupérable », et le total ne bouge pas", async () => {
    const l = await ligne(page, HOTEL);
    const texte = (await l.textContent()) ?? "";
    assert.ok(texte.includes("Non récupérable"), `la ligne affiche « ${texte} »`);
    assert.ok(texte.includes("8,09"), `la TVA payée n'est pas dite : « ${texte} »`);
    assert.equal(await deductible(page), avant, "le total déductible a pris l'hôtel");
  });

  // Le repas d'affaires, noté sans stylo à table : « avec qui » seulement.
  await ecrire(page, RESTO, "86,00", "10");
  await page.getByRole("button", { name: "Repas", exact: true }).click();
  await page.locator('[data-atlas="repas-achat"] [data-choix="affaires"]').click();
  await page.locator('[data-atlas="repas-avec-qui"]').fill("M. Durand");

  await test("Il manque des preuves : la feuille le dit avant l'appui", async () => {
    const mot = (await page.locator('[data-atlas="mot-recuperation"]').textContent()) ?? "";
    assert.ok(mot.includes("Il manque pourquoi"), `le mot dit « ${mot} »`);
  });

  await page.getByRole("button", { name: "Ajouter aux achats" }).click();

  await test("Le repas sans preuves est noté, « Pas encore », sans compter", async () => {
    const l = await ligne(page, RESTO);
    const texte = (await l.textContent()) ?? "";
    assert.ok(texte.includes("Pas encore"), `la ligne affiche « ${texte} »`);
    assert.ok(texte.includes("Repas d’affaires avec M. Durand"), `la ligne ne dit pas avec qui : « ${texte} »`);
    assert.equal(await deductible(page), avant, "le repas incomplet a été compté");
  });

  await test("Complété depuis la liste, le repas compte de sa TVA", async () => {
    const l = await ligne(page, RESTO);
    await l.locator('[data-atlas="completer-repas"]').click();
    await page.locator('[data-atlas="repas-pourquoi"]').last().fill("Devis du jardin");
    await page.locator('[data-atlas="repas-justificatif"]').last().check();
    await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
    // 86,00 € à 10 % contiennent 7,82 € de TVA.
    await page.waitForFunction(
      (attendu) => {
        const t = document.querySelector('[data-atlas="montant-deductible"]')?.textContent ?? "";
        return Math.round(Number(t.replace("Déductible", "").replace(/[^\d,]/g, "").replace(",", ".")) * 100) === attendu;
      },
      avant + 782,
      { timeout: 20_000 }
    );
    const texte = (await (await ligne(page, RESTO)).textContent()) ?? "";
    assert.ok(texte.includes("TVA récupérée") && texte.includes("7,82"), `la ligne affiche « ${texte} »`);
  });

  await context.close();
  await browser.close();
  // On ne laisse rien qui fausserait le total des suites suivantes, ni celui
  // de son banc d'essai.
  await nettoyer();

  console.log(`\n${passed} réussis, ${failed} échoués`);
  await pool.end();
  if (failed > 0) process.exit(1);
}

main().catch(async (err) => {
  console.error(err);
  await nettoyer().catch(() => {});
  await pool.end();
  process.exit(1);
});
