import { lancerNavigateur } from "./e2e-browser";
import type { Page, BrowserContext } from "playwright";
import { pool } from "../src/server/db/client";
import { creerPuisFiche } from "./_creer-chantier-e2e";

/**
 * Une CAPTURE de l'écran facture avec des travaux en plus — pour la REGARDER.
 *
 * Trois défauts réels de ce projet sont sortis d'une image et d'aucun test
 * (`CLAUDE.md` §5). Ce script rend l'écran dans les trois états qui comptent :
 * au repos, la saisie ouverte, et avec deux taux de TVA.
 *
 *   npx tsx scripts/capture-facture-ts.ts /tmp/captures
 */
const BASE = "http://localhost:3000";
const SORTIE = process.argv[2] ?? "/tmp/captures";

async function seConnecter(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 15000 });
  return page;
}

async function main() {
  const browser = await lancerNavigateur();
  const context = await browser.newContext({ viewport: { width: 414, height: 900 }, deviceScaleFactor: 2 });
  const page = await seConnecter(context);

  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Bernard"]', `Mme Grospiron ${Date.now()}`);
  await page.fill('input[placeholder="06 12 34 56 78"]', "06 79 98 45 14");
  await creerPuisFiche(page);
  await page.waitForURL(/\/chantiers\/[0-9a-f-]{36}/, { timeout: 10000 });
  const url = page.url();
  const chantierId = url.split("/").pop()!;

  await page.goto(`${url}/prix`, { waitUntil: "networkidle" });
  await page.click("text=+ Ajouter une ligne");
  await page.waitForTimeout(300);
  const champs = page.locator("form input");
  await champs.nth(0).fill("Tonte du gazon et entretien des espaces verts");
  await champs.nth(1).fill("500.00");
  await champs.nth(1).blur();
  await page.waitForTimeout(500);

  await page.goto(`${url}/devis-complet`, { waitUntil: "networkidle" });
  await page.click("text=Choisir la date");
  await page.waitForSelector('[data-atlas="invite-dates"]', { timeout: 10000 });
  await page.getByRole("button", { name: "Envoyer le devis" }).click();
  // L'envoi mène à l'accueil ou à l'écran d'export selon l'état du chantier :
  // ce script ne juge pas ce chemin, il veut seulement la facture d'après.
  await page.waitForTimeout(4000);
  await pool.query("UPDATE chantiers SET date_planifiee = CURRENT_DATE - 3 WHERE id = $1", [chantierId]);

  await page.goto(`${BASE}/chantiers/${chantierId}/facture`, { waitUntil: "networkidle" });
  await page.click("text=Créer la facture");
  await page.waitForSelector('[data-atlas="ouvrir-ts"]', { timeout: 15000 });
  await page.screenshot({ path: `${SORTIE}/facture-1-repos.png`, fullPage: true });

  await page.click('[data-atlas="ouvrir-ts"]');
  await page.waitForSelector('[data-atlas="ts-libelle"]');
  await page.fill('[data-atlas="ts-libelle"]', "Dessouchage d'un cerisier mort");
  await page.fill('[data-atlas="ts-quantite"]', "1");
  await page.fill('[data-atlas="ts-unite"]', "forfait");
  await page.fill('[data-atlas="ts-prix"]', "320");
  await page.screenshot({ path: `${SORTIE}/facture-2-saisie.png`, fullPage: true });

  await page.getByRole("button", { name: "Ajouter à la facture" }).click();
  await page.waitForSelector("text=Dessouchage", { timeout: 15000 });

  await page.click('[data-atlas="ouvrir-ts"]');
  await page.waitForSelector('[data-atlas="ts-libelle"]');
  await page.fill('[data-atlas="ts-libelle"]', "Reprise du massif");
  await page.fill('[data-atlas="ts-quantite"]', "12");
  await page.fill('[data-atlas="ts-unite"]', "m²");
  await page.fill('[data-atlas="ts-prix"]', "10");
  await page.click('[data-atlas="ts-taux-10"]');
  await page.getByRole("button", { name: "Ajouter à la facture" }).click();
  await page.waitForSelector("text=Reprise du massif", { timeout: 15000 });
  await page.screenshot({ path: `${SORTIE}/facture-3-deux-taux.png`, fullPage: true });

  console.log(`Captures écrites dans ${SORTIE}`);
  await browser.close();
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
