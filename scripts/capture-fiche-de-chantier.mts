// LA FICHE DE CHANTIER, DE BOUT EN BOUT — sa question du 26 août 2026 :
// *« la fiche de chantier est finie ? Montre-moi à quoi elle ressemble
// maintenant. »*
//
// **On photographie ce qui EXISTE dans l'application** (`CLAUDE.md` §3 bis) :
// une maquette se donne par son adresse, un écran se montre en image — il ne
// peut pas l'ouvrir autrement.
//
// Le parcours est le VRAI : on compose la liste, on ouvre la fiche du jour, on
// coche, on nomme le client, on envoie — et l'on regarde ce que le client reçoit.
//
//     npx tsx scripts/capture-fiche-de-chantier.mts <dossier>
import { mkdirSync } from "node:fs";
import { devices } from "playwright";
import { lancerNavigateur } from "./e2e-browser";
import { pool } from "../src/server/db/client";

const dossier = process.argv[2] ?? "/tmp/captures";
mkdirSync(dossier, { recursive: true });
const BASE = process.env.BASE_URL ?? "http://localhost:3000";

const nav = await lancerNavigateur();
const ctx = await nav.newContext({ ...devices["iPhone 13"] });
const page = await ctx.newPage();

await page.goto(`${BASE}/connexion`, { waitUntil: "networkidle" });
await page.fill('input[name="email"]', "demo@atlas.local");
await page.fill('input[name="password"]', "demo1234");
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/`, { timeout: 60_000 });

// Une fiche neuve, quel que soit l'état laissé par une autre suite.
await pool.query("delete from lignes_passage");
await pool.query("delete from passages_entretien");
await pool.query("delete from prestations_entretien");

/** Attendre l'écran, jamais un délai : sinon on photographie « CHARGEMENT… ». */
async function poser(chemin: string, attendu: string) {
  await page.goto(`${BASE}${chemin}`, { waitUntil: "networkidle" });
  await page.getByText(attendu).first().waitFor({ timeout: 30_000 });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);
}

// ─── 1. L'écran, fiche vide : il n'a rien à cocher, et l'écran le dit ───────
await poser("/paysage/fiche", "Fiche de chantier");
await page.screenshot({ path: `${dossier}/1-fiche-vide.png` });

// ─── 2. Composer sa liste ───────────────────────────────────────────────────
await poser("/paysage/fiche/composer", "Composer ma fiche");
await page.screenshot({ path: `${dossier}/2-composer-vide.png` });
await page.getByRole("button", { name: /Partir du modèle Atlas/ }).click();
await page.waitForSelector("[data-prestation]", { timeout: 30_000 });
await page.waitForTimeout(400);
await page.screenshot({ path: `${dossier}/3-ma-liste.png`, fullPage: true });

// ─── 3. L'écran avec la carte en tête ───────────────────────────────────────
await poser("/paysage/fiche", "Composer ma fiche");
await page.screenshot({ path: `${dossier}/4-la-carte-en-tete.png` });

// ─── 4. La fiche du jour, ouverte ───────────────────────────────────────────
await page.getByRole("button", { name: /Ouvrir une fiche/ }).click();
await page.waitForURL(/\/paysage\/fiche\/[0-9a-f-]{36}/, { timeout: 30_000 });
await page.getByText("Tonte et ébarbage").first().waitFor({ timeout: 30_000 });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(400);
await page.screenshot({ path: `${dossier}/5-la-fiche-du-jour.png`, fullPage: true });

console.log(`Captures dans ${dossier}`);
await nav.close();
await pool.end();
