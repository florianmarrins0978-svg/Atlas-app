import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert";
import { Pool } from "pg";

// DATABASE_URL, jamais une base codée en dur : la suite doit viser la même base
// que le serveur qu'elle pilote (atlas_dev en local, atlas_test en CI).
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
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

  const nomUnique = `Chantier planning e2e ${Date.now()}`;
  await page.goto("http://localhost:3000/chantiers/nouveau", { waitUntil: "networkidle" });
  await page.fill('input[placeholder="M. Bernard"]', nomUnique);
  await page.click('button:has-text("Créer le chantier")');
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 5000 });
  const chantierId = page.url().split("/").pop()!;

  // Un chantier neuf n'a pas de devis envoyé : force l'éligibilité directement
  // en base pour ce test (équivalent à un devis réellement envoyé). Nécessite
  // le contexte RLS de l'entreprise du chantier (FORCE RLS s'applique même au
  // rôle propriétaire).
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows: entRows } = await client.query(`SELECT id FROM entreprises ORDER BY created_at ASC LIMIT 1`);
    const entrepriseId = entRows[0].id;
    await client.query(`SELECT set_config('app.entreprise_id', $1, true)`, [entrepriseId]);
    await client.query(`UPDATE chantiers SET devis_envoye_at = now() WHERE id = $1`, [chantierId]);
    await client.query("COMMIT");
  } finally {
    client.release();
  }

  // --- Le chantier apparaît en "À planifier" ---
  await page.goto("http://localhost:3000/planning", { waitUntil: "networkidle" });
  assert.ok(
    await page.locator(`text=${nomUnique}`).first().isVisible(),
    "Le chantier doit apparaître en 'À planifier'"
  );

  // --- Planification (création d'une intervention) ---
  await page.locator(`text=${nomUnique}`).first().click();
  await page.waitForSelector('input[type="date"]', { timeout: 5000 });
  await page.fill('input[type="date"]', "2026-12-10");
  await page.click("text=Confirmer la planification");
  await page.waitForTimeout(500);
  assert.ok(!(await page.locator("text=Aucun chantier planifié").isVisible()));

  // --- Persistance après rechargement ---
  await page.reload({ waitUntil: "networkidle" });
  assert.ok(
    await page.locator(`text=${nomUnique}`).first().isVisible(),
    "Le chantier planifié doit réapparaître après rechargement"
  );
  // **La vignette de CE chantier, pas la première de l'écran.** Viser
  // « text=DÉC » globalement rendait la suite non rejouable : au deuxième
  // passage sur la même base, deux chantiers de décembre coexistent et le
  // contrôle échoue sur son propre passé, en accusant le code.
  const carte = () => page.locator(`a[href="/chantiers/${chantierId}"]`);
  assert.ok(
    (await carte().locator("text=déc.").count()) > 0,
    "Le mois (décembre) doit être affiché sur la vignette de date de ce chantier"
  );

  // --- La carte planifiée mène au chantier, pas au sélecteur de date ---
  //
  // **Changé le 8 août 2026, et ce contrôle a rougi à juste titre.** Il
  // verrouillait l'ancien comportement : toucher un chantier planifié n'ouvrait
  // qu'un sélecteur de date. Le patron : « il se range dans les chantiers
  // planifiés, mais comment moi je fais pour avoir accès au devis ? » — la
  // réponse était : on ne peut pas. La carte mène désormais au chantier, et la
  // date se change par un lien à part.
  await carte().click();
  // Le tiroir du bas est le repère d'arrivée sur une fiche : « Autres étapes »
  // ne s'écrit plus depuis que les étapes y sont rangées (`ARCHITECTURE.md` §49).
  await page.waitForSelector("[data-atlas='tiroir-fiche']", { timeout: 10000 });
  assert.ok(
    page.url().endsWith(`/chantiers/${chantierId}`),
    `la carte planifiée mène à ${page.url()} au lieu de la fiche du chantier`
  );

  // Et la clôture est à portée depuis le planning, sans passer par la fiche.
  await page.goto("http://localhost:3000/planning", { waitUntil: "networkidle" });
  assert.equal(
    await page.locator(`a[href="/chantiers/${chantierId}/facture"]`).count(),
    1,
    "« Fin de chantier » manque sur la carte du chantier planifié"
  );

  // --- Modification de la date, par son propre lien ---
  await page.getByRole("button", { name: `Changer la date du chantier Chez ${nomUnique}` }).click();
  await page.waitForSelector('input[type="date"]', { timeout: 5000 });
  const valeurActuelle = await page.locator('input[type="date"]').inputValue();
  assert.equal(valeurActuelle, "2026-12-10", "La sheet doit préremplir la date déjà enregistrée");
  await page.fill('input[type="date"]', "2027-01-15");
  await page.click("text=Confirmer la planification");
  await page.waitForTimeout(500);
  await page.reload({ waitUntil: "networkidle" });
  assert.ok(
    (await carte().locator("text=janv.").count()) > 0,
    "La nouvelle date (janvier) doit être persistée sur la carte de ce chantier"
  );

  await browser.close();
  await pool.end();
  console.log("✅ Test bout-en-bout Planning réussi.");
}

main().catch(async (err) => {
  console.error("❌", err);
  await pool.end();
  process.exit(1);
});
