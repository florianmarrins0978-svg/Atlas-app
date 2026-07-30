import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert";
import { Pool } from "pg";

// DATABASE_URL, jamais une base codée en dur : la suite doit viser la même base
// que le serveur qu'elle pilote (atlas_dev en local, atlas_test en CI).
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  // Assure un tarif "Élagage" pour l'entreprise démo, sans dupliquer si déjà présent.
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

  const browser = await lancerNavigateur();
  const context = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3 });
  const page = await context.newPage();

  // Connexion réelle (Auth.js) — toutes les routes applicatives sont
  // désormais protégées par le middleware d'authentification.
  await page.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL("http://localhost:3000/", { timeout: 10000 });

  const nomUnique = `Chantier devis IA e2e ${Date.now()}`;
  await page.goto("http://localhost:3000/chantiers/nouveau", { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Rénovation salle de bain"]', nomUnique);
  await page.click('button:has-text("Créer le chantier")');
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 5000 });
  const chantierUrl = page.url();

  // --- Ouvre la sidebar, fournit une demande client (texte libre) ---
  await page.goto(chantierUrl, { waitUntil: "networkidle" });
  await page.click('button[aria-label="Ouvrir l\'assistant"]');
  await page.waitForSelector("text=Assistant");
  await page.fill(
    'input[placeholder="Votre question…"]',
    "Mme Dupont souhaite un devis pour l'élagage d'un sapin. Prépare le devis pour ce chantier."
  );
  await page.click('button[aria-label="Envoyer"]');
  await page.waitForSelector("text=Appliquer les modifications", { timeout: 10000 });

  // --- Aucune donnée modifiée avant confirmation (vérifiée directement en base,
  // sans navigation, car la sidebar ne persiste pas sa conversation d'une page à
  // l'autre — comportement voulu, voir IA-02) ---
  const chantierId = chantierUrl.split("/").pop()!;
  const avantConfirmation = await pool.query(`SELECT count(*) FROM lignes_prix WHERE chantier_id = $1`, [chantierId]);
  assert.equal(Number(avantConfirmation.rows[0].count), 0, "Aucune ligne de prix ne doit exister avant confirmation");

  const caseLignePrix = page.locator("label", { hasText: "Ajouter une ligne de prix" }).locator('input[type="checkbox"]');
  if ((await caseLignePrix.count()) > 0) {
    await caseLignePrix.uncheck();
  }

  // --- Confirme l'application (dans la même session de sidebar) ---
  await page.click("text=Appliquer les modifications");
  await page.waitForSelector("text=/— Appliqué/", { timeout: 10000 });

  // --- Vérifie sur l'écran Prix : aucune ligne de prix (décochée) ---
  await page.goto(`${chantierUrl}/prix`, { waitUntil: "networkidle" });
  assert.ok(
    await page.locator("text=Aucune ligne pour l'instant.").isVisible(),
    "La ligne décochée ne doit jamais être appliquée"
  );

  // --- Vérifie sur l'écran Informations : la prestation a bien été ajoutée ---
  await page.goto(`${chantierUrl}/informations`, { waitUntil: "networkidle" });
  const nbPrestations = await page.locator("form input").count();
  assert.ok(nbPrestations > 0, "La prestation cochée doit avoir été ajoutée");

  // --- Persistance après rechargement ---
  await page.reload({ waitUntil: "networkidle" });
  const nbPrestationsApresReload = await page.locator("form input").count();
  assert.equal(nbPrestationsApresReload, nbPrestations);

  // --- Vérifie que le devis n'a pas été envoyé ni facturé ---
  await page.goto(`${chantierUrl}/export`, { waitUntil: "networkidle" });
  assert.ok(
    await page.locator("text=Envoyer vers le système de devis").isVisible(),
    "Le devis ne doit jamais être envoyé automatiquement"
  );

  await browser.close();
  await pool.end();
  console.log("✅ Test bout-en-bout Préparation de devis (IA-04) réussi.");
}

main().catch(async (err) => {
  console.error("❌", err);
  await pool.end();
  process.exit(1);
});
