import { lancerNavigateur } from "./e2e-browser";
import { Pool } from "pg";
import { mkdirSync } from "node:fs";

/**
 * Regarder ce que ce lot change, à la taille de son téléphone (390 × 664).
 *
 * **Il ne remplace aucun contrôle, et c'est pour cela qu'il existe.** Quatre
 * défauts réels de ce dépôt sont sortis d'une image et d'aucun test
 * (`CLAUDE.md` §5) : un compte de notifications qui poussait tout hors de
 * l'écran, trois noms coupés que la mesure disait entiers.
 *
 * Ce que ce lot ajoute et qu'il faut REGARDER :
 *
 *   1. la journée d'un chantier ouverte par `?chantier=<id>`, portes levées ;
 *   2. le chevron neuf sur « Sans date » — la rangée y porte déjà trois
 *      boutons quand un jour est touché, et c'est là qu'elle peut déborder ;
 *   3. le même sur « En attente du client » ;
 *   4. la fiche client, devenue le point de reprise des photos et de la dictée.
 */
const BASE = process.env.BASE ?? "http://localhost:3000";
const SORTIE = process.argv[2] ?? "captures-fiche-retiree";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

mkdirSync(SORTIE, { recursive: true });

const navigateur = await lancerNavigateur();
// **Sa taille à lui**, relevée le 11 août 2026 : 390 × 664. Mesurer plus large,
// c'est ne jamais voir ce qui déborde chez lui.
const contexte = await navigateur.newContext({
  viewport: { width: 390, height: 664 },
  deviceScaleFactor: 2,
});
const page = await contexte.newPage();

await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill('input[name="email"]', "demo@atlas.local");
await page.fill('input[name="password"]', "demo1234");
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/`, { timeout: 30_000 });

const { rows: poses } = await pool.query(
  `SELECT id, nom, date_planifiee FROM chantiers
    WHERE date_planifiee IS NOT NULL AND deleted_at IS NULL
    ORDER BY date_planifiee DESC LIMIT 1`
);
const { rows: sansDate } = await pool.query(
  `SELECT id, nom FROM chantiers
    WHERE date_planifiee IS NULL AND devis_envoye_at IS NOT NULL AND deleted_at IS NULL
    LIMIT 1`
);

async function prendre(nom: string, adresse: string, avant?: () => Promise<void>) {
  await page.goto(adresse, { waitUntil: "networkidle" });
  if (avant) await avant();
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${SORTIE}/${nom}.png` });
  console.log(`  · ${nom} — ${adresse}`);
}

if (poses[0]) {
  console.log(`chantier posé : ${poses[0].nom} (${poses[0].date_planifiee})`);
  await prendre("1-journee-portes-levees", `${BASE}/planning?chantier=${poses[0].id}`);
  // La feuille refermée : le calendrier doit être resté SUR SA JOURNÉE.
  await prendre("2-journee-feuille-fermee", `${BASE}/planning?chantier=${poses[0].id}`, async () => {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
  });
} else {
  console.log("aucun chantier posé en base : les deux premières captures manquent");
}

// Le tiroir du bas, ouvert : c'est là que vivent les deux chevrons neufs.
await prendre("3-tiroir-du-bas-ouvert", `${BASE}/planning`, async () => {
  const poignee = page.locator('[data-atlas="tiroir-planning"] button').first();
  if (await poignee.count()) {
    await poignee.click();
    await page.waitForTimeout(600);
  }
});

// Le même, un jour touché : la rangée porte alors trois boutons EN PLUS du
// chevron, et c'est le cas le plus serré de tout ce lot.
await prendre("4-tiroir-jour-touche", `${BASE}/planning`, async () => {
  const jour = page.locator("[data-jour]").nth(15);
  if (await jour.count()) await jour.click();
  await page.waitForTimeout(400);
  const poignee = page.locator('[data-atlas="tiroir-planning"] button').first();
  if (await poignee.count()) {
    await poignee.click();
    await page.waitForTimeout(600);
  }
});

const pourFiche = sansDate[0] ?? poses[0];
if (pourFiche) {
  await prendre("5-fiche-client", `${BASE}/chantiers/${pourFiche.id}/coordonnees`);
  // L'ancienne adresse : elle doit REDIRIGER, jamais rendre un 404.
  await page.goto(`${BASE}/chantiers/${pourFiche.id}`, { waitUntil: "networkidle" });
  console.log(`\nancienne adresse → ${page.url()}`);
  await page.screenshot({ path: `${SORTIE}/6-ancienne-adresse.png` });
}

await navigateur.close();
await pool.end();
console.log(`\n✅ captures dans ${SORTIE}`);
