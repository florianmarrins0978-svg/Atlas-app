import { chromium, devices } from "playwright";
import { mkdirSync } from "fs";
import { Pool } from "pg";
import { creerPuisFiche } from "./_creer-chantier-e2e";

const OUT = "artifacts/screenshots/step-25-planning-reel";
mkdirSync(OUT, { recursive: true });
const pool = new Pool({ connectionString: "postgresql://atlas_owner:atlas_owner_dev_pw@127.0.0.1:5432/atlas_dev" });

async function main() {
  const browser = await chromium.launch({
    executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  });
  const context = await browser.newContext({ ...devices["iPhone 13"], });
  const page = await context.newPage();

  await page.goto("http://localhost:3000/chantiers/nouveau", { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Bernard"]', `Chantier capture planning ${Date.now()}`);
  await creerPuisFiche(page);
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/);
  const chantierId = page.url().split("/").pop()!;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(`SELECT id FROM entreprises ORDER BY created_at ASC LIMIT 1`);
    await client.query(`SELECT set_config('app.entreprise_id', $1, true)`, [rows[0].id]);
    await client.query(`UPDATE chantiers SET devis_envoye_at = now() WHERE id = $1`, [chantierId]);
    await client.query("COMMIT");
  } finally {
    client.release();
  }

  await page.goto("http://localhost:3000/planning", { waitUntil: "networkidle" });
  await page.screenshot({ path: `${OUT}/01-a-planifier.png`, fullPage: true });

  await page.click("text=Choisir une date");
  await page.waitForSelector('input[type="date"]');
  await page.screenshot({ path: `${OUT}/02-sheet-date.png`, fullPage: true });
  await page.fill('input[type="date"]', "2026-12-10");
  await page.click("text=Confirmer la planification");
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/03-planifie.png`, fullPage: true });

  await browser.close();
  await pool.end();
  console.log("captured 3 états");
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
