import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert";
import { Pool } from "pg";
import { ADRESSE } from "./_adresse";

/**
 * MON ANNÉE, PARCOURUE COMME IL LA PARCOURT — sa planche du 8 novembre 2026
 * (`appli/soignee/mon-annee.html`) et son « tu peux coder ça ».
 *
 * **Pourquoi cette suite existe.** La batterie commune du 8 novembre a rendu
 * l'écran vert partout sauf là où personne ne le regardait : aucune suite
 * navigateur n'ouvrait `/reglages/mon-annee`. Les règles pures étaient
 * éprouvées (`test-mon-annee.ts`), jamais le chemin qu'il prend, lui : fixer
 * l'objectif, allumer l'interrupteur, retrouver la ligne sur Terminés, et lire
 * l'avertissement de la franchise s'il y est.
 *
 * **Sa règle, tenue ici à l'écran et en base :** *« il ne faut pas que ça
 * s'affiche de base sur la page Terminés »*. La ligne n'y est pas tant qu'il
 * ne l'a pas allumée, et repart quand il l'éteint.
 *
 * L'état de l'entreprise de démonstration est relevé avant et rendu après : les
 * suites de Terminés qui suivent ne doivent pas trouver une ligne qu'elles
 * n'attendent pas.
 */

const BASE = ADRESSE;
// En clair : c'est ainsi que le calcul du niveau sait quelle suite ouvre cet écran.
const ECRAN = "/reglages/mon-annee";
const TERMINES = "/termines";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

let echecs = 0;
async function cas(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

async function main() {
  const { rows } = await pool.query(
    `SELECT m.entreprise_id FROM membres_entreprise m JOIN users u ON u.id = m.utilisateur_id WHERE u.email = 'demo@atlas.local' LIMIT 1`
  );
  const entrepriseId = rows[0]?.entreprise_id as string | undefined;
  assert.ok(entrepriseId, "le compte de démonstration est absent : la base n'est pas amorcée");
  const annee = new Date().getFullYear();

  const avant = await pool.query(`SELECT regime_tva, mon_annee_sur_termines FROM entreprises WHERE id = $1`, [entrepriseId]);
  const objectifAvant = await pool.query(`SELECT * FROM objectifs_annee WHERE entreprise_id = $1 AND annee = $2`, [entrepriseId, annee]);
  // On part d'un artisan qui n'a jamais ouvert l'écran : ni objectif, ni ligne.
  await pool.query(`DELETE FROM objectifs_annee WHERE entreprise_id = $1 AND annee = $2`, [entrepriseId, annee]);
  await pool.query(`UPDATE entreprises SET mon_annee_sur_termines = false, regime_tva = 'assujettie' WHERE id = $1`, [entrepriseId]);

  const browser = await lancerNavigateur();
  try {
    const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await page.fill('input[name="email"]', "demo@atlas.local");
    await page.fill('input[name="password"]', "demo1234");
    await page.click('button[type="submit"]');
    await page.waitForURL(`${BASE}/`, { timeout: 10000 });

    console.log("=== Mon année, du premier objectif à la ligne de Terminés ===");

    await cas("sans objectif, l'écran le dit et propose de le fixer", async () => {
      await page.goto(`${BASE}${ECRAN}`, { waitUntil: "networkidle" });
      await page.locator('[data-atlas="mon-annee-sans-objectif"]').waitFor({ timeout: 15000 });
      assert.ok(await page.locator('[data-atlas="fixer-objectif"]').isVisible(), "« Fixer mon objectif » manque");
      assert.equal(await page.locator('[data-atlas="mon-annee-sur-termines"]').getAttribute("aria-checked"), "false", "l'interrupteur doit partir éteint");
    });

    await cas("éteint par défaut : Terminés ne montre pas la ligne", async () => {
      await page.goto(`${BASE}${TERMINES}`, { waitUntil: "networkidle" });
      assert.equal(await page.locator('[data-atlas="ligne-mon-annee"]').count(), 0, "la ligne s'affiche sans qu'il l'ait demandée");
    });

    await cas("l'objectif tapé se garde, s'écrit en base et se lit à l'écran", async () => {
      await page.goto(`${BASE}${ECRAN}`, { waitUntil: "networkidle" });
      await page.locator('[data-atlas="fixer-objectif"]').click();
      const feuille = page.locator('[data-atlas="feuille-objectif"]');
      await feuille.waitFor();
      const champ = feuille.locator("input").first();
      await champ.fill("300000");
      assert.match(await champ.inputValue(), /^300\s000$/, "les espaces se posent pendant qu'on tape");
      assert.equal(await page.locator('[data-atlas="objectif-passe-la-franchise"]').count(), 0, "un assujetti ne reçoit pas l'avertissement de la franchise");
      await page.locator('[data-atlas="garder-objectif"]').click();
      const chiffre = page.locator('[data-atlas="mon-annee-chiffre"]');
      await chiffre.waitFor({ timeout: 15000 });
      assert.match(await chiffre.innerText(), /sur 300\s000\s€/, "l'objectif ne se lit pas à l'écran");
      const ecrit = await pool.query(`SELECT chiffre_affaires_ht::text AS ca FROM objectifs_annee WHERE entreprise_id = $1 AND annee = $2`, [entrepriseId, annee]);
      assert.equal(ecrit.rows[0]?.ca, "300000.00", "l'objectif n'est pas écrit en base");
    });

    await cas("allumé, la ligne paraît sur Terminés et ramène à Mon année", async () => {
      const inter = page.locator('[data-atlas="mon-annee-sur-termines"]');
      await inter.click();
      await page.waitForFunction(
        () => document.querySelector('[data-atlas="mon-annee-sur-termines"]')?.getAttribute("aria-checked") === "true"
      );
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(800);
      const base = await pool.query(`SELECT mon_annee_sur_termines AS oui FROM entreprises WHERE id = $1`, [entrepriseId]);
      assert.equal(base.rows[0].oui, true, "l'interrupteur ne s'est pas écrit en base");
      await page.goto(`${BASE}${TERMINES}`, { waitUntil: "networkidle" });
      const ligne = page.locator('[data-atlas="ligne-mon-annee"]');
      await ligne.waitFor({ timeout: 15000 });
      assert.match(await ligne.innerText(), /sur 300\s000\s€/, "la ligne ne porte pas l'objectif");
      await ligne.click();
      await page.waitForURL(`${BASE}${ECRAN}`, { timeout: 10000 });
    });

    await cas("en franchise, un objectif au-dessus du plafond se signale, et l'avertissement suit la saisie", async () => {
      await pool.query(`UPDATE entreprises SET regime_tva = 'franchise' WHERE id = $1`, [entrepriseId]);
      await page.goto(`${BASE}${ECRAN}`, { waitUntil: "networkidle" });
      await page.locator('[data-atlas="modifier-objectif"]').click();
      const feuille = page.locator('[data-atlas="feuille-objectif"]');
      await feuille.waitFor();
      const avertissement = page.locator('[data-atlas="objectif-passe-la-franchise"]');
      await avertissement.waitFor({ timeout: 5000 });
      assert.match(await avertissement.innerText(), /franchise de TVA/);
      await feuille.locator("input").first().fill("30000");
      await page.waitForTimeout(300);
      assert.equal(await avertissement.count(), 0, "sous le plafond, l'avertissement doit partir");
    });

    await cas("éteint de nouveau, la ligne repart de Terminés", async () => {
      await page.goto(`${BASE}${ECRAN}`, { waitUntil: "networkidle" });
      await page.locator('[data-atlas="mon-annee-sur-termines"]').click();
      await page.waitForFunction(
        () => document.querySelector('[data-atlas="mon-annee-sur-termines"]')?.getAttribute("aria-checked") === "false"
      );
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(800);
      await page.goto(`${BASE}${TERMINES}`, { waitUntil: "networkidle" });
      assert.equal(await page.locator('[data-atlas="ligne-mon-annee"]').count(), 0, "la ligne reste après l'avoir éteinte");
    });
  } finally {
    await browser.close();
    await pool.query(`DELETE FROM objectifs_annee WHERE entreprise_id = $1 AND annee = $2`, [entrepriseId, annee]);
    for (const o of objectifAvant.rows) {
      await pool.query(
        `INSERT INTO objectifs_annee (entreprise_id, annee, chiffre_affaires_ht, benefice) VALUES ($1, $2, $3, $4)`,
        [o.entreprise_id, o.annee, o.chiffre_affaires_ht, o.benefice]
      );
    }
    await pool.query(`UPDATE entreprises SET regime_tva = $2, mon_annee_sur_termines = $3 WHERE id = $1`, [
      entrepriseId,
      avant.rows[0].regime_tva,
      avant.rows[0].mon_annee_sur_termines,
    ]);
    await pool.end();
  }

  console.log(`\n${echecs === 0 ? "✅" : "❌"} Mon année au navigateur — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error("❌", err);
  await pool.end().catch(() => {});
  process.exit(1);
});
