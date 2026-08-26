// Capture deux en-têtes après inversion du surtitre doré (26 août 2026) :
// un écran simple (Paysage) et un écran détail qui porte l'état (chantier).
import { mkdirSync } from "node:fs";
import { Pool } from "pg";
import { lancerNavigateur } from "./e2e-browser";
const BASE = process.env.ATLAS_BASE ?? "http://localhost:3000";
const dossier = process.argv[2] ?? "/tmp/captures-entete";
mkdirSync(dossier, { recursive: true });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const ch = await pool.query<{ id: string }>(`SELECT id FROM chantiers ORDER BY created_at LIMIT 1`);
const chantierId = ch.rows[0]?.id;
const nav = await lancerNavigateur();
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 });
const page = await ctx.newPage();
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill('input[name="email"]', "demo@atlas.local");
await page.fill('input[name="password"]', "demo1234");
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/`, { timeout: 30_000 });
await page.goto(`${BASE}/paysage`, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(400);
await page.screenshot({ path: `${dossier}/entete-paysage.png` });
if (chantierId) {
  await page.goto(`${BASE}/chantiers/${chantierId}`, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(400);
  await page.screenshot({ path: `${dossier}/entete-chantier.png` });
}
console.log("capturé chantier=", chantierId);
await nav.close(); await pool.end();
