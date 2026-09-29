import assert from "node:assert/strict";
import { Pool } from "pg";
import type { Page } from "playwright";
import { lancerNavigateur } from "./e2e-browser";
import { creerPuisFiche } from "./_creer-chantier-e2e";
import { ADRESSE } from "./_adresse";

// **LE PREMIER ENVOI PORTE LE MESSAGE QU'IL A ÉCRIT DANS SES RÉGLAGES.**
//
// Trouvé le 29 septembre 2026 en vérifiant, à sa demande, ce que dit le SMS
// d'un devis : l'appui sur « Envoyer le devis » ouvrait la messagerie avec le
// texte par défaut d'Atlas, jamais le sien. Seule la RELANCE le prenait. Il
// avait écrit son message, et son client ne l'a jamais lu au premier envoi.

const BASE = ADRESSE;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const SA_PHRASE = `Le devis de la maison Atlas ${Date.now()} :`;

let echecs = 0;
async function cas(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

/** Un devis envoyé par son chemin, la case réglée comme il le veut. Rend le SMS préparé et le jeton. */
async function envoyer(page: Page, autreDate: boolean): Promise<{ sms: string; jeton: string }> {
  const nom = `Son message ${Date.now().toString().slice(-6)}`;
  await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Bernard"]', nom);
  await page.fill('input[placeholder="06 12 34 56 78"]', "0612345678");
  const chantierId = await creerPuisFiche(page);

  await page.goto(`${BASE}/chantiers/${chantierId}/devis-complet`, { waitUntil: "networkidle" });
  await page.waitForSelector("text=Total TTC", { timeout: 30_000 });
  await page.getByLabel("Description 1").fill("Taille d'une haie de charmille");
  await page.getByLabel("Prix unitaire 1").fill("420");
  await page.getByLabel("Description 1").click();
  await page.waitForTimeout(1400);
  await page.goto(`${BASE}/chantiers/${chantierId}/devis-complet`, { waitUntil: "networkidle" });
  await page.click("text=Choisir la date");
  const interrupteur = page.getByRole("switch", { name: "Votre client peut proposer une autre date" });
  await interrupteur.waitFor({ state: "visible", timeout: 30_000 });
  if ((await interrupteur.getAttribute("aria-checked")) !== String(autreDate)) await interrupteur.click();
  assert.equal(await interrupteur.getAttribute("aria-checked"), String(autreDate), "la case n'a pas pris l'état voulu");
  await page.getByRole("button", { name: /Envoyer le devis/i }).click();

  const porte = page.locator("a[data-transmission-directe]");
  await porte.waitFor({ state: "attached", timeout: 30_000 });
  const sms = decodeURIComponent((await porte.getAttribute("href")) ?? "");

  let jeton: string | undefined;
  for (let i = 0; i < 60 && !jeton; i++) {
    const { rows } = await pool.query(
      `SELECT e.jeton, e.autre_date_autorisee FROM envois_devis e WHERE e.chantier_id = $1`,
      [chantierId]
    );
    jeton = rows[0]?.jeton as string | undefined;
    if (jeton) assert.equal(rows[0].autre_date_autorisee, autreDate, "l'envoi n'a pas gardé le choix de la case");
    else await page.waitForTimeout(500);
  }
  assert.ok(jeton, "aucun envoi après trente secondes");
  return { sms, jeton };
}

async function main() {
  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext({ viewport: { width: 390, height: 900 } });
  const page = await contexte.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 20_000 });

  // SON message, posé comme l'écran des réglages le pose : dans sa colonne.
  const { rows } = await pool.query(
    `SELECT e.id FROM entreprises e JOIN membres_entreprise m ON m.entreprise_id = e.id
       JOIN users u ON u.id = m.utilisateur_id WHERE u.email = 'demo@atlas.local' LIMIT 1`
  );
  const entrepriseId = rows[0]?.id as string;
  assert.ok(entrepriseId, "entreprise de démonstration introuvable");
  await pool.query(`UPDATE entreprises SET message_client = $2 WHERE id = $1`, [
    entrepriseId,
    `Bonjour [client],\n\n${SA_PHRASE}\n\n[lien]\n\n[entreprise]`,
  ]);

  try {
    const envoi = await envoyer(page, true);
    await cas("le SMS du premier envoi est SON message, pas celui d'Atlas", async () => {
      assert.ok(envoi.sms.includes(SA_PHRASE), `le client lira : « ${envoi.sms.slice(envoi.sms.indexOf("body=") + 5, 200)} »`);
      assert.ok(envoi.sms.includes(`/devis/${envoi.jeton}`), "le SMS ne porte plus le lien");
    });
  } finally {
    await pool.query(`UPDATE entreprises SET message_client = NULL WHERE id = $1`, [entrepriseId]);
  }

  await pool.end();
  await navigateur.close();
  if (echecs > 0) {
    console.error(`❌ ${echecs} cas en échec`);
    process.exit(1);
  }
  console.log("✅ Le premier envoi porte le message qu'il a écrit.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
