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

  // --- Planification : on POSE, et poser dit à la fois quand et qui ---
  //
  // **Le sélecteur de date natif a disparu le 10 août 2026**, et ce contrôle a
  // rougi à juste titre : il verrouillait un geste qui n'existe plus. Le
  // planning est un mois — on choisit le chantier à poser, on touche un jour,
  // puis une demi-journée libre, et le bouton s'arme
  // (`ARCHITECTURE.md` §52).
  await page.locator(`[data-atlas="sans-date"]:has-text("${nomUnique}")`).first().click();
  await page.waitForTimeout(300);

  // Décembre 2026 : on avance jusqu'au mois voulu plutôt que de le supposer
  // affiché — le calendrier s'ouvre sur le mois courant.
  for (let i = 0; i < 24; i++) {
    const titre = await page.locator("[data-atlas='grille-mois']").count();
    if (titre && (await page.locator('[data-atlas="grille-mois"] button[data-jour="2026-12-10"]').count()) > 0) break;
    await page.click('button[aria-label="Mois suivant"]');
    await page.waitForTimeout(150);
  }
  await page.click('[data-atlas="grille-mois"] button[data-jour="2026-12-10"]');
  await page.waitForTimeout(500);
  await page.locator("[data-atlas='creneau'][data-libre='oui']").first().click();
  await page.waitForTimeout(300);
  await page.click("[data-atlas='poser']");
  await page.waitForTimeout(900);

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
    (await carte().innerText()).toLowerCase().includes("déc"),
    `Le mois (décembre) doit figurer sur la ligne de ce chantier : « ${await carte().innerText()} »`
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

  // --- Déplacer un chantier déjà posé ---
  //
  // Le sélecteur de date a disparu avec l'ancien écran ; changer une date se
  // fait désormais avec le MÊME geste que poser — « Déplacer », puis un jour,
  // une demi-journée, et le bouton s'arme.
  await page.getByRole("button", { name: `Déplacer le chantier Chez ${nomUnique}` }).click();
  await page.waitForTimeout(400);
  for (let i = 0; i < 24; i++) {
    if ((await page.locator('[data-atlas="grille-mois"] button[data-jour="2027-01-15"]').count()) > 0) break;
    await page.click('button[aria-label="Mois suivant"]');
    await page.waitForTimeout(150);
  }
  await page.click('[data-atlas="grille-mois"] button[data-jour="2027-01-15"]');
  await page.waitForTimeout(500);
  await page.locator("[data-atlas='creneau'][data-libre='oui']").first().click();
  await page.waitForTimeout(300);
  await page.click("[data-atlas='poser']");
  await page.waitForTimeout(900);
  await page.reload({ waitUntil: "networkidle" });
  assert.ok(
    (await carte().innerText()).toLowerCase().includes("janv"),
    `La nouvelle date (janvier) doit être persistée : « ${await carte().innerText()} »`
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
