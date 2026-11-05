// UNE IDÉE POUR L'APPLI — le geste de l'artisan, dans un vrai navigateur
// (sa planche du 5 novembre 2026, `appli/soignee/une-idee-pour-l-appli.html`).
//
// **Par où il arrive** (`CLAUDE.md` §5 quater) : la ligne en bas des Réglages,
// puis « J'écris mon idée », puis « Envoyer mon idée ». La dictée ne se joue pas
// ici (pas de micro ni de clé sur ce poste) ; son chemin serveur est celui de la
// question dictée à l'assistant, et sa transcription part dans le même envoi.
//
// Ce qui est fixé : rien ne part tant que le tiroir est ouvert, Annuler ne
// laisse rien en base, l'idée revient avec sa date seule, et le compte de
// démonstration, qui n'est pas l'éditeur, ne voit ni « Les idées reçues » ni
// leur adresse. Le côté de l'éditeur est éprouvé en base (`test-idees-db.ts`),
// le banc tournant sans `ATLAS_EDITEUR_EMAIL`.

import { lancerNavigateur } from "./e2e-browser";
import { devices } from "playwright";
import assert from "node:assert/strict";
import { Pool } from "pg";
import { ADRESSE } from "./_adresse";

const BASE = ADRESSE;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function combienEnBase(texte: string): Promise<number> {
  const { rows } = await pool.query("SELECT count(*)::int AS n FROM idees WHERE texte = $1", [texte]);
  return rows[0].n as number;
}

async function main() {
  const navigateur = await lancerNavigateur();
  try {
    const page = await (await navigateur.newContext({ ...devices["iPhone 13"] })).newPage();
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await page.fill('input[name="email"]', "demo@atlas.local");
    await page.fill('input[name="password"]', "demo1234");
    await page.click('button[type="submit"]');
    await page.waitForURL(`${BASE}/`, { timeout: 30_000 });

    // 1. La porte est en bas des Réglages ; celle de l'éditeur n'y est pas.
    await page.goto(`${BASE}/reglages`, { waitUntil: "networkidle" });
    const porte = page.locator('[data-atlas="porte-idee"]');
    await porte.waitFor({ timeout: 15_000 });
    assert.match(await porte.innerText(), /Une idée pour l'appli/);
    assert.equal(await page.locator('[data-atlas="porte-idees-recues"]').count(), 0, "un compte qui n'est pas l'éditeur voit Les idées reçues");

    // 2. Écrire, envoyer : l'idée se pose, mais rien n'est parti.
    await porte.click();
    await page.waitForURL(`${BASE}/reglages/idee`, { timeout: 15_000 });
    await page.locator('[data-atlas="dicter-idee"] .atlas-micro').waitFor({ timeout: 15_000 });
    const garde = `Voir la météo sur le planning ${Date.now()}`;
    await page.click('[data-atlas="ecrire-idee"]');
    await page.fill('[data-atlas="texte-idee"]', garde);
    await page.click('[data-atlas="envoyer-idee"] button');
    const liste = page.locator('[data-atlas="vos-idees"]');
    await liste.locator('[data-atlas="idee"]', { hasText: garde }).waitFor({ timeout: 5_000 });
    assert.match(await page.locator(".atlas-tiroir").innerText(), /Envoyée à l'instant/);
    assert.equal(await combienEnBase(garde), 0, "l'idée est partie avant la fermeture du tiroir");

    // 3. Le tiroir se ferme : l'idée est en base, et revient avec sa date seule.
    await page.waitForTimeout(7_500);
    assert.equal(await combienEnBase(garde), 1, "l'idée n'est pas arrivée en base après le tiroir");
    await page.reload({ waitUntil: "networkidle" });
    const revenue = liste.locator('[data-atlas="idee"]', { hasText: garde });
    await revenue.waitFor({ timeout: 10_000 });
    const lue = await revenue.innerText();
    assert.match(lue, /Envoyée/);
    assert.match(lue, /Le \d{1,2}(er)? [a-zéû]+/);
    assert.doesNotMatch(lue, /\d{1,2}\s*h\s*\d{2}|à la voix|écrite/, "l'idée porte l'heure ou la façon dont elle a été dite");

    // 4. Annuler : rien ne part.
    const regret = `Une idée regrettée ${Date.now()}`;
    await page.click('[data-atlas="ecrire-idee"]');
    await page.fill('[data-atlas="texte-idee"]', regret);
    await page.click('[data-atlas="envoyer-idee"] button');
    await page.locator(".atlas-tiroir button", { hasText: "Annuler" }).click();
    await page.waitForTimeout(7_500);
    assert.equal(await combienEnBase(regret), 0, "une idée annulée est partie quand même");
    assert.equal(await liste.locator('[data-atlas="idee"]', { hasText: regret }).count(), 0);

    // 5. L'adresse de l'éditeur n'existe pas pour ce compte.
    const reponse = await page.goto(`${BASE}/reglages/idees-recues`, { waitUntil: "networkidle" });
    assert.equal(reponse?.status(), 404, "Les idées reçues s'ouvrent à un compte qui n'est pas l'éditeur");

    console.log("✅ Une idée pour l'appli : la porte, l'envoi après le tiroir, Annuler, la date seule, l'éditeur fermé");
  } finally {
    await navigateur.close();
    await pool.query("DELETE FROM idees WHERE texte LIKE 'Voir la météo sur le planning %' OR texte LIKE 'Une idée regrettée %'");
    await pool.end();
  }
}

main().catch((e) => {
  console.error("❌", e instanceof Error ? e.message : e);
  process.exit(1);
});
