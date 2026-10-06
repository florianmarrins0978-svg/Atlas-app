import assert from "node:assert/strict";
import { Pool } from "pg";
import { lancerNavigateur } from "./e2e-browser";
import { creerPuisFiche } from "./_creer-chantier-e2e";
import { cocherLaDemandeExpresse } from "./_demande-expresse-e2e";
import { ADRESSE } from "./_adresse";

// **RETIRER UN DEVIS ENVOYÉ DE LA LISTE NE COUPE PAS LE LIEN DU CLIENT.**
//
// Sa règle du 29 septembre 2026 : *« si l'utilisateur veut les retirer de la
// liste des chantiers en cours, il doit pouvoir en les slidant sur le côté,
// mais ça ne doit pas impacter le lien cliquable envoyé au client ! Il doit
// quand même pouvoir l'ouvrir »*.
//
// Ce que le glissement faisait jusque-là sur un devis envoyé : il SUPPRIMAIT
// le chantier. Le lien s'ouvrait encore, mais si le client acceptait ensuite,
// le chantier était posé au planning en restant supprimé : ni au planning, ni
// dans les notifications. Son acceptation se perdait sans un mot.
//
// Tout se joue par SES gestes : le devis rédigé et envoyé à l'écran, la ligne
// glissée, la page du client ouverte dans un autre navigateur.

const BASE = ADRESSE;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

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

async function main() {
  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext({ hasTouch: true, viewport: { width: 390, height: 900 } });
  const page = await contexte.newPage();

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 20_000 });

  // ── Un devis parti chez un client, par le chemin du patron ──
  const nom = `Retrait ${Date.now().toString().slice(-6)}`;
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
  await page.getByRole("button", { name: /Envoyer le devis/i }).click();

  // Attendre l'ÉTAT, jamais un délai fixe.
  let jeton: string | undefined;
  for (let i = 0; i < 60 && !jeton; i++) {
    const { rows } = await pool.query(
      `SELECT e.jeton FROM envois_devis e JOIN devis d ON d.id = e.devis_id WHERE d.chantier_id = $1`,
      [chantierId]
    );
    jeton = rows[0]?.jeton as string | undefined;
    if (!jeton) await page.waitForTimeout(500);
  }
  assert.ok(jeton, "aucun envoi après trente secondes : ce n'est pas le retrait qui est en cause");

  // ── Il glisse la ligne et la retire ──
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.locator("[data-atlas-vivant='oui']").first().waitFor({ state: "attached", timeout: 30_000 });
  // Par son NOM : la ligne d'un devis envoyé mène au planning, son adresse ne
  // porte pas l'identifiant du chantier.
  const ligne = page.locator(".atlas-ligne", { hasText: nom });
  assert.equal(await ligne.count(), 1, "le devis envoyé n'est pas dans la liste avant le retrait");
  await ligne.locator(".atlas-glisse").evaluate((el) => {
    el.scrollTo({ left: el.scrollWidth, behavior: "instant" as ScrollBehavior });
  });
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: new RegExp(`^Retirer le chantier .*${nom}$`) }).click();
  // Le tiroir retient la ligne six secondes : l'écriture n'a lieu qu'à sa fermeture.
  await page.waitForTimeout(7_500);

  await cas("la ligne quitte la liste des chantiers en cours", async () => {
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    assert.equal(await page.locator(".atlas-ligne", { hasText: nom }).count(), 0);
  });

  await cas("rien n'est effacé : le chantier et son devis restent en base", async () => {
    const { rows } = await pool.query(`SELECT deleted_at FROM chantiers WHERE id = $1`, [chantierId]);
    assert.equal(rows[0]?.deleted_at, null, "le chantier a été supprimé : la réponse du client se perdrait");
  });

  // ── Le client ouvre son lien, et accepte ──
  await cas("le client ouvre encore son lien, et peut accepter", async () => {
    const cotClient = await navigateur.newContext();
    const pageClient = await cotClient.newPage();
    await pageClient.goto(`${BASE}/devis/${jeton}`, { waitUntil: "networkidle" });
    const bouton = pageClient.getByRole("button", { name: /J'accepte ce devis/i });
    await bouton.waitFor({ state: "visible", timeout: 30_000 });
    const dateProposee = pageClient.locator('input[type="radio"][name="choixDate"]').first();
    await dateProposee.waitFor({ state: "visible", timeout: 15_000 });
    await dateProposee.check();
    await pageClient.waitForTimeout(400);
    await cocherLaDemandeExpresse(pageClient);
    await bouton.click();
    let reponse: string | null = null;
    for (let i = 0; i < 30 && reponse !== "acceptee"; i++) {
      const { rows } = await pool.query(
        `SELECT e.reponse FROM envois_devis e JOIN devis d ON d.id = e.devis_id WHERE d.chantier_id = $1`,
        [chantierId]
      );
      reponse = rows[0]?.reponse ?? null;
      if (reponse !== "acceptee") await pageClient.waitForTimeout(500);
    }
    assert.equal(reponse, "acceptee");
    await cotClient.close();
  });

  await cas("son acceptation lui arrive : la carte sur l'accueil, et le chantier au planning", async () => {
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    assert.equal(
      await page.locator(`[data-atlas="carte-reponse"][data-chantier="${chantierId}"]`).count(),
      1,
      "aucune carte : le client a accepté et le patron ne le saura jamais"
    );
    const { rows } = await pool.query(
      `SELECT date_planifiee, deleted_at FROM chantiers WHERE id = $1`,
      [chantierId]
    );
    assert.ok(rows[0]?.date_planifiee, "le chantier n'a pas de date");
    assert.equal(rows[0]?.deleted_at, null, "le chantier est au planning, mais supprimé : invisible");
  });

  await pool.end();
  await navigateur.close();
  if (echecs > 0) {
    console.error(`❌ ${echecs} cas en échec`);
    process.exit(1);
  }
  console.log("✅ Retirer un devis envoyé de la liste ne coupe pas le lien du client.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
