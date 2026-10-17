import assert from "node:assert/strict";
import { lancerNavigateur } from "./e2e-browser";
import { pool } from "../src/server/db/client";
import { creerPuisFiche } from "./_creer-chantier-e2e";
import { ADRESSE } from "./_adresse";

// **« Va regarder s'il n'y a pas d'autres problèmes. »** Le patron, le
// 17 octobre 2026, après deux pannes dans la soirée qui avaient la même
// racine : une page ouverte avant que son espace change de version.
//
// Deux familles de gestes étaient déjà couvertes ce soir-là : ceux qui
// attrapent le refus (ils le disent) et ceux qui le jettent jusqu'à l'écran
// d'erreur (il recharge seul, `estPageVieillie`). Restait la troisième, la
// pire : un enregistrement lancé sans attendre de réponse. Le titre du devis
// s'enregistre en quittant le champ, par un `void` : sur une page vieillie,
// le refus n'allait nulle part. Le titre semblait écrit, il ne l'était pas.
//
// Le veilleur global des promesses rejetées (`VeilleReponseServeur`) le dit
// désormais, avec le seul geste qui répare.

const BASE = ADRESSE;

async function main() {
  const navigateur = await lancerNavigateur();
  const page = await (await navigateur.newContext({ viewport: { width: 390, height: 664 } })).newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });

  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Bernard"]', `Geste muet ${Date.now()}`);
  await page.fill('input[placeholder="06 12 34 56 78"]', "0612345678");
  const chantierId = await creerPuisFiche(page);
  await page.goto(`${BASE}/chantiers/${chantierId}/devis-complet`, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-atlas="titre-devis"]', { timeout: 40_000 });

  // La page est ouverte : l'espace « bascule » maintenant.
  await page.route("**/*", async (route) => {
    const entetes = route.request().headers();
    if (!entetes["next-action"]) return route.continue();
    await route.continue({ headers: { ...entetes, "next-action": "0".repeat(42) } });
  });

  const titre = page.locator('[data-atlas="titre-devis"]');
  await titre.fill("Taille des haies");
  await page.getByText("DEVIS", { exact: true }).first().click();

  const alerte = page.locator('[role="alert"]', { hasText: /Rechargez/ });
  await alerte.first().waitFor({ state: "visible", timeout: 15_000 }).catch(() => undefined);
  assert.ok(
    await alerte.first().isVisible(),
    "Le titre du devis s'est perdu sans un mot : rien ne dit de recharger."
  );
  console.log("  ✓ un enregistrement lancé sans attendre dit de recharger quand la page a vieilli");

  // Le bouton recharge, et la page rechargée enregistre pour de bon.
  await page.unroute("**/*");
  await Promise.all([page.waitForEvent("load"), alerte.getByRole("button", { name: "Recharger" }).click()]);
  await page.waitForSelector('[data-atlas="titre-devis"]', { timeout: 40_000 });
  await page.locator('[data-atlas="titre-devis"]').fill("Taille des haies");
  await page.getByText("DEVIS", { exact: true }).first().click();
  await page.waitForTimeout(2000);
  const { rows } = await pool.query(`SELECT titre FROM devis WHERE chantier_id = $1`, [chantierId]);
  assert.equal(rows[0]?.titre, "Taille des haies", "Rechargée, la page n'enregistre toujours pas le titre.");
  console.log("  ✓ rechargée, la page enregistre le titre");

  await navigateur.close();
  await pool.end();
  console.log("✅ Un geste qui n'attend pas sa réponse ne se perd plus sans un mot.");
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => undefined);
  process.exit(1);
});
