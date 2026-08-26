// REGARDER « Reste 1 équipe sur 2 » sur la liste des dates qu'il propose.
//
// Sa réponse B du 25 août 2026, avec le libellé corrigé sur sa remarque. Le vert
// dit que la mention est là ; il ne dit pas qu'elle tient dans la ligne à côté
// de « proposée », ni qu'elle ne pousse pas la date sur deux lignes. Ce
// dépôt a trouvé cinq défauts réels à l'image et aucun par un test
// (`CLAUDE.md` §5).
//
//   npx tsx scripts/capture-reste-equipes.mts <dossier>
import { lancerNavigateur } from "./e2e-browser";
import { Pool } from "pg";
import { mkdirSync } from "node:fs";
import path from "node:path";
const D = process.argv[2]; mkdirSync(D, { recursive: true });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const MARQUE = "capture-reste";
const base = new Date(); base.setDate(base.getDate() + 5);
const suivant = new Date(base); suivant.setDate(suivant.getDate() + 1);
if (suivant.getMonth() !== base.getMonth()) { base.setDate(base.getDate() - 1); suivant.setDate(suivant.getDate() - 1); }
const jour = base.toISOString().slice(0, 10), libre = suivant.toISOString().slice(0, 10);
await pool.query(`DELETE FROM chantiers WHERE nom LIKE $1`, [`${MARQUE}%`]);
const avant = (await pool.query(`SELECT nombre_equipes FROM entreprises LIMIT 1`)).rows[0].nombre_equipes;
await pool.query(`UPDATE entreprises SET nombre_equipes = 2`);
const eid = (await pool.query(`SELECT id FROM entreprises LIMIT 1`)).rows[0].id;
await pool.query(`INSERT INTO chantiers (entreprise_id, nom, date_planifiee, creneau_debut, duree_demi_journees) VALUES ($1,$2,$3,'matin',2)`, [eid, `${MARQUE} — voisin`, jour]);

const nav = await lancerNavigateur();
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
const p = await ctx.newPage();
await p.goto("http://localhost:3000/login", { waitUntil: "networkidle" });
await p.fill('input[name="email"]', "demo@atlas.local");
await p.fill('input[name="password"]', "demo1234");
await p.click('button[type=submit]');
await p.waitForURL("http://localhost:3000/");
await p.goto("http://localhost:3000/chantiers/nouveau", { waitUntil: "networkidle" });
await p.fill('input[placeholder="Bernard"]', "M. Bernard");
await p.fill('input[placeholder="06 12 34 56 78"]', "06 12 34 56 78");
// Le même geste que les suites : « Écrire le devis » crée puis emmène.
await p.click('[data-atlas="action-ecrire"]');
await p.waitForURL(/\/chantiers\/[0-9a-f-]{36}\/devis-complet/, { timeout: 30000 });
const url = "http://localhost:3000/chantiers/" + p.url().match(/\/chantiers\/([0-9a-f-]{36})/)![1];
await p.goto(`${url}/prix`, { waitUntil: "networkidle" });
await p.click("text=+ Ajouter une ligne");
await p.waitForTimeout(300);
const ch = p.locator("form input");
await ch.nth(0).fill("Main d\u0027\u0153uvre"); await ch.nth(1).fill("800.00"); await ch.nth(1).blur();
await p.waitForTimeout(600);
await p.goto(`${url}/devis-complet`, { waitUntil: "networkidle" });
await p.click("text=Choisir la date");
await p.waitForSelector('[data-atlas="invite-dates"]', { timeout: 30000 });
for (const j of [jour, libre]) {
  await p.locator(`[data-jour="${j}"]`).first().click();
  await p.locator("text=V\u00e9rification de votre planning\u2026").waitFor({ state: "hidden", timeout: 20000 }).catch(() => undefined);
  await p.waitForTimeout(800);
}
const m = p.locator('[data-atlas="reste-equipes"]');
console.log("mentions:", await m.count(), await m.count() ? await m.first().innerText() : "");
await m.first().scrollIntoViewIfNeeded();
await p.waitForTimeout(400);
await p.screenshot({ path: path.join(D, "dates.png") });
await nav.close();
await pool.query(`DELETE FROM chantiers WHERE nom LIKE $1`, [`${MARQUE}%`]);
await pool.query(`UPDATE entreprises SET nombre_equipes = $1`, [avant]);
await pool.end();
