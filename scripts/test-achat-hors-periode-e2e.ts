import assert from "node:assert";
import type { Page, BrowserContext } from "playwright";
import { lancerNavigateur } from "./e2e-browser";
import { pool } from "../src/server/db/client";
import { libellePeriode, periodeCourante, periodePrecedente } from "../src/server/periode-tva";

/**
 * Un ticket daté d'un autre mois ne doit jamais disparaître en silence.
 *
 * **Le défaut, tel qu'il s'est produit — 13 août 2026.** Le patron photographie
 * un ticket de gazole du **24 juillet** (97,39 € TTC, 16,23 € de TVA) depuis
 * l'écran d'**août**, l'ajoute, et écrit : *« il n'est jamais apparu dans la
 * TVA déductible »*. L'achat était pourtant bien enregistré — dans juillet,
 * exactement là où il devait aller. Simplement, l'écran ne montre qu'UNE
 * période, la liste comme le total : rien, nulle part, ne lui disait que son
 * geste avait porté ailleurs.
 *
 * **Pourquoi aucun contrôle ne l'a vu.** Les suites base éprouvent le dépôt
 * (`test-achats-tva-repo.ts` : un achat rendu entre deux bornes, jamais
 * au-delà) et les règles pures (`test-periode-tva.ts`). Toutes vertes, toutes
 * justes — elles regardaient chacune leur moitié. Le défaut vivait dans le
 * raccord : l'écran écrivait dans une période et en affichait une autre.
 * C'est le genre de trou qu'un contrôle ne comble qu'en traversant le parcours
 * entier, du doigt jusqu'au chiffre.
 *
 * **Ce que cette suite garde, dans cet ordre :**
 *
 *   1. l'écran ANNONCE la destination avant qu'on appuie — un ticket du mois
 *      dernier n'est pas une faute, mais il ne doit pas partir à l'aveugle ;
 *   2. après l'ajout, l'écran EMMÈNE le patron là où l'achat a atterri ;
 *   3. l'achat y est bien, et le total déductible de cette période l'a pris.
 *
 * Les trois comptent ensemble. Enregistrer juste et laisser le patron devant
 * un total inchangé, c'est ce qui vient de coûter un aller-retour.
 *
 * La date est calculée à partir d'aujourd'hui — jamais figée au 24 juillet 2026,
 * qui cesserait d'être « le mois dernier » dès septembre et rendrait ce contrôle
 * vert sans rien éprouver.
 */

const BASE = "http://localhost:3000";
/** Ce que le patron a réellement payé, à l'euro près, sur son ticket LAFON. */
const FOURNISSEUR = "Station du contrôle hors période";
const TOTAL_TTC = "97,39";
const TVA_ATTENDUE = "16,23";

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

/** Le montant d'une des deux colonnes, en centimes, tel que l'écran l'affiche. */
async function colonne(page: Page, libelle: "Collectée" | "Déductible"): Promise<number> {
  const texte = (await page.locator(`div:has(> span:text-is("${libelle}"))`).last().textContent()) ?? "";
  const chiffres = texte.replace(libelle, "").replace(/[^\d,]/g, "").replace(",", ".");
  const valeur = Number(chiffres);
  assert.ok(Number.isFinite(valeur), `« ${libelle} » illisible : « ${texte} »`);
  return Math.round(valeur * 100);
}

async function main() {
  // **Le mois, et pas le trimestre.** Au trimestre, le 24 juillet et le 13 août
  // tombent dans la MÊME période : le défaut ne se produirait pas, et cette
  // suite serait verte sans avoir rien traversé. Une autre suite déplace ce
  // réglage (`test-periodicite-tva-e2e.ts`) — on ne suppose donc pas son état,
  // on le pose.
  await pool.query(`UPDATE entreprises SET periodicite_tva = 'mensuelle'`);
  await pool.query(`DELETE FROM achats_tva WHERE fournisseur = $1`, [FOURNISSEUR]);

  const courante = periodeCourante("mensuelle");
  const precedente = periodePrecedente(courante);
  // Le 24 du mois précédent : un jour qui existe dans les douze mois, y compris
  // en février d'une année non bissextile.
  const jourDuTicket = `${precedente.debut.slice(0, 8)}24`;

  const browser = await lancerNavigateur();
  const context = await browser.newContext();
  const page = await seConnecter(context);

  await page.goto(`${BASE}/termines/tva`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("text=Reste à payer", { timeout: 30_000 });

  const titreDepart = (await page.locator("h1").first().textContent())?.trim() ?? "";
  assert.equal(
    titreDepart,
    libellePeriode(courante),
    `le départ devait être la période en cours, l'écran affiche « ${titreDepart} »`
  );

  await page.getByRole("button", { name: "Écrire à la main" }).click();
  await page.waitForSelector("text=À la main", { timeout: 10_000 });
  await page.getByPlaceholder("Station, magasin…").fill(FOURNISSEUR);
  await page.locator('input[type="date"]').fill(jourDuTicket);
  await page.getByPlaceholder("0,00 €").fill(TOTAL_TTC);

  await test("La TVA se calcule depuis le total, sans qu'il ait à la poser", async () => {
    // 97,39 € à 20 % contiennent 16,23 € de TVA — le chiffre imprimé sur son
    // ticket. Le piège du TTC (`src/lib/achat-tva.ts`) est éprouvé à part ; ici,
    // on vérifie qu'il arrive jusqu'au champ.
    const lu = await page.getByPlaceholder("calculée").inputValue();
    assert.equal(lu, TVA_ATTENDUE, `le champ TVA affiche « ${lu} »`);
  });

  await test("Avant d'appuyer, l'écran dit dans quelle période le ticket va tomber", async () => {
    const avertissement = page.locator(`text=il ira dans`);
    await avertissement.first().waitFor({ state: "visible", timeout: 10_000 });
    const texte = (await avertissement.first().textContent()) ?? "";
    assert.ok(
      texte.includes(libellePeriode(precedente)),
      `l'avertissement ne nomme pas « ${libellePeriode(precedente)} » : ${texte}`
    );
    assert.ok(
      texte.includes(libellePeriode(courante)),
      `l'avertissement ne dit pas de quelle période il SORT : ${texte}`
    );
  });

  await page.getByRole("button", { name: "Ajouter aux achats" }).click();

  await test("Après l'ajout, l'écran emmène le patron là où l'achat a atterri", async () => {
    // Une navigation, pas un message à lire puis à suivre : ce qui a coûté
    // l'aller-retour, c'est justement d'avoir laissé le patron devant l'écran
    // qu'il regardait déjà.
    await page.waitForFunction(
      (attendu) => document.querySelector("h1")?.textContent?.trim() === attendu,
      libellePeriode(precedente),
      { timeout: 20_000 }
    );
  });

  await test("L'achat est dans la liste de cette période, avec sa TVA", async () => {
    // Le nom du fournisseur vit deux `<span>` sous la ligne : on remonte à
    // celle-ci pour lire aussi le montant, qui est son voisin.
    const ligne = page
      .locator(`span:text-is("${FOURNISSEUR}")`)
      .last()
      .locator("xpath=ancestor::div[1]");
    await ligne.waitFor({ state: "visible", timeout: 20_000 });
    const texte = (await ligne.textContent()) ?? "";
    assert.ok(texte.includes(TVA_ATTENDUE), `la ligne n'affiche pas ${TVA_ATTENDUE} € : ${texte}`);
  });

  await test("Le total déductible de cette période a bien pris le ticket", async () => {
    const deductible = await colonne(page, "Déductible");
    assert.ok(
      deductible >= 1623,
      `la colonne « Déductible » affiche ${(deductible / 100).toFixed(2)} € : le ticket n'y est pas`
    );
  });

  await test("Et le mois d'où il vient ne le compte pas deux fois", async () => {
    // La contrepartie du contrôle précédent : un achat rangé dans juillet ne
    // doit pas ressortir en août. Sans elle, un dépôt qui rendrait TOUS les
    // achats, quelles que soient les bornes, passerait pour réparé.
    await page.goto(`${BASE}/termines/tva?annee=${courante.annee}&t=${courante.numero}`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForSelector("text=Reste à payer", { timeout: 30_000 });
    assert.equal(
      await page.locator(`span:text-is("${FOURNISSEUR}")`).count(),
      0,
      `l'achat du mois dernier apparaît aussi dans ${libellePeriode(courante)}`
    );
  });

  await context.close();
  await browser.close();

  // On ne laisse pas derrière soi un achat qui fausserait la TVA déductible des
  // suites suivantes — ni du banc d'essai du patron.
  await pool.query(`DELETE FROM achats_tva WHERE fournisseur = $1`, [FOURNISSEUR]);

  console.log(`\n${passed} réussis, ${failed} échoués`);
  await pool.end();
  if (failed > 0) process.exit(1);
}

main().catch(async (err) => {
  console.error(err);
  await pool.query(`DELETE FROM achats_tva WHERE fournisseur = $1`, [FOURNISSEUR]).catch(() => {});
  await pool.end();
  process.exit(1);
});
