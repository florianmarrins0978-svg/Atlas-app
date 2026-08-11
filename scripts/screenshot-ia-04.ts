import { chromium, devices } from "playwright";
import { mkdirSync } from "fs";
import { Pool } from "pg";

const OUT = "artifacts/screenshots/step-30-ia-04";
mkdirSync(OUT, { recursive: true });
const pool = new Pool({ connectionString: "postgresql://atlas_owner:atlas_owner_dev_pw@127.0.0.1:5432/atlas_dev" });

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(`SELECT id FROM entreprises ORDER BY created_at ASC LIMIT 1`);
    const entrepriseId = rows[0].id;
    await client.query(`SELECT set_config('app.entreprise_id', $1, true)`, [entrepriseId]);
    const existant = await client.query(`SELECT id FROM tarifs WHERE entreprise_id = $1 AND intitule = 'Élagage'`, [
      entrepriseId,
    ]);
    if (existant.rows.length === 0) {
      await client.query(`INSERT INTO tarifs (entreprise_id, intitule, prix) VALUES ($1, 'Élagage', '450.00')`, [
        entrepriseId,
      ]);
    }
    await client.query("COMMIT");
  } finally {
    client.release();
  }

  const browser = await chromium.launch({
    executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  });
  const context = await browser.newContext({ ...devices["iPhone 13"], });
  const page = await context.newPage();

  await page.goto("http://localhost:3000/chantiers/nouveau", { waitUntil: "networkidle" });
  await page.fill('input[placeholder="M. Bernard"]', `Chantier capture devis IA ${Date.now()}`);
  await page.click('button:has-text("Créer le chantier")');
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/);
  const chantierUrl = page.url();

  await page.goto(chantierUrl, { waitUntil: "networkidle" });
  await page.click('button[aria-label="Ouvrir l\'assistant"]');
  await page.waitForSelector("text=Assistant");
  await page.fill(
    'input[placeholder="Votre question…"]',
    "Mme Dupont souhaite un devis pour l'élagage d'un sapin. Prépare le devis pour ce chantier."
  );
  await page.click('button[aria-label="Envoyer"]');
  await page.waitForSelector("text=Appliquer les modifications", { timeout: 10000 });
  await page.screenshot({ path: `${OUT}/01-sidebar-proposition-devis.png`, fullPage: true });

  await page.click("text=Appliquer les modifications");
  await page.waitForSelector("text=/— Appliqué/", { timeout: 10000 });
  await page.screenshot({ path: `${OUT}/02-sidebar-applique.png`, fullPage: true });

  await page.goto(`${chantierUrl}/export`, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${OUT}/03-ecran-devis.png`, fullPage: true });

  await browser.close();
  await pool.end();
  console.log("captured 3 états");
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
