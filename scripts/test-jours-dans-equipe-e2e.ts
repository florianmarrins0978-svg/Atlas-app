import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert";
import { Pool } from "pg";
import { ADRESSE } from "./_adresse";

/**
 * JOURS TRAVAILLÉS, PAR SES DEUX PORTES — sa demande du 8 novembre 2026 :
 * *« dans Équipe, sous combien de salariés, j'aimerais avoir ça »*, puis
 * *« tu me fais juste une copie, comme ça j'ai la porte dans mon comptable et
 * dans mon équipe »*. Planche : `appli/soignee/equipe-jours-travailles.html`.
 *
 * **Pourquoi cette suite existe.** Aucune suite navigateur n'ouvrait Jours
 * travaillés : l'écran du 6 novembre n'était regardé par rien. Elle tient ce
 * qu'il a demandé, sur les deux écrans à la fois :
 *
 * - la porte de Pour mon comptable reste, avec l'envoi au comptable ;
 * - Équipe montre le même compte, sans l'envoi, sous « Combien de salariés ? » ;
 * - un salarié retiré dans Équipe disparaît du bloc SANS recharger (les
 *   actions d'Équipe relisent l'écran : sans quoi il verrait l'ancien compte) ;
 * - le mois changé dans Équipe reste dans Équipe ;
 * - un artisan seul n'a pas de bloc.
 *
 * L'entreprise de démonstration est rendue telle qu'elle était.
 */

const BASE = ADRESSE;
// En clair : c'est ainsi que le calcul du niveau sait quelles suites ouvrent ces écrans.
const EQUIPE = "/reglages/equipe";
const JOURS = "/termines/comptable/jours-travailles";
const COMPTABLE = "/termines/comptable";
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

  const avant = await pool.query(`SELECT nombre_salaries FROM entreprises WHERE id = $1`, [entrepriseId]);
  const nomsAvant = await pool.query(`SELECT rang, nom FROM equipes WHERE entreprise_id = $1 AND rang IN (1, 2)`, [entrepriseId]);
  await pool.query(`UPDATE entreprises SET nombre_salaries = 2 WHERE id = $1`, [entrepriseId]);
  for (const [rang, nom] of [
    [1, "Antoine"],
    [2, "Julien"],
  ] as const) {
    await pool.query(
      `INSERT INTO equipes (entreprise_id, rang, nom) VALUES ($1, $2, $3)
       ON CONFLICT (entreprise_id, rang) DO UPDATE SET nom = EXCLUDED.nom`,
      [entrepriseId, rang, nom]
    );
  }

  const browser = await lancerNavigateur();
  try {
    const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await page.fill('input[name="email"]', "demo@atlas.local");
    await page.fill('input[name="password"]', "demo1234");
    await page.click('button[type="submit"]');
    await page.waitForURL(`${BASE}/`, { timeout: 10000 });

    console.log("=== Jours travaillés, dans Pour mon comptable et dans Équipe ===");

    let compteComptable = "";
    await cas("la porte de Pour mon comptable reste, avec l'envoi", async () => {
      await page.goto(`${BASE}${COMPTABLE}`, { waitUntil: "networkidle" });
      assert.ok(await page.locator('[data-atlas="jours-travailles"]').isVisible(), "la ligne Jours travaillés a quitté Pour mon comptable");
      await page.goto(`${BASE}${JOURS}`, { waitUntil: "networkidle" });
      await page.locator('[data-atlas="salarie-1"]').waitFor({ timeout: 15000 });
      compteComptable = (await page.locator('[data-atlas="salarie-1"] [data-atlas="compte"] b').innerText()).trim();
      assert.ok(/^\d/.test(compteComptable), `compte illisible : « ${compteComptable} »`);
      assert.equal(await page.locator('[data-atlas="envoyer-jours"]').count(), 1, "« Envoyer à mon comptable » manque à son écran");
    });

    const bloc = page.locator('[data-atlas="jours-dans-equipe"]');
    await cas("Équipe montre le même compte, sous les salariés, sans l'envoi", async () => {
      await page.goto(`${BASE}${EQUIPE}`, { waitUntil: "networkidle" });
      await bloc.locator('[data-atlas="salarie-1"]').waitFor({ timeout: 15000 });
      const ici = (await bloc.locator('[data-atlas="salarie-1"] [data-atlas="compte"] b').innerText()).trim();
      assert.equal(ici, compteComptable, "les deux portes ne disent pas le même nombre de jours");
      assert.equal(await page.locator('[data-atlas="envoyer-jours"]').count(), 0, "l'envoi au comptable est sorti de son écran");
      // Sous « Combien de salariés ? » : le bloc vient après le dernier nom.
      const sousLesNoms = await page.evaluate(() => {
        const nom = [...document.querySelectorAll('input[aria-label^="Nom du salarié"]')].pop();
        const b = document.querySelector('[data-atlas="jours-dans-equipe"]');
        return !!nom && !!b && !!(nom.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
      });
      assert.ok(sousLesNoms, "le bloc n'est pas sous « Combien de salariés ? »");
    });

    await cas("un salarié retiré dans Équipe quitte le bloc sans recharger", async () => {
      await page.getByLabel("Un salarié de moins").click();
      await bloc.locator('[data-atlas="salarie-2"]').waitFor({ state: "detached", timeout: 15000 });
      assert.equal(await bloc.locator('[data-atlas^="salarie-"]').count(), 1, "le bloc garde un salarié retiré");
      await page.getByLabel("Un salarié de plus").click();
      await bloc.locator('[data-atlas="salarie-2"]').waitFor({ timeout: 15000 });
    });

    await cas("le mois d'avant reste dans Équipe", async () => {
      await bloc.locator('[data-atlas="mois-avant"]').click();
      await page.waitForURL(/\/reglages\/equipe\?mois=\d{4}-\d{2}$/, { timeout: 15000 });
      await bloc.locator('[data-atlas="salarie-1"]').waitFor({ timeout: 15000 });
    });

    await cas("un artisan seul n'a pas de bloc", async () => {
      await pool.query(`UPDATE entreprises SET nombre_salaries = 0 WHERE id = $1`, [entrepriseId]);
      await page.goto(`${BASE}${EQUIPE}`, { waitUntil: "networkidle" });
      await page.locator('input, h2').first().waitFor({ timeout: 15000 });
      assert.equal(await bloc.count(), 0, "un bloc de jours s'affiche sans salarié");
    });
  } finally {
    await browser.close();
    await pool.query(`UPDATE entreprises SET nombre_salaries = $2 WHERE id = $1`, [entrepriseId, avant.rows[0].nombre_salaries]);
    await pool.query(`DELETE FROM equipes WHERE entreprise_id = $1 AND rang IN (1, 2) AND NOT (rang = ANY($2::int[]))`, [
      entrepriseId,
      nomsAvant.rows.map((r) => r.rang),
    ]);
    for (const r of nomsAvant.rows) {
      await pool.query(`UPDATE equipes SET nom = $3 WHERE entreprise_id = $1 AND rang = $2`, [entrepriseId, r.rang, r.nom]);
    }
    await pool.end();
  }

  console.log(`\n${echecs === 0 ? "✅" : "❌"} Jours travaillés par ses deux portes — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error("❌", err);
  await pool.end().catch(() => {});
  process.exit(1);
});
