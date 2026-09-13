import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { Pool } from "pg";
import { creerPuisFiche } from "./_creer-chantier-e2e";
import { ADRESSE } from "./_adresse";
import { TEXTE_ORIGINE_CONDITIONS_GENERALES } from "../src/lib/conditions-generales";

/**
 * LA PLANCHE B DU DEVIS, PAR SES YEUX — `appli/devis-remise-main-d-oeuvre-conditions.html`,
 * ses réponses du 12 septembre 2026, codées le 13 :
 *
 *   · « + Main d'œuvre » ouvre « dont main d'œuvre HT » sous le total HT, vide ;
 *     le chiffre tapé part en base, borné au brut ; le « − » le retire ;
 *   · la remise s'appelle « Remise de N % » ;
 *   · les Réglages portent ses conditions générales, remplies d'office, avec le
 *     compte des crochets qu'il lui reste à remplir.
 *
 * Le compte de démonstration n'a rien réglé : la suite lit ce qu'il verrait,
 * et remet ce qu'elle a touché.
 */

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const BASE = ADRESSE;
const CAPTURES = process.env.CAPTURES_E2E ?? "/tmp/captures-atlas";

let echecs = 0;
async function cas(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

/** Attend que la base porte cette main d'œuvre (ou `null`) sur le devis du chantier. */
async function quandLaBasePorte(chantierId: string, attendu: string | null): Promise<string | null> {
  let lu: string | null | undefined;
  for (const essai of [0, 1, 2, 3, 4, 5]) {
    if (essai > 0) await new Promise((r) => setTimeout(r, essai * 600));
    const { rows } = await pool.query(
      `SELECT main_doeuvre_ht FROM devis WHERE chantier_id = $1 ORDER BY numero_version DESC LIMIT 1`,
      [chantierId]
    );
    lu = rows[0]?.main_doeuvre_ht ?? null;
    if (lu === attendu) break;
  }
  return lu ?? null;
}

async function main() {
  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext({ viewport: { width: 390, height: 900 } });
  const page = await contexte.newPage();
  mkdirSync(CAPTURES, { recursive: true });

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 20_000 });

  const { rows: demo } = await pool.query(
    `SELECT m.entreprise_id FROM membres_entreprise m JOIN users u ON u.id = m.utilisateur_id WHERE u.email = 'demo@atlas.local' LIMIT 1`
  );
  assert.ok(demo[0]?.entreprise_id, "le compte de démonstration est absent : la base n'est pas amorcée");
  const entrepriseId: string = demo[0].entreprise_id;
  const { rows: avant } = await pool.query(`SELECT conditions_generales FROM entreprises WHERE id = $1`, [entrepriseId]);

  try {
    await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
    await page.fill('input[placeholder="Bernard"]', `Mme Grospiron ${Date.now()}`);
    const url = `${BASE}/chantiers/${await creerPuisFiche(page)}`;
    const chantierId = url.split("/").pop()!;
    await page.waitForLoadState("networkidle");

    await page.goto(`${url}/devis-complet`, { waitUntil: "networkidle" });
    for (const [rang, [libelle, prix]] of [
      ["Terrassement et préparation du sol", "380"],
      ["Fourniture de gazon en rouleau", "780"],
    ].entries()) {
      await page.click('button:has-text("Ajouter une ligne")');
      const zones = page.locator('textarea[aria-label*="escription"]');
      for (const essai of [1, 2, 3, 4, 5]) {
        if ((await zones.count()) > rang) break;
        await page.waitForTimeout(essai * 300);
      }
      await zones.nth(rang).fill(libelle);
      // Un clic AVANT de remplir : le champ replace le curseur au bout et défait
      // le tout-sélectionner de fill() (`ChampsDuDevis.tsx`, « auBout »).
      const champPrix = page.locator('input[aria-label*="Prix unitaire"]').nth(rang);
      await champPrix.click();
      await champPrix.fill(prix);
      await page.keyboard.press("Tab");
      await page.waitForTimeout(400);
    }
    await page.goto(`${url}/devis-complet`, { waitUntil: "networkidle" });

    const totaux = () => page.locator("section").filter({ hasText: "Total TTC" }).last();
    const lisible = (t: string) => t.replace(/[  ]/g, " ");

    await cas("sans main d'œuvre, la ligne n'existe pas ; le bouton « + Main d’œuvre » attend sous les lignes", async () => {
      assert.equal(await page.locator('[data-atlas="montant-main-doeuvre"]').count(), 0);
      assert.equal(await page.locator('[data-atlas="poser-main-doeuvre"]').count(), 1);
    });

    await cas("« + Main d’œuvre » ouvre « dont main d’œuvre HT » sous le total HT, VIDE — le chiffre est à lui", async () => {
      await page.click('[data-atlas="poser-main-doeuvre"]');
      const champ = page.locator('[data-atlas="montant-main-doeuvre"]');
      await champ.waitFor({ timeout: 10_000 });
      assert.equal(await champ.inputValue(), "");
      const texte = lisible(await totaux().innerText());
      assert.match(texte, /Total HT[\s\S]*dont main d’œuvre HT[\s\S]*TVA/);
      assert.equal(await page.locator('[data-atlas="poser-main-doeuvre"]').count(), 0, "le bouton reste alors que la ligne est là");
    });

    await cas("450 tapé part en base à 450,00 — et les totaux n'ont pas bougé", async () => {
      const champ = page.locator('[data-atlas="montant-main-doeuvre"]');
      await champ.fill("450");
      await page.keyboard.press("Tab");
      assert.equal(await quandLaBasePorte(chantierId, "450.00"), "450.00");
      const texte = lisible(await totaux().innerText());
      assert.ok(texte.includes("1 160,00"), `le total HT a bougé :\n${texte}`);
      assert.ok(texte.includes("1 392,00"), `le total TTC a bougé :\n${texte}`);
      await page.screenshot({ path: `${CAPTURES}/planche-b-main-doeuvre.png` });
    });

    await cas("4 500 sur 1 160 de lignes est ramené au brut — à l'écran comme en base", async () => {
      const champ = page.locator('[data-atlas="montant-main-doeuvre"]');
      await champ.fill("4500");
      await page.keyboard.press("Tab");
      assert.equal(await quandLaBasePorte(chantierId, "1160.00"), "1160.00");
      await page.waitForTimeout(300);
      assert.equal(await champ.inputValue(), "1160");
    });

    await cas("le « − » la retire, à l'écran et en base ; le bouton revient", async () => {
      await page.click('[data-atlas="retirer-main-doeuvre"]');
      assert.equal(await quandLaBasePorte(chantierId, null), null);
      await page.waitForTimeout(300);
      assert.equal(await page.locator('[data-atlas="montant-main-doeuvre"]').count(), 0);
      assert.equal(await page.locator('[data-atlas="poser-main-doeuvre"]').count(), 1);
    });

    await cas("la remise se dit « Remise de 5 % » — plus « Prix accordé au client »", async () => {
      await page.getByRole("button", { name: /^\+ Remise$/ }).click();
      await page.locator('input[aria-label="Remise, en pourcentage"]').waitFor({ timeout: 10_000 });
      const texte = lisible(await totaux().innerText());
      assert.match(texte, /Remise de/);
      assert.ok(!texte.includes("Prix accordé"), "l'ancien mot est encore là");
    });

    await cas("Réglages → Ce qui s'imprime : ses conditions générales, remplies d'office, deux crochets à remplir", async () => {
      await page.goto(`${BASE}/reglages/documents/conditions`, { waitUntil: "networkidle" });
      const champ = page.locator('textarea[aria-label="Conditions générales de vente et de règlement"]');
      await champ.waitFor({ timeout: 10_000 });
      assert.equal(await champ.inputValue(), TEXTE_ORIGINE_CONDITIONS_GENERALES);
      assert.match(await page.locator('[data-atlas="crochets-a-remplir"]').innerText(), /2 crochets/);
      await page.screenshot({ path: `${CAPTURES}/planche-b-conditions-generales.png`, fullPage: true });
    });

    await cas("il les réécrit sans crochet : l'avertissement s'éteint, la base porte son texte", async () => {
      const champ = page.locator('textarea[aria-label="Conditions générales de vente et de règlement"]');
      await champ.fill("Mes conditions, en trois lignes.");
      await page.keyboard.press("Tab");
      let lu: string | null = null;
      for (const essai of [0, 1, 2, 3, 4]) {
        if (essai > 0) await page.waitForTimeout(essai * 500);
        const { rows } = await pool.query(`SELECT conditions_generales FROM entreprises WHERE id = $1`, [entrepriseId]);
        lu = rows[0]?.conditions_generales ?? null;
        if (lu === "Mes conditions, en trois lignes.") break;
      }
      assert.equal(lu, "Mes conditions, en trois lignes.");
      assert.equal(await page.locator('[data-atlas="crochets-a-remplir"]').count(), 0);
    });
  } finally {
    await pool.query(`UPDATE entreprises SET conditions_generales = $2 WHERE id = $1`, [entrepriseId, avant[0]?.conditions_generales ?? null]);
    await navigateur.close();
    await pool.end();
  }

  console.log(`\n${echecs === 0 ? "✅" : "❌"} La planche B du devis — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
