// LES ÉQUIPES JOUR PAR JOUR — sa plainte du 15 septembre 2026, jouée à l'écran.
//
// *« Sur le chantier de 8 jours, si je mets Antoine et Julien le premier jour,
// ça les met automatiquement sur les 8 jours, ça c'est bien. Mais si le 4e jour
// je décide de ne pas mettre Julien, ça l'enlève partout et ça faut pas ! »*
//
// La règle est éprouvée sans base (`test-equipes-par-jour.ts`) puis en base
// (`test-equipes-par-jour-db.ts`). Ce qui reste à prouver, c'est que le geste
// du PATRON — ouvrir la carte du 4e jour, décocher Julien — atteint la base
// avec le bon jour, et que l'écran repeint ensuite ce que la base dit :
// Julien encore là le 1er jour, plus là le 4e.

import { lancerNavigateur } from "./e2e-browser";
import assert from "node:assert/strict";
import { Pool } from "pg";
import {
  creerChantier,
  planifierChantier,
  basculerEquipeDuChantier,
  mettreAJourDureeEquipe,
} from "../src/server/repositories/chantiers";
import { nommerEquipe } from "../src/server/repositories/equipes";
import { creneauxDuChantier } from "../src/lib/disponibilites";
import type { Ctx } from "../src/server/repositories/context";
import { ADRESSE } from "./_adresse";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const BASE = ADRESSE;

let echecs = 0;
async function essai(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

/**
 * Un lundi loin devant, hors du mois courant : le planning refuse le passé.
 * **Trois semaines après celui de `test-planning-e2e`** : les deux suites
 * partagent la base de la batterie, et deux chantiers sur la même semaine
 * feraient lire à l'une les pastilles de l'autre.
 */
function lundiDansDeuxMois(): string {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + 2);
  while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1);
  d.setUTCDate(d.getUTCDate() + 21);
  return d.toISOString().slice(0, 10);
}

async function main() {
  console.log("=== Les équipes jour par jour, à l'écran ===\n");

  const { rows } = await pool.query(
    `SELECT me.utilisateur_id AS u, me.entreprise_id AS e
       FROM membres_entreprise me
       JOIN users usr ON usr.id = me.utilisateur_id
      WHERE usr.email = 'demo@atlas.local' AND me.role = 'proprietaire'
      LIMIT 1`
  );
  assert.ok(rows[0], "le compte de démonstration n'est pas patron : la base n'est pas amorcée");
  const ctx: Ctx = { utilisateurId: rows[0].u, entrepriseId: rows[0].e };

  // ─── Le décor : SON cas, un chantier de huit jours, Antoine et Julien ───
  const LUNDI = lundiDansDeuxMois();
  const JOURS = [...new Set(creneauxDuChantier({ jour: LUNDI, moment: "matin" }, 16).map((c) => c.jour))];
  const J1 = JOURS[0];
  const J4 = JOURS[3];
  const ANTOINE = 1;
  const JULIEN = 2;

  await pool.query(`UPDATE entreprises SET nombre_equipes = 2, nombre_salaries = 2 WHERE id = $1`, [
    ctx.entrepriseId,
  ]);
  await nommerEquipe(ctx, ANTOINE, "Antoine");
  await nommerEquipe(ctx, JULIEN, "Julien");

  const chantier = await creerChantier(ctx, { nom: `Huit jours ${Date.now()}` });
  await mettreAJourDureeEquipe(ctx, chantier.id, { dureePrevue: "8 jours" });
  await planifierChantier(ctx, chantier.id, LUNDI, { demi: "matin" });
  const marque = await pool.query(`UPDATE chantiers SET devis_envoye_at = now() WHERE id = $1`, [chantier.id]);
  assert.equal(marque.rowCount, 1, "le décor n'a pas pu marquer le devis envoyé");
  // Cochés le premier jour : ils sont sur les huit — « ça c'est bien ».
  await basculerEquipeDuChantier(ctx, chantier.id, "matin", ANTOINE, J1);
  const avant = await basculerEquipeDuChantier(ctx, chantier.id, "matin", JULIEN, J1);
  assert.deepEqual(avant?.matin, [ANTOINE, JULIEN], "le décor n'a pas coché les deux");

  /** Les jours où Julien est écrit le matin, d'après la BASE. */
  const joursDeJulien = async () => {
    const { rows } = await pool.query(
      `SELECT ec.jour::text AS jour
         FROM equipes_du_chantier ec JOIN equipes e ON e.id = ec.equipe_id
        WHERE ec.chantier_id = $1 AND ec.demi = 'matin' AND e.rang = $2
        ORDER BY ec.jour`,
      [chantier.id, JULIEN]
    );
    return rows.map((r) => r.jour as string | null);
  };

  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext({ viewport: { width: 390, height: 844 } });
  const page = await contexte.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });

  const toucherLeJour = async (jour: string) => {
    const dejaOuverte = page.locator(`[data-atlas="carte-jour"][data-jour="${jour}"]`);
    if (await dejaOuverte.count()) return;
    for (let i = 0; i < 24; i++) {
      if (await page.locator(`[data-atlas="grille-mois"] [data-jour="${jour}"]`).count()) break;
      await page.click('button[aria-label="Mois suivant"]');
      await page.waitForTimeout(150);
    }
    const laCase = page.locator(`[data-atlas="grille-mois"] [data-jour="${jour}"]`);
    assert.ok(await laCase.count(), `le calendrier n'atteint pas le ${jour}`);
    await laCase.click();
    await page.waitForSelector(`[data-atlas="carte-jour"][data-jour="${jour}"]`, { timeout: 15_000 });
  };

  const attendre = async (quoi: string, vrai: () => Promise<boolean>) => {
    for (let i = 0; i < 40; i++) {
      if (await vrai()) return;
      await page.waitForTimeout(250);
    }
    throw new Error(`dix secondes plus tard, toujours pas : ${quoi}`);
  };

  /** Le bloc de CE chantier dans la carte du jour — jamais celui d'un voisin. */
  const carteDe = (jour: string, id: string) =>
    page.locator(`[data-atlas="carte-jour"][data-jour="${jour}"] [data-atlas="bloc-chantier"][data-chantier="${id}"]`);

  await page.goto(`${BASE}/planning`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('[data-atlas="grille-mois"]', { timeout: 30_000 });

  await essai("le 4e jour annonce Antoine et Julien, avant le geste", async () => {
    await toucherLeJour(J4);
    const pastille = carteDe(J4, chantier.id).locator('[data-bloc="matin"] [data-atlas="equipe"]').first();
    await pastille.waitFor({ state: "visible", timeout: 15_000 });
    const texte = await pastille.innerText();
    assert.ok(texte.includes("Julien"), `Julien n'est pas annoncé le 4e jour : « ${texte} »`);
  });

  await essai("SA PLAINTE : décocher Julien le 4e jour ne le retire que ce jour-là", async () => {
    const carte = carteDe(J4, chantier.id);
    await carte.locator('[data-bloc="matin"] [data-atlas="equipe"]').first().click();
    await carte.locator(`[data-bloc="matin"] [data-choix="${JULIEN}"]`).first().click();
    await attendre("Julien perd un jour, et un seul", async () => (await joursDeJulien()).length === 7);
    const jours = await joursDeJulien();
    assert.deepEqual(
      jours,
      JOURS.filter((j) => j !== J4),
      `Julien devrait rester sur sept jours, la base dit : ${JSON.stringify(jours)}`
    );
  });

  await essai("l'écran repeint : plus de Julien le 4e jour, Antoine reste", async () => {
    const carte = carteDe(J4, chantier.id);
    await carte.locator('[data-bloc="matin"] [data-fini="1"]').first().click();
    const pastille = carte.locator('[data-bloc="matin"] [data-atlas="equipe"]').first();
    await pastille.waitFor({ state: "visible", timeout: 15_000 });
    const texte = await pastille.innerText();
    assert.ok(!texte.includes("Julien"), `Julien est encore annoncé le 4e jour : « ${texte} »`);
    assert.ok(texte.includes("Antoine"), `Antoine a disparu avec Julien : « ${texte} »`);
  });

  await essai("le 1er jour annonce toujours Julien — « ça l'enlève partout » n'est plus vrai", async () => {
    await toucherLeJour(J1);
    const pastille = carteDe(J1, chantier.id).locator('[data-bloc="matin"] [data-atlas="equipe"]').first();
    await pastille.waitFor({ state: "visible", timeout: 15_000 });
    const texte = await pastille.innerText();
    assert.ok(texte.includes("Julien"), `Julien a été retiré du 1er jour : « ${texte} »`);
  });

  await essai("recocher Julien le 4e jour le remet ce jour-là — et les suivants sont déjà là", async () => {
    await toucherLeJour(J4);
    const carte = carteDe(J4, chantier.id);
    await carte.locator('[data-bloc="matin"] [data-atlas="equipe"]').first().click();
    await carte.locator(`[data-bloc="matin"] [data-choix="${JULIEN}"]`).first().click();
    await attendre("Julien est de retour le 4e jour", async () => (await joursDeJulien()).includes(J4));
    assert.deepEqual(await joursDeJulien(), JOURS, "des jours en double ou en moins");
  });

  await navigateur.close();
  await pool.end();
  console.log(`\n${echecs === 0 ? "✅" : "❌"} Équipes jour par jour à l'écran — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
