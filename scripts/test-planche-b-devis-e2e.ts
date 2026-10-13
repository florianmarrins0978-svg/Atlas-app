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
 *   · « + Main d'œuvre », dans chaque TVA, pose une ligne qui s'ADDITIONNE ;
 *     « dont main d'œuvre HT » en est la somme (sa réponse A du 13 octobre 2026) ;
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
  const { rows: avant } = await pool.query(
    `SELECT conditions_generales, assureur_decennale, mediateur_nom FROM entreprises WHERE id = $1`,
    [entrepriseId]
  );

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
      const zones = page.locator('textarea[aria-label*="escription"]');
      // La feuille s'ouvre déjà avec sa PREMIÈRE ligne (20 septembre 2026) :
      // on n'ajoute que celles qui manquent.
      if ((await zones.count()) <= rang) await page.click('button:has-text("Ajouter une ligne")');
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

    // ── LA A DU 13 OCTOBRE 2026 : la main d'œuvre s'additionne, dans chaque TVA.
    const lignesDeMainDoeuvre = async () =>
      (
        await pool.query(
          `SELECT montant, taux_tva FROM lignes_prix WHERE chantier_id = $1 AND main_doeuvre ORDER BY ordre`,
          [chantierId]
        )
      ).rows as { montant: string; taux_tva: string | null }[];

    await cas("sans main d'œuvre, pas de « dont » ; « + Main d’œuvre » attend à côté de « + Ajouter une ligne »", async () => {
      const texte = lisible(await totaux().innerText());
      assert.ok(!texte.includes("dont main d’œuvre HT"), `une ligne « dont » sans main d'œuvre :\n${texte}`);
      assert.equal(await page.locator('[data-atlas="poser-main-doeuvre"]').count(), 1);
    });

    await cas("« + Main d’œuvre » pose une ligne « Main d’œuvre », le doigt dans son montant, vide", async () => {
      await page.click('[data-atlas="poser-main-doeuvre"]');
      const champ = page.locator('input[aria-label*="Montant de la main d’œuvre"]');
      await champ.waitFor({ timeout: 10_000 });
      assert.equal(await champ.inputValue(), "", "un montant posé d'office");
      const actif = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? "");
      assert.match(actif, /Montant de la main d’œuvre/, `le doigt n'est pas dans le montant : ${actif}`);
      const zones = page.locator('textarea[aria-label*="escription"]');
      assert.equal(await zones.nth((await zones.count()) - 1).inputValue(), "Main d’œuvre");
    });

    await cas("500 tapé s'ADDITIONNE : total HT 1 660, TTC 1 992, et « dont main d’œuvre HT » sous le total", async () => {
      const champ = page.locator('input[aria-label*="Montant de la main d’œuvre"]');
      await champ.fill("500");
      await page.keyboard.press("Tab");
      const texte = lisible(await totaux().innerText());
      assert.ok(texte.includes("1 660,00"), `le total HT n'a pas pris la main d'œuvre :\n${texte}`);
      assert.ok(texte.includes("1 992,00"), `le total TTC n'a pas pris la main d'œuvre :\n${texte}`);
      assert.match(texte, /Total HT[\s\S]*dont main d’œuvre HT[\s\S]*TVA/);
      for (const essai of [0, 1, 2, 3, 4, 5]) {
        if ((await lignesDeMainDoeuvre()).some((l) => l.montant === "500.00")) break;
        await page.waitForTimeout(400 * (essai + 1));
      }
      assert.deepEqual(await lignesDeMainDoeuvre(), [{ montant: "500.00", taux_tva: null }]);
      await page.screenshot({ path: `${CAPTURES}/main-doeuvre-qui-s-additionne.png` });
    });

    await cas("au rechargement, la ligne et « dont » sont là, et le devis en base porte 500", async () => {
      await page.goto(`${url}/devis-complet`, { waitUntil: "networkidle" });
      const texte = lisible(await totaux().innerText());
      assert.ok(texte.includes("1 660,00"), `le total HT a perdu la main d'œuvre :\n${texte}`);
      assert.match(texte, /dont main d’œuvre HT/);
      assert.equal(await quandLaBasePorte(chantierId, "500.00"), "500.00");
    });

    await cas("dans la TVA à 10 %, sa main d'œuvre naît à 10 % et compte à la TVA de 10 %", async () => {
      await page.getByRole("button", { name: /Ajouter une TVA/ }).click();
      const boutons = page.locator('[data-atlas="poser-main-doeuvre"]');
      for (const essai of [1, 2, 3, 4, 5]) {
        if ((await boutons.count()) > 1) break;
        await page.waitForTimeout(essai * 300);
      }
      await boutons.nth(1).click();
      const champs = page.locator('input[aria-label*="Montant de la main d’œuvre"]');
      for (const essai of [1, 2, 3, 4, 5]) {
        if ((await champs.count()) > 1) break;
        await page.waitForTimeout(essai * 300);
      }
      await champs.nth(1).fill("500");
      await page.keyboard.press("Tab");
      for (const essai of [0, 1, 2, 3, 4, 5]) {
        if ((await lignesDeMainDoeuvre()).length === 2 && (await lignesDeMainDoeuvre())[1].montant === "500.00") break;
        await page.waitForTimeout(400 * (essai + 1));
      }
      assert.deepEqual(await lignesDeMainDoeuvre(), [
        { montant: "500.00", taux_tva: null },
        { montant: "500.00", taux_tva: "10.00" },
      ]);
      const texte = lisible(await totaux().innerText());
      assert.ok(texte.includes("2 160,00"), `le total HT n'a pas pris la seconde main d'œuvre :\n${texte}`);
      assert.match(texte, /TVA \(10 %\)\s*50,00/, `la TVA à 10 % ne porte pas sa main d'œuvre :\n${texte}`);
      // Le montant de « dont » vit dans un champ figé : innerText ne le lit pas.
      assert.equal(await page.locator('[data-atlas="montant-main-doeuvre"]').inputValue(), "1000", "« dont » n'est pas la somme");
      await page.screenshot({ path: `${CAPTURES}/main-doeuvre-dans-chaque-tva.png`, fullPage: true });
    });

    await cas("la remise se dit « Remise de 5 % » — plus « Prix accordé au client »", async () => {
      await page.getByRole("button", { name: /^\+ Remise$/ }).click();
      await page.locator('input[aria-label="Remise, en pourcentage"]').waitFor({ timeout: 10_000 });
      const texte = lisible(await totaux().innerText());
      assert.match(texte, /Remise de/);
      assert.ok(!texte.includes("Prix accordé"), "l'ancien mot est encore là");
    });

    await cas("Réglages → Ce qui s'imprime : ses conditions générales, remplies d'office, le crochet du médiateur à remplir", async () => {
      // **Un compte qui n'a encore rien saisi** : la démonstration porte un
      // assureur et un médiateur depuis le 3 octobre 2026 (un devis sans eux ne
      // part plus), et leurs crochets se remplissent alors tout seuls. Le cas
      // éprouvé ici est celui d'avant la saisie ; ils sont rendus à la fin.
      await pool.query(`UPDATE entreprises SET assureur_decennale = NULL, mediateur_nom = NULL WHERE id = $1`, [entrepriseId]);
      await page.goto(`${BASE}/reglages/documents/conditions`, { waitUntil: "networkidle" });
      const champ = page.locator('textarea[aria-label="Conditions générales de vente et de règlement"]');
      await champ.waitFor({ timeout: 10_000 });
      assert.equal(await champ.inputValue(), TEXTE_ORIGINE_CONDITIONS_GENERALES);
      // **Un seul crochet depuis le 5 octobre 2026**, sa règle : *« la décennale
      // ne doit pas apparaître comme étant incomplète tant qu'elle n'est pas
      // enregistrée »*. Sans assureur, l'article 9 perd sa moitié décennale ;
      // seul le médiateur, obligatoire pour tout particulier, reste à remplir.
      assert.match(await page.locator('[data-atlas="crochets-a-remplir"]').innerText(), /1 crochet à remplir/);
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
    await pool.query(
      `UPDATE entreprises SET conditions_generales = $2, assureur_decennale = $3, mediateur_nom = $4 WHERE id = $1`,
      [entrepriseId, avant[0]?.conditions_generales ?? null, avant[0]?.assureur_decennale ?? null, avant[0]?.mediateur_nom ?? null]
    );
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
