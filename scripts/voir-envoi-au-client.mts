// REGARDER la feuille « Envoyer à … » dans TOUS ses états, à la taille de son
// téléphone (390 × 664 — son écran, barre d'adresse déduite).
//
// Un défaut d'affichage vit toujours dans l'état qu'on n'a pas regardé : cinq
// des défauts réels de ce dépôt sont sortis d'une image, aucun d'un test vert
// (`CLAUDE.md` §5). Ce script produit la planche entière — préparation,
// réparation d'une coordonnée, blocage, une date, deux dates, jour refusé,
// interrupteur fermé, chantier long, envoi en cours — pour la charte demandée.
//
//   npx tsx scripts/voir-envoi-au-client.mts <dossier> [charte]
//
// La charte par défaut est celle de son compte ; « nuit » ou « sylve »
// montrent les deux sombres, où les pôles s'inversent.
import { lancerNavigateur, ECRAN_DU_PATRON } from "./e2e-browser";
import { Pool } from "pg";
import { mkdirSync } from "node:fs";
import path from "node:path";
import type { Page, BrowserContext } from "playwright";

const DOSSIER = process.argv[2];
const CHARTE = process.argv[3] ?? null;
if (!DOSSIER) throw new Error("Dossier de sortie attendu.");
mkdirSync(DOSSIER, { recursive: true });

const BASE = "http://localhost:3000";
const MARQUE = "voir-envoi";
// **Le décor demande un rôle qui TRAVERSE la RLS**, comme les suites navigateur
// (`CLAUDE.md` §5). Ni `atlas_app` ni `atlas_owner` n'y suffisent : les tables
// portent `FORCE ROW LEVEL SECURITY`, et l'insertion d'un chantier voisin est
// refusée — « new row violates row-level security policy », qui accuse la
// requête alors que seul le rôle est en cause.
const pool = new Pool({
  connectionString:
    process.env.DATABASE_DECOR_URL ?? process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL,
});

const dans = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

async function poserLeDecor() {
  await pool.query(`DELETE FROM chantiers WHERE nom LIKE $1`, [`${MARQUE}%`]);
  const eid = (await pool.query(`SELECT id FROM entreprises LIMIT 1`)).rows[0].id;
  // La charte est le goût de la PERSONNE, pas un réglage d’entreprise
  // (`schema.ts`, migration 0047) : elle se pose sur son compte.
  if (CHARTE) await pool.query(`UPDATE users SET charte = $1`, [CHARTE]);
  await pool.query(`UPDATE entreprises SET nombre_equipes = 2`);
  // Deux journées prises pour de bon : l'une à demi (il reste une équipe),
  // l'autre entière (le serveur la refuse et propose la suivante).
  const decor: readonly (readonly [string, string, number])[] = [
    [dans(6), "matin", 1],
    [dans(7), "matin", 2],
    [dans(7), "matin", 2],
  ];
  for (const [jour, creneau, duree] of decor) {
    await pool.query(
      `INSERT INTO chantiers (entreprise_id, nom, date_planifiee, creneau_debut, duree_demi_journees)
       VALUES ($1,$2,$3,$4,$5)`,
      [eid, `${MARQUE} — voisin ${jour}-${duree}`, jour, creneau, duree]
    );
  }
}

async function seConnecter(ctx: BrowserContext) {
  const p = await ctx.newPage();
  await p.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await p.fill('input[name="email"]', "demo@atlas.local");
  await p.fill('input[name="password"]', "demo1234");
  await p.click("button[type=submit]");
  await p.waitForURL(`${BASE}/`);
  return p;
}

async function creerChantier(p: Page, nom: string, tel: string | null) {
  await p.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await p.fill('input[placeholder="Bernard"]', nom);
  if (tel) await p.fill('input[placeholder="06 12 34 56 78"]', tel);
  await p.click('[data-atlas="action-ecrire"]');
  await p.waitForURL(/\/chantiers\/[0-9a-f-]{36}\/devis-complet/, { timeout: 60_000 });
  return `${BASE}/chantiers/${p.url().match(/\/chantiers\/([0-9a-f-]{36})/)![1]}`;
}

async function poserUnPrix(p: Page, url: string) {
  await p.goto(`${url}/prix`, { waitUntil: "networkidle" });
  await p.click("text=+ Ajouter une ligne");
  await p.waitForTimeout(400);
  const ch = p.locator("form input");
  await ch.nth(0).fill("Taille de haie, 40 m linéaires");
  await ch.nth(1).fill("980.00");
  await ch.nth(1).blur();
  await p.waitForTimeout(900);
}

async function ouvrirLaFeuille(p: Page, url: string) {
  await p.goto(`${url}/devis-complet`, { waitUntil: "networkidle" });
  await p.click("text=Choisir la date");
}

/** Une vue de la feuille, du haut vers le bas, en autant de morceaux qu'il faut. */
async function photographier(p: Page, nom: string) {
  const feuille = p.locator("div.overflow-y-auto").first();
  const mesures = await feuille
    .evaluate((e) => ({ haut: e.scrollHeight, vu: e.clientHeight }))
    .catch(() => ({ haut: 0, vu: 0 }));
  await feuille.evaluate((e) => (e.scrollTop = 0)).catch(() => undefined);
  await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(DOSSIER, `${nom}.png`) });
  let i = 1;
  let pos = 0;
  while (mesures.haut > mesures.vu + 8 && pos + mesures.vu < mesures.haut - 8 && i < 5) {
    pos += mesures.vu - 60;
    await feuille.evaluate((e, y) => (e.scrollTop = y), pos).catch(() => undefined);
    await p.waitForTimeout(300);
    await p.screenshot({ path: path.join(DOSSIER, `${nom}-${++i}.png`) });
  }
  console.log(`· ${nom} — feuille ${mesures.haut} px dans ${mesures.vu} px`);
}

const nav = await lancerNavigateur();
const ctx = await nav.newContext({ ...ECRAN_DU_PATRON, deviceScaleFactor: 2 });
await poserLeDecor();
const p = await seConnecter(ctx);

// ─── 1. Le chemin ordinaire ────────────────────────────────────────────────
const url = await creerChantier(p, "Mme Lecomte", "06 12 34 56 78");
await poserUnPrix(p, url);

// La préparation en cours : le serveur retenu quelques secondes, le temps de
// voir ce que le patron voit pendant qu'il attend.
await p.goto(`${url}/devis-complet`, { waitUntil: "networkidle" });
await p.route("**/devis-complet*", async (route) => {
  if (route.request().method() === "POST") await new Promise((r) => setTimeout(r, 4000));
  await route.continue().catch(() => undefined);
});
await p.click("text=Choisir la date");
await p.waitForTimeout(800);
await photographier(p, "01-preparation");
await p.unrouteAll({ behavior: "ignoreErrors" });
await p.waitForSelector('[data-atlas="invite-dates"]', { timeout: 60_000 });
await p.waitForTimeout(1200);
await photographier(p, "02-une-date");

// Le jour à demi pris : il reste une équipe, le serveur l'accepte.
await p.locator(`[data-jour="${dans(6)}"]`).first().click();
await p
  .locator("text=Vérification de votre planning…")
  .waitFor({ state: "hidden", timeout: 30_000 })
  .catch(() => undefined);
await p.waitForTimeout(800);
await photographier(p, "03-deux-dates");

// Le jour complet : le serveur refuse et nomme une alternative.
await p.locator(`[data-jour="${dans(7)}"]`).first().click();
await p
  .locator("text=Vérification de votre planning…")
  .waitFor({ state: "hidden", timeout: 30_000 })
  .catch(() => undefined);
await p.waitForTimeout(800);
await photographier(p, "04-jour-refuse");

// L'interrupteur fermé.
await p.locator('button[role="switch"]').click();
await p.waitForTimeout(400);
await photographier(p, "05-interrupteur-ferme");

// Aucune date retenue : il retire la seule qu'il avait.
await p.goto(`${url}/devis-complet`, { waitUntil: "networkidle" });
await p.click("text=Choisir la date");
await p.waitForSelector('[data-atlas="invite-dates"]', { timeout: 60_000 });
await p.waitForTimeout(1200);
const ligne = p.locator('button[aria-pressed="true"]').filter({ hasText: "proposée" }).first();
if (await ligne.count()) {
  await ligne.click();
  await p.waitForTimeout(600);
}
await photographier(p, "06-aucune-date");
await p.locator("text=Envoyer le devis").click();
await p.waitForTimeout(600);
await photographier(p, "07-refus-sans-date");

// Le chantier long : « X jours ouvrés d'affilée seront réservés ».
await p.selectOption('select[aria-label="Durée du chantier"]', { index: 8 }).catch(() => undefined);
await p.waitForTimeout(2500);
await photographier(p, "08-chantier-long");

// ─── 2. L'envoi en cours ───────────────────────────────────────────────────
await p.goto(`${url}/devis-complet`, { waitUntil: "networkidle" });
await p.click("text=Choisir la date");
await p.waitForSelector('[data-atlas="invite-dates"]', { timeout: 60_000 });
await p.waitForTimeout(1200);
await p.route("**/devis-complet*", async (route) => {
  if (route.request().method() === "POST") await new Promise((r) => setTimeout(r, 8000));
  await route.continue().catch(() => undefined);
});
await p.locator("text=Envoyer le devis").click();
await p.waitForTimeout(1200);
await photographier(p, "09-envoi-en-cours");
await p.unrouteAll({ behavior: "ignoreErrors" });
await p.waitForTimeout(9000);

// ─── 3. La coordonnée qui manque ───────────────────────────────────────────
const urlSansTel = await creerChantier(p, "M. Ferrand", null);
await poserUnPrix(p, urlSansTel);
await ouvrirLaFeuille(p, urlSansTel);
await p.waitForTimeout(3000);
await photographier(p, "10-sans-coordonnee");

// ─── 4. Le devis vide ──────────────────────────────────────────────────────
const urlVide = await creerChantier(p, "M. Sorel", "06 98 76 54 32");
await ouvrirLaFeuille(p, urlVide);
await p.waitForTimeout(3000);
await photographier(p, "11-devis-vide");

await nav.close();
await pool.query(`DELETE FROM chantiers WHERE nom LIKE $1`, [`${MARQUE}%`]);
await pool.end();
console.log("Planche écrite dans", DOSSIER);
