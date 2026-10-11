// Le dossier d'un client, onglet « Factures » — l'écran qu'il ouvre pour
// retrouver une facture (sa réponse du 9 septembre 2026 : « je vais dans mes
// clients sur la catégorie facture »).
//
//   ATLAS_BASE=http://localhost:3003 npx tsx scripts/capture-dossier-du-client.mts <dossier>
//
// **`localhost`, JAMAIS `127.0.0.1`** : sinon Next ne sert pas le JavaScript de
// la page, les onglets ne s'ouvrent pas, et l'on croit l'écran cassé.
import { mkdirSync } from "node:fs";
import { Client } from "pg";
import { lancerNavigateur } from "./e2e-browser";
import type { Page } from "playwright";

const BASE = process.env.ATLAS_BASE ?? "http://localhost:3000";
const dossier = process.argv[2] ?? "./captures-dossier";
mkdirSync(dossier, { recursive: true });

async function seConnecter(page: Page) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.locator('input[name="email"]').waitFor();
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });
}

// Le client qui a le plus de factures : sur un dossier vide, on ne verrait rien
// de ce qu'on vient regarder — et « aucune facture émise » n'est pas une mesure.
const admin = new Client({
  connectionString: process.env.ATLAS_BASE_SUPER ?? process.env.DATABASE_ADMIN_URL,
});
await admin.connect();
const { rows } = await admin.query(
  `select c.id, c.nom, count(f.id) as combien
     from clients c
     join chantiers ch on ch.client_id = c.id
     join factures f on f.chantier_id = ch.id
    group by c.id, c.nom
    order by combien desc
    limit 1`
);
await admin.end();
if (rows.length === 0) throw new Error("Aucun client n'a de facture : rien à regarder.");
console.log(`client « ${rows[0].nom} » · ${rows[0].combien} facture(s)`);

const navigateur = await lancerNavigateur();
const contexte = await navigateur.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await contexte.newPage();
const erreurs: string[] = [];
page.on("pageerror", (e) => erreurs.push(String(e)));

await seConnecter(page);
await page.goto(`${BASE}/clients/${rows[0].id}`, { waitUntil: "networkidle" });
await page.waitForTimeout(700);

// L'onglet « Factures » du dossier.
await page.locator("button", { hasText: "Factures" }).first().click();
await page.waitForTimeout(400);

const lignes = await page.locator('[data-atlas="piece"]').count();
console.log("pièces dans l'onglet Factures :", lignes);
const hauteur = await page.locator('[data-atlas="piece"]').first().boundingBox();
console.log("hauteur d'une ligne :", hauteur ? Math.round(hauteur.height) : "aucune", "px");
console.log("erreurs :", erreurs.length ? erreurs : "aucune");

await page.screenshot({ path: `${dossier}/dossier-factures.png`, fullPage: true });
await navigateur.close();
