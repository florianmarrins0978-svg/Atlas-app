// REGARDER « DÉPLACER » — capture de l'écran, pas un test.
//
// Sa remarque du 9 septembre 2026 : *« regarde réellement ce qui se passe quand
// on clique sur déplacer, j'ai l'impression que c'est inversé »*. Aucun test ne
// répond à ça : ils vérifient ce que la base reçoit, jamais ce que l'œil lit.
import { lancerNavigateur } from "./e2e-browser";
import { devices } from "playwright";
import { creerPuisFiche } from "./_creer-chantier-e2e";
import { ADRESSE } from "./_adresse";
import { Pool } from "pg";
import { mkdirSync } from "node:fs";

const BASE = ADRESSE;
const OU = process.argv[2] ?? "/tmp/captures";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  mkdirSync(OU, { recursive: true });
  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext({
    ...devices["iPhone 13"],
    deviceScaleFactor: 2,
  });
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });

  const nom = `M. Deplacer ${Date.now()}`;
  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Bernard"]', nom);
  await page.fill('input[placeholder="06 12 34 56 78"]', "05 56 00 00 12");
  const id = await creerPuisFiche(page);

  // Un chantier d'une DEMI-JOURNÉE, posé l'APRÈS-MIDI : c'est le cas où une
  // inversion se verrait — le mot lu et la pastille allumée doivent s'accorder.
  const jour = new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10);
  await pool.query(
    `UPDATE chantiers SET date_planifiee = $2, creneau_debut = 'apres_midi',
        duree_demi_journees = 1, devis_envoye_at = now()
      WHERE id = $1`,
    [id, jour]
  );

  await page.goto(`${BASE}/planning`, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  await page.click(`[data-atlas="grille-mois"] [data-jour="${jour}"]`);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${OU}/1-le-jour-ouvert.png`, fullPage: true });

  const carte = page.locator(`[data-atlas="carte-jour"][data-jour="${jour}"]`);
  await carte.locator('[data-atlas="deplacer"]').first().click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${OU}/2-deplacer-ouvert.png`, fullPage: true });

  // Ce que l'écran ALLUME, et ce que la base DIT — mis côte à côte.
  const boutons = await carte.locator("[data-vers]").evaluateAll((els) =>
    els.map((e) => ({
      vers: e.getAttribute("data-vers"),
      mot: (e.textContent ?? "").trim(),
      fond: getComputedStyle(e).backgroundColor,
      bord: getComputedStyle(e).borderColor,
    }))
  );
  const { rows } = await pool.query(
    `SELECT creneau_debut, duree_demi_journees FROM chantiers WHERE id = $1`,
    [id]
  );
  console.log("EN BASE  :", rows[0]);
  console.log("À L'ÉCRAN:", JSON.stringify(boutons, null, 2));

  // Puis on appuie sur « Matin » et on regarde où le chantier atterrit.
  await carte.locator('[data-vers="matin"]').click();
  await page.waitForTimeout(1600);
  await page.screenshot({ path: `${OU}/3-apres-appui-matin.png`, fullPage: true });
  const apres = await pool.query(
    `SELECT creneau_debut, duree_demi_journees FROM chantiers WHERE id = $1`,
    [id]
  );
  console.log("APRÈS « Matin » :", apres.rows[0]);

  await navigateur.close();
  await pool.end();
  console.log(`\nCaptures dans ${OU}`);
}

main();
