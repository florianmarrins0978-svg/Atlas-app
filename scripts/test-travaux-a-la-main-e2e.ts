import assert from "node:assert/strict";
import { jourDuPatron } from "./_jour-e2e";
import { Pool } from "pg";
import { lancerNavigateur } from "./e2e-browser";
import { ADRESSE } from "./_adresse";

// ═══════════════════════════════════════════════════════════════════════════
// LES TRAVAUX D'UN CLIENT POSÉ SANS DEVIS, SUR LA FICHE — 7 octobre 2026
// ═══════════════════════════════════════════════════════════════════════════
//
// Sa demande : *« on peut ajouter un client au planning alors qu'on n'a pas
// envoyé le devis ; il faut que l'on puisse ajouter les travaux à faire »*,
// puis *« oui, et 1 »* devant `appli/travaux-sans-devis.html`.
//
// **Le geste du patron, pas la fonction** (`CLAUDE.md` §5 quater) : il ouvre
// le planning, touche son chantier, déplie « Travaux à faire », écrit, ajoute,
// enlève, et retrouve sa liste en revenant. Les règles d'écriture (devis parti,
// brouillon, autre entreprise) sont tenues sous la RLS par
// `test-travaux-a-la-main-db.ts`.

const BASE = ADRESSE;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const LIGNE = "[data-atlas='ligne-planifiee']";
const FEUILLE = "[data-atlas='feuille']";
const OUVRIR = "[data-atlas='ouvrir-travaux']";
const COMPTE = "[data-atlas='compte-des-travaux']";
const TACHE = "[data-atlas='tache-du-retour']";
const AJOUTER = "[data-atlas='ajouter-travail']";
const ENLEVER = "[data-atlas='enlever-travail']";

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

async function travauxEnBase(id: string): Promise<string[]> {
  const { rows } = await pool.query<{ t: string[] }>(
    `SELECT travaux_a_la_main AS t FROM chantiers WHERE id = $1`,
    [id]
  );
  return rows[0]?.t ?? [];
}

async function main() {
  console.log("=== Travaux à faire — un client posé sans devis ===\n");

  const { rows } = await pool.query<{ id: string; nom: string }>(
    `SELECT c.id, c.nom FROM chantiers c
      WHERE c.deleted_at IS NULL AND c.termine_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM devis d WHERE d.chantier_id = c.id)
      ORDER BY c.created_at DESC LIMIT 1`
  );
  assert.ok(rows.length === 1, "aucun chantier sans devis dans le jeu de démonstration");
  const { id: chantierId, nom: chantierNom } = rows[0];
  await pool.query(
    `UPDATE chantiers SET date_planifiee = $2, travaux_a_la_main = '{}' WHERE id = $1`,
    [chantierId, jourDuPatron()]
  );
  await pool.query(`DELETE FROM retours_intervention WHERE chantier_id = $1`, [chantierId]);

  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext({ viewport: { width: 390, height: 844 } });
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });

  async function ouvrirLesTravaux() {
    await page.goto(`${BASE}/planning`, { waitUntil: "networkidle" });
    const ligne = page.locator(`${LIGNE}:has-text("${chantierNom}")`).first();
    await ligne.waitFor({ state: "visible", timeout: 20_000 });
    await ligne.click();
    await page.locator(FEUILLE).first().waitFor({ state: "visible", timeout: 20_000 });
    await page.locator(OUVRIR).click();
    await page.locator(AJOUTER).waitFor({ state: "visible", timeout: 20_000 });
  }

  await ouvrirLesTravaux();

  await cas("SANS DEVIS, le bandeau s'ouvre sur « Ajouter un travail »", async () => {
    assert.equal((await page.locator(COMPTE).innerText()).trim(), "aucune ligne");
    assert.equal(await page.locator(TACHE).count(), 0);
    assert.doesNotMatch(await page.locator(FEUILLE).innerText(), /Aucune ligne sur le devis/);
  });

  await cas("écrire, Ajouter, puis Entrée : deux lignes à cocher, en base", async () => {
    const champ = page.locator(`${AJOUTER} input`);
    await champ.fill("Taille de haie de thuya");
    await page.locator(`${AJOUTER} button[type=submit]`).click();
    await page.locator(TACHE).first().waitFor({ state: "visible", timeout: 10_000 });
    await champ.fill("Ramassage des feuilles");
    await champ.press("Enter");
    await page.waitForFunction((s) => document.querySelectorAll(s).length === 2, TACHE, {
      timeout: 10_000,
    });
    assert.equal(await champ.inputValue(), "", "le champ ne se vide pas après l'ajout");
    assert.equal((await page.locator(COMPTE).innerText()).trim(), "2 lignes");
    assert.deepEqual(await travauxEnBase(chantierId), ["Taille de haie de thuya", "Ramassage des feuilles"]);
  });

  await cas("cocher un travail fait bouger le compte, comme une ligne du devis", async () => {
    await page.locator(TACHE).first().click();
    assert.equal((await page.locator(COMPTE).innerText()).trim(), "1 sur 2 fait");
  });

  await page.screenshot({ path: "/tmp/atlas-vu/travaux-a-la-main.png" });

  await cas("la croix enlève le travail, en base aussi", async () => {
    await page.locator(ENLEVER).first().click();
    await page.waitForFunction((s) => document.querySelectorAll(s).length === 1, TACHE, {
      timeout: 10_000,
    });
    assert.deepEqual(await travauxEnBase(chantierId), ["Ramassage des feuilles"]);
  });

  await cas("en revenant sur le planning, la liste est toujours là", async () => {
    await ouvrirLesTravaux();
    assert.equal(await page.locator(TACHE).count(), 1);
    assert.match(await page.locator(TACHE).first().innerText(), /Ramassage des feuilles/);
  });

  await cas("rien ne déborde à la largeur du téléphone", async () => {
    const largeur = await page.evaluate(() => document.documentElement.scrollWidth);
    assert.ok(largeur > 0, "mesure impossible : largeur nulle");
    assert.ok(largeur <= 390, `la page fait ${largeur} px de large`);
  });

  await pool.query(`UPDATE chantiers SET date_planifiee = NULL, travaux_a_la_main = '{}' WHERE id = $1`, [
    chantierId,
  ]);
  await navigateur.close();
  await pool.end();
  console.log(`\n${echecs === 0 ? "✅" : "❌"} Travaux écrits à la main, sur la fiche — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
