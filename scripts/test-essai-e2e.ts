import { lancerNavigateur, ECRAN_DU_PATRON } from "./e2e-browser";
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { Pool } from "pg";
import { ADRESSE } from "./_adresse";

/**
 * L'ESSAI DE QUINZE JOURS, PAR SES YEUX — la planche du 10 septembre 2026,
 * `appli/l-essai-et-ce-qui-est-ferme.html`, onglet par onglet :
 *
 *   · jour 1 : le ruban en tête de l'accueil, calme ;
 *   · jour 13 : le ruban en rouge, rien d'autre ne bouge ;
 *   · jour 16 : « Essai terminé — lecture seule », le bouton de création
 *     éteint et la phrase dessous, l'écran de création qui le dit aussi ;
 *   · « Artisan » : les absences et les retours remplacés par « c'est dans
 *     Entreprise », la pastille des retours éteinte ;
 *   · « Entreprise » : tout revient.
 *
 * **Le compte de démonstration n'a pas d'essai** — c'est son Atlas à lui. La
 * suite lui en pose un le temps de la mesure, sous le rôle qui traverse la RLS,
 * et le retire à la fin : une ligne oubliée mettrait toutes les suites
 * suivantes en lecture seule.
 */

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const BASE = ADRESSE;
const CAPTURES = process.env.CAPTURES_E2E ?? "/tmp/captures-atlas";
const JOUR = 86_400_000;

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
  const contexte = await navigateur.newContext({ ...ECRAN_DU_PATRON });
  const page = await contexte.newPage();
  mkdirSync(CAPTURES, { recursive: true });

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 20_000 });

  const { rows: demo } = await pool.query(
    `SELECT entreprise_id FROM utilisateurs WHERE email = 'demo@atlas.local' LIMIT 1`
  );
  assert.ok(demo[0]?.entreprise_id, "le compte de démonstration est absent : la base n'est pas amorcée");
  const entrepriseId: string = demo[0].entreprise_id;

  const poserLAbonnement = (statut: string, formule: string, finDans: number) =>
    pool.query(
      `INSERT INTO abonnements (entreprise_id, formule, periodicite, statut, periode_fin)
       VALUES ($1, $2, 'mensuelle', $3, $4)
       ON CONFLICT (entreprise_id) DO UPDATE
         SET formule = EXCLUDED.formule, statut = EXCLUDED.statut, periode_fin = EXCLUDED.periode_fin`,
      [entrepriseId, formule, statut, new Date(Date.now() + finDans)]
    );
  const retirerLAbonnement = () => pool.query(`DELETE FROM abonnements WHERE entreprise_id = $1`, [entrepriseId]);

  try {
    await cas("sans essai, l'accueil ne porte AUCUN ruban — son Atlas à lui ne bouge pas", async () => {
      await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
      assert.equal(await page.locator('[data-atlas="ruban-essai"]').count(), 0);
    });

    await cas("jour 1 : le ruban en tête de l'accueil, « 15 jours restants », calme", async () => {
      await poserLAbonnement("essai", "illimite", 15 * JOUR - 60_000);
      await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
      const ruban = page.locator('[data-atlas="ruban-essai"]');
      await ruban.waitFor({ timeout: 10_000 });
      assert.equal(await ruban.getAttribute("data-etat"), "en-cours");
      assert.equal(await ruban.getAttribute("data-ton"), "calme");
      assert.match(await ruban.innerText(), /Essai gratuit — 15 jours restants/);
      // Le ruban est TOUT EN HAUT : au-dessus du titre, pas au milieu des chantiers.
      const boite = await ruban.boundingBox();
      assert.ok(boite && boite.y < 60, `le ruban est à ${boite?.y} px du haut`);
      await page.screenshot({ path: `${CAPTURES}/essai-jour-1.png` });
      // Rien n'est éteint : il crée.
      assert.equal(await page.locator('[data-atlas="nouveau-chantier"][aria-disabled="true"]').count(), 0);
    });

    await cas("jour 13 : le ruban passe au rouge, et RIEN d'autre ne s'ouvre", async () => {
      await poserLAbonnement("essai", "illimite", 3 * JOUR - 60_000);
      await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
      const ruban = page.locator('[data-atlas="ruban-essai"]');
      assert.match(await ruban.innerText(), /3 jours restants/);
      assert.equal(await ruban.getAttribute("data-ton"), "alerte", "le ruban est resté doré à trois jours de la fin");
      assert.equal(await page.locator('[role="dialog"]').count(), 0, "une fenêtre s'est ouverte");
    });

    await cas("jour 16 : « lecture seule », le bouton de création éteint, la phrase dessous", async () => {
      await poserLAbonnement("essai", "illimite", -JOUR);
      await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
      const ruban = page.locator('[data-atlas="ruban-essai"]');
      assert.equal(await ruban.getAttribute("data-etat"), "termine");
      assert.match(await ruban.innerText(), /Essai terminé — lecture seule/);
      const bouton = page.locator('[data-atlas="nouveau-chantier"]');
      assert.equal(await bouton.getAttribute("aria-disabled"), "true");
      const phrase = page.locator('[data-atlas="lecture-seule"]');
      assert.match(await phrase.innerText(), /Votre essai est terminé/);
      await page.screenshot({ path: `${CAPTURES}/essai-jour-16.png` });
      // Ses chantiers sont TOUJOURS là : rien ne disparaît de l'écran.
      assert.ok((await page.locator('[data-atlas="compteur"]').count()) > 0, "la rubrique des chantiers a disparu");
    });

    await cas("jour 16 : l'écran de création le dit aussi, avant la première case", async () => {
      await page.goto(`${BASE}/chantiers/nouveau`, { waitUntil: "networkidle" });
      await page.locator('[data-atlas="ecran-lecture-seule"]').waitFor({ timeout: 10_000 });
      assert.equal(await page.locator('input[placeholder="Bernard"]').count(), 0, "le formulaire s'affiche quand même");
    });

    await cas("jour 16 : l'écran d'abonnement dit « Essai terminé » et propose de S'ABONNER, pas de changer", async () => {
      await page.goto(`${BASE}/reglages/abonnement`, { waitUntil: "networkidle" });
      const texte = await page.locator("body").innerText();
      assert.match(texte, /Essai terminé/);
      assert.match(texte, /S’abonner/);
      assert.doesNotMatch(texte, /Changer de formule/);
    });

    await cas("« Artisan » : les absences sont remplacées par « c'est dans Entreprise », à leur place", async () => {
      await poserLAbonnement("actif", "artisan", 30 * JOUR);
      await page.goto(`${BASE}/reglages/equipe`, { waitUntil: "networkidle" });
      const carte = page.locator('[data-atlas="fonction-reservee-absences"]');
      await carte.waitFor({ timeout: 10_000 });
      assert.match(await carte.innerText(), /Les absences sont dans « Entreprise »/);
      assert.equal(await page.getByText("Absences", { exact: true }).count(), 0, "la section des absences est encore là");
      await page.screenshot({ path: `${CAPTURES}/artisan-absences.png` });
    });

    await cas("« Artisan » : l'écran des retours reste atteignable, et dit la même chose", async () => {
      await page.goto(`${BASE}/termines/retours`, { waitUntil: "networkidle" });
      const carte = page.locator('[data-atlas="fonction-reservee-retours"]');
      await carte.waitFor({ timeout: 10_000 });
      assert.match(await carte.innerText(), /Les retours sont dans « Entreprise »/);
      await page.screenshot({ path: `${CAPTURES}/artisan-retours.png` });
    });

    await cas("« Artisan » : l'onglet des retours reste dans Terminés, sa pastille est éteinte", async () => {
      await page.goto(`${BASE}/termines`, { waitUntil: "networkidle" });
      assert.equal(await page.locator('[data-atlas="onglet-retours"]').count(), 1, "l'onglet a disparu");
      assert.equal(await page.locator('[data-atlas="compte-des-non-lus"]').count(), 0, "la pastille est allumée");
    });

    await cas("« Entreprise » : les absences et les retours reviennent", async () => {
      await poserLAbonnement("actif", "entreprise", 30 * JOUR);
      await page.goto(`${BASE}/reglages/equipe`, { waitUntil: "networkidle" });
      assert.equal(await page.locator('[data-atlas="fonction-reservee-absences"]').count(), 0);
      assert.ok((await page.getByText("Absences", { exact: true }).count()) > 0, "la section des absences n'est pas revenue");
      await page.goto(`${BASE}/termines/retours`, { waitUntil: "networkidle" });
      assert.equal(await page.locator('[data-atlas="fonction-reservee-retours"]').count(), 0);
    });
  } finally {
    await retirerLAbonnement();
    await navigateur.close();
    await pool.end();
  }

  console.log(`\n${echecs === 0 ? "✅" : "❌"} ${echecs} échec(s)\n`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
