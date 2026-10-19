import assert from "node:assert/strict";
import { lancerNavigateur } from "./e2e-browser";
import { pool } from "../src/server/db/client";
import { creerPuisFiche } from "./_creer-chantier-e2e";
import { joursAProposer } from "./_calendrier-e2e";
import { ADRESSE } from "./_adresse";

// **« Je ne peux plus choisir deux dates, ni même envoyer le devis avec une
// seule. »** Le patron, le 17 octobre 2026 à 21 h 04, capture à l'appui : un
// jour touché ne s'allume pas, et l'envoi ne part pas.
//
// **Le produit était sain, et la suite de ses deux dates verte.** Sa fiche
// d'espace disait ce qui s'était passé : entre 20 h 59 et 21 h 14, son espace
// avait basculé de 5fa7ce1 à df3c822. Sa feuille était ouverte d'AVANT : ses
// actions serveur portaient les identifiants de l'ancienne version, et le
// serveur neuf répond « action inconnue ».
//
// **Le défaut de l'écran, c'est ce qu'il en disait.** Le jour touché recevait
// « Impossible de vérifier cette date pour l'instant. Réessayez. » dans la
// fiche du jour, SOUS le pied collé, donc hors de sa vue ; et réessayer ne
// répare jamais une page vieillie. L'envoi, lui, affichait la phrase anglaise
// de Next.js. Rien ne lui disait le seul geste qui répare : recharger.
//
// **Comment cette suite fabrique sa page vieillie, sans rien simuler du
// serveur** : la page est ouverte normalement, puis chaque appel d'action part
// avec un identifiant que la version servie ne connaît pas. C'est le VRAI
// serveur qui répond « inconnue », exactement comme le sien ce soir-là.

const BASE = ADRESSE;
const RECHARGER = /Rechargez la page/;

async function main() {
  const navigateur = await lancerNavigateur();
  const page = await (await navigateur.newContext({ viewport: { width: 390, height: 664 } })).newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });

  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Bernard"]', `Page vieillie ${Date.now()}`);
  await page.fill('input[placeholder="06 12 34 56 78"]', "0612345678");
  const chantierId = await creerPuisFiche(page);

  await page.goto(`${BASE}/chantiers/${chantierId}/devis-complet`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Total TTC", { timeout: 40_000 });
  await page.getByLabel("Description 1").fill("Taille de haie");
  await page.getByLabel("Prix unitaire 1").fill("400");
  await page.getByLabel("Description 1").click();
  await page.waitForTimeout(1200);
  await page.goto(`${BASE}/chantiers/${chantierId}/devis-complet`, { waitUntil: "networkidle" });
  await page.getByText("Choisir la date", { exact: false }).first().click();
  await page.waitForSelector('[data-atlas="invite-dates"]', { timeout: 30_000 });
  await page.waitForTimeout(800);

  // La feuille est prête : l'espace « bascule » maintenant.
  await page.route("**/*", async (route) => {
    const entetes = route.request().headers();
    if (!entetes["next-action"]) return route.continue();
    await route.continue({ headers: { ...entetes, "next-action": "0".repeat(42) } });
  });

  const pied = page.locator('[data-atlas="pied-envoi"] [role="alert"]');

  // --- 1. Un jour touché le dit, là où il regarde ---------------------------
  const [jour] = await joursAProposer(page, 1);
  await page.locator(`[data-atlas$="grille-mois"] [data-jour="${jour}"]`).click();
  await pied.waitFor({ state: "visible", timeout: 20_000 }).catch(() => undefined);
  const apresToucher = (await pied.count()) ? await pied.innerText() : "";
  assert.match(
    apresToucher,
    RECHARGER,
    `Un jour touché sur une page vieillie ne dit pas de recharger, au pied de la feuille : « ${apresToucher} ».`
  );
  assert.ok(await pied.isVisible(), "La phrase existe mais n'est pas à l'écran.");
  console.log("  ✓ un jour touché sur une page vieillie dit de recharger, sous ses yeux");

  // --- 2. L'envoi aussi, en français, sans la phrase de Next.js -------------
  await page.getByRole("button", { name: "Envoyer le devis" }).click();
  await page.waitForTimeout(3000);
  const apresEnvoi = (await pied.count()) ? await pied.innerText() : "";
  assert.match(apresEnvoi, RECHARGER, `L'envoi sur une page vieillie ne dit pas de recharger : « ${apresEnvoi} ».`);
  assert.doesNotMatch(apresEnvoi, /Server Action|not found/i, `L'envoi montre l'erreur de Next.js : « ${apresEnvoi} ».`);
  const { rows } = await pool.query(`SELECT 1 FROM envois_devis WHERE chantier_id = $1`, [chantierId]);
  assert.equal(rows.length, 0, "Un envoi est parti alors que l'action était inconnue.");
  console.log("  ✓ l'envoi sur une page vieillie dit de recharger, et rien ne part");

  // --- 3. Et recharger répare : c'est la promesse de la phrase --------------
  await page.unroute("**/*");
  await page.reload({ waitUntil: "networkidle" });
  await page.getByText("Choisir la date", { exact: false }).first().click();
  await page.waitForSelector('[data-atlas="invite-dates"]', { timeout: 30_000 });
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: "Envoyer le devis" }).click();
  await page.waitForTimeout(3500);
  const { rows: apres } = await pool.query(`SELECT 1 FROM envois_devis WHERE chantier_id = $1`, [chantierId]);
  assert.equal(apres.length, 1, "Après rechargement, le devis ne part toujours pas.");
  console.log("  ✓ rechargée, la page envoie le devis");

  await navigateur.close();
  await pool.end();
  console.log("✅ Une page ouverte avant une mise à jour dit de recharger, et rechargée elle envoie.");
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => undefined);
  process.exit(1);
});
