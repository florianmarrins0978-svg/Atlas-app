// Capture l'écran Facture (brouillon) pour REGARDER l'échéance modifiable
// posée le 25 août 2026. §5 : on regarde l'écran, un test vert ne suffit pas.
//
//   DATABASE_URL=…postgres npx tsx scripts/capture-echeance-facture.mts <dossier>
import { mkdirSync } from "node:fs";
import { Pool } from "pg";
import { lancerNavigateur } from "./e2e-browser";

const BASE = process.env.ATLAS_BASE ?? "http://localhost:3000";
const dossier = process.argv[2] ?? "/tmp/captures-echeance";
mkdirSync(dossier, { recursive: true });

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const { rows } = await pool.query<{ id: string }>(
  `SELECT ch.id FROM chantiers ch JOIN devis d ON d.chantier_id = ch.id
     WHERE d.statut='envoye' ORDER BY ch.created_at LIMIT 1`
);
const chantierId = rows[0]?.id;
if (!chantierId) throw new Error("aucun chantier au devis envoyé dans le jeu de démo");

const navigateur = await lancerNavigateur();
const contexte = await navigateur.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
const page = await contexte.newPage();

await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill('input[name="email"]', "demo@atlas.local");
await page.fill('input[name="password"]', "demo1234");
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/`, { timeout: 30_000 });

await page.goto(`${BASE}/chantiers/${chantierId}/facture`, { waitUntil: "networkidle" });
// Si la facture n'existe pas encore, on la crée (brouillon) — c'est l'écran
// où l'échéance se modifie.
const creer = page.getByRole("button", { name: /Créer la facture/i });
if (await creer.count()) {
  await creer.first().click();
  await page.waitForTimeout(2500);
}
await page.waitForSelector('[data-atlas="echeance-facture"]', { timeout: 20_000 });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(400);

const champ = page.locator('[data-atlas="echeance-facture"]');
await champ.scrollIntoViewIfNeeded();
await page.screenshot({ path: `${dossier}/facture-echeance.png` });
const valeur = await champ.inputValue();
console.log("échéance proposée :", valeur);

// La modifier, et vérifier qu'elle PART en base — le parcours entier, pas le geste.
await champ.fill("2026-10-15");
await champ.blur();
await page.waitForTimeout(1500);
const enBase = (
  await pool.query<{ date_echeance: string }>(
    `SELECT date_echeance::text FROM factures WHERE chantier_id=$1`,
    [chantierId]
  )
).rows[0]?.date_echeance;
console.log("échéance en base après modification :", enBase);
if (enBase !== "2026-10-15") throw new Error(`la modification n'a pas été enregistrée : « ${enBase} »`);

await contexte.close();
await navigateur.close();
await pool.end();
console.log("Capture écrite dans", dossier);
