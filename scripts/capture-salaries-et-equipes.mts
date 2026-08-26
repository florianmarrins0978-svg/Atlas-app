// Capture l'écran « Équipe » pour REGARDER les deux compteurs séparés — celui
// des chantiers menés en même temps, et celui des salariés (26 août 2026).
//
// `CLAUDE.md` §5 : on regarde l'écran. Trois défauts réels de ce dépôt ont été
// trouvés sur une capture et par aucun test vert.
//
//   DATABASE_URL=…postgres npx tsx scripts/capture-salaries-et-equipes.mts <dossier>
import { mkdirSync } from "node:fs";
import { Pool } from "pg";
import { lancerNavigateur } from "./e2e-browser";

const BASE = process.env.ATLAS_BASE ?? "http://localhost:3000";
const dossier = process.argv[2] ?? "/tmp/captures-salaries";
mkdirSync(dossier, { recursive: true });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// **Deux décors, parce que l'écran ne dit pas la même chose dans les deux.**
// Celui de l'artisan seul est le plus facile à casser sans s'en apercevoir : il
// ne doit voir NI liste de noms, NI bloc d'absences.
async function poser(nombreEquipes: number, nombreSalaries: number, noms: [number, string][]) {
  await pool.query(`UPDATE entreprises SET nombre_equipes = $1, nombre_salaries = $2`, [
    nombreEquipes,
    nombreSalaries,
  ]);
  await pool.query(`DELETE FROM equipes WHERE rang <> -1`);
  for (const [rang, nom] of noms) {
    await pool.query(
      `INSERT INTO equipes (entreprise_id, rang, nom)
       SELECT id, $1, $2 FROM entreprises
       ON CONFLICT (entreprise_id, rang) DO UPDATE SET nom = EXCLUDED.nom`,
      [rang, nom]
    );
  }
}

const navigateur = await lancerNavigateur();
const contexte = await navigateur.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
const page = await contexte.newPage();

await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill('input[name="email"]', "demo@atlas.local");
await page.fill('input[name="password"]', "demo1234");
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/`, { timeout: 30_000 });

// 1 — deux chantiers de front, trois gars dont un sans nom : le cas qui montre
//     à la fois la séparation des compteurs et l'écart qu'il a choisi d'assumer.
await poser(2, 3, [
  [1, "Paul"],
  [2, "Julien"],
]);
await page.goto(`${BASE}/reglages/equipe`, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(400);
await page.screenshot({ path: `${dossier}/equipe-deux-compteurs.png`, fullPage: true });

// 2 — l'artisan seul : aucun nom à régler, aucune absence à noter.
await poser(1, 0, []);
await page.goto(`${BASE}/reglages/equipe`, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(400);
await page.screenshot({ path: `${dossier}/equipe-seul.png`, fullPage: true });

// 3 — le planning, où les noms se cochent : c'est là que « la même façon de
//     faire » doit se voir.
await poser(2, 2, [
  [1, "Paul"],
  [2, "Julien"],
]);
await page.goto(`${BASE}/planning`, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(600);
await page.screenshot({ path: `${dossier}/planning-noms.png`, fullPage: true });

console.log(`Captures dans ${dossier}`);
await navigateur.close();
await pool.end();
