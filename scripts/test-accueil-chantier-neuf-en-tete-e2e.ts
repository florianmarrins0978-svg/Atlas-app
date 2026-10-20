import assert from "node:assert/strict";
import { devices } from "playwright";
import { lancerNavigateur } from "./e2e-browser";
import { pool } from "../src/server/db/client";
import { ADRESSE } from "./_adresse";

// **Le chantier qu'il vient de créer est EN TÊTE du fil, contrats compris.**
//
// ─────────────────────────────────────────────────────────────────────────────
// Sa plainte du 20 octobre 2026, capture à l'appui : *« J'ai créé un chantier
// Simon Bandera avec la fiche client. J'ai fait retour et le chantier
// n'apparaît pas dans les chantiers en cours. Je t'ai déjà parlé de ce
// problème-là il y a plusieurs semaines. »*
//
// Le chantier existait. L'accueil posait TOUS les contrats d'entretien en tête,
// puis les chantiers : deux listes recollées bout à bout, chacune triée à sa
// façon (les contrats par mise à jour, les chantiers par création). Le fil
// montrait « 13 oct. », « 03 oct. »… et le chantier du 20 octobre venait
// après, hors de l'écran. Un fil qui affiche des dates se lit dans l'ordre de
// ces dates : rien en dessous du 3 octobre ne pouvait être d'aujourd'hui.
//
// **Le cas est joué par SON chemin** : la feuille « Créer un devis », un nom,
// la flèche de retour. Un contrat plus ancien suffit à le faire rougir — c'est
// la seule condition de sa capture.

const BASE = ADRESSE;

async function main() {
  console.log("=== Le chantier neuf est en tête du fil, devant un contrat plus ancien ===\n");

  const { rows: ent } = await pool.query(
    `SELECT m.entreprise_id FROM membres_entreprise m JOIN users u ON u.id = m.utilisateur_id
      WHERE u.email = 'demo@atlas.local' LIMIT 1`
  );
  const entrepriseId = ent[0]?.entreprise_id as string;
  assert.ok(entrepriseId, "le compte de démonstration est absent : la base n'est pas amorcée");

  const { rows: cli } = await pool.query(
    `SELECT id FROM clients WHERE entreprise_id = $1 AND deleted_at IS NULL LIMIT 1`,
    [entrepriseId]
  );
  assert.ok(cli[0], "aucun client dans le jeu de démonstration : rien pour porter un contrat");

  // Un contrat à compléter, touché il y a cinq jours : la ligne de sa capture.
  const { rows: con } = await pool.query(
    `INSERT INTO contrats_entretien (entreprise_id, client_id, debut, duree_mois, taux_tva, prestations, updated_at)
     VALUES ($1, $2, date_trunc('month', now() + interval '1 month')::date, 12, 20,
             '[{"libelle":"Tonte","famille":null,"mois":[4,5,6],"foisParMois":1,"prixPassageHt":null}]',
             now() - interval '5 days')
     RETURNING id`,
    [entrepriseId, cli[0].id]
  );
  const contratId = con[0].id as string;

  const nom = `Bandera${Date.now().toString(36)}`;
  const navigateur = await lancerNavigateur();
  try {
    const page = await (await navigateur.newContext({ ...devices["iPhone 13"] })).newPage();
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await page.fill('input[name="email"]', "demo@atlas.local");
    await page.fill('input[name="password"]', "demo1234");
    await page.click('button[type="submit"]');
    await page.waitForURL(`${BASE}/`, { timeout: 30_000 });
    await page.waitForLoadState("networkidle");

    // ── Son geste : « Créer un devis », le nom, la flèche ──────────────────
    await page.locator('[data-atlas="nouveau-chantier"]').click();
    const feuille = page.getByRole("dialog", { name: "Créer un devis" });
    await feuille.getByLabel("Nom du client", { exact: true }).fill(`Simon ${nom}`);
    await feuille.locator("[data-geste-retour]").click();
    await feuille.waitFor({ state: "hidden", timeout: 30_000 });

    const { rows: cree } = await pool.query(
      `SELECT id FROM chantiers WHERE nom ILIKE $1 AND deleted_at IS NULL`,
      [`%${nom}%`]
    );
    assert.equal(cree.length, 1, "la flèche n'a créé aucun chantier : ce n'est pas le défaut mesuré ici");

    const premiere = page.locator("a.atlas-brin").first();
    await page.locator(`a.atlas-brin:has-text("${nom}")`).waitFor({ timeout: 30_000 });
    const lue = (await premiere.innerText()).replace(/\s+/g, " ");
    assert.ok(
      lue.includes(nom),
      `la première ligne du fil est « ${lue} » : le chantier créé à l'instant passe derrière un contrat plus ancien`
    );
    console.log("  ✓ le chantier créé à l'instant ouvre le fil, devant le contrat d'il y a cinq jours");
  } finally {
    await navigateur.close();
    await pool.query(`DELETE FROM contrats_entretien WHERE id = $1`, [contratId]);
    await pool.query(`UPDATE chantiers SET deleted_at = now() WHERE nom ILIKE $1`, [`%${nom}%`]);
    await pool.end();
  }
}

main().catch((e) => {
  console.error(`  ✗ ${(e as Error).message}`);
  process.exit(1);
});
