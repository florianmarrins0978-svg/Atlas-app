/**
 * ─── « MES PARTENAIRES » SUR LA MAIN D'ŒUVRE DICTÉE, PAR SON GESTE ───────────
 *
 * Son « B » du 4 novembre 2026, sur la planche
 * `appli/soignee/main-oeuvre-dictee-partenaires.html` : quand l'appli demande
 * où mettre la main d'œuvre qu'il a dictée, la pastille « Mes partenaires »
 * ouvre leurs prix, et un prix touché DEVIENT la main d'œuvre.
 *
 * Ce que la suite éprouve, par la porte d'entrée (`CLAUDE.md` §5 quater) : il
 * dicte, la carte s'ouvre, il touche la pastille puis un prix ; la question et
 * le calcul suivent ; la croix revient à son équipe ; une heure se tape ; et
 * le devis porte au centime ce que la carte a montré, au nom du partenaire.
 * Les règles sont éprouvées sans écran (`test-feuille-main-oeuvre.ts`) et en
 * base (`test-main-oeuvre-dictee-db.ts`) ; ce qui n'existe qu'ici, c'est le
 * chemin qu'il prend.
 */
import assert from "node:assert/strict";
import { Pool } from "pg";
import { lancerNavigateur } from "./e2e-browser";
import { ADRESSE } from "./_adresse";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const BASE = ADRESSE;

const DICTEE = `Alors il y a une taille de haie de laurier, vingt mètres de long, et un chêne mort à abattre. On évacue les déchets verts à la déchetterie. J'estime le temps de travail à deux jours deux hommes.`;

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

const espaces = (s: string) => s.replace(/\s+/g, " ").trim();

async function main() {
  const marque = Date.now();
  const ent = (
    await pool.query(
      `SELECT m.entreprise_id FROM membres_entreprise m JOIN users u ON u.id = m.utilisateur_id WHERE u.email = 'demo@atlas.local' LIMIT 1`
    )
  ).rows[0]?.entreprise_id as string | undefined;
  assert.ok(ent, "Le compte de démonstration est absent : la base n'est pas amorcée.");

  // **La question ne se pose plus après trois fois le même choix** (`modeRetenu`) :
  // les suites d'avant y répondent toutes. Sa mémoire, pour le compte de
  // démonstration seulement, repart à zéro, sinon la carte ne s'ouvrirait pas.
  await pool.query(`DELETE FROM precisions_chantier WHERE entreprise_id = $1 AND sujet = 'main-oeuvre'`, [ent]);

  // Deux partenaires à lui : l'un a sa marge, l'autre suit celle de la main
  // d'œuvre. La marge générale est posée pour l'essai, puis rendue.
  const margeAvant = (await pool.query(`SELECT main_oeuvre FROM marges_achat WHERE entreprise_id = $1`, [ent])).rows[0];
  await pool.query(
    `INSERT INTO marges_achat (entreprise_id, main_oeuvre) VALUES ($1, 1.20)
       ON CONFLICT (entreprise_id) DO UPDATE SET main_oeuvre = 1.20`,
    [ent]
  );
  const societe = async (nom: string, marge: string | null) =>
    (
      await pool.query(
        `INSERT INTO societes_achat (entreprise_id, rubrique, nom, marge) VALUES ($1, 'partenaire', $2, $3) RETURNING id`,
        [ent, nom, marge]
      )
    ).rows[0].id as string;
  const prix = async (societeId: string, nom: string, unite: string, prixHt: string) =>
    (
      await pool.query(
        `INSERT INTO prix_achat (entreprise_id, societe_id, nom, unite, prix_ht, source) VALUES ($1, $2, $3, $4, $5, 'essai') RETURNING id`,
        [ent, societeId, nom, unite, prixHt]
      )
    ).rows[0].id as string;
  const durand = `Élagage Durand ${marque}`;
  const morel = `Terrassement Morel ${marque}`;
  const idDurand = await societe(durand, "1.35");
  const idMorel = await societe(morel, null);
  const aLaJournee = await prix(idDurand, "Démontage sur corde", "journée", "450");
  const aLHeure = await prix(idMorel, "Mini-pelle avec chauffeur", "heure", "60");

  await pool.query(`SELECT set_config('app.entreprise_id', $1, false)`, [ent]);
  const chantierId = (
    await pool.query(`INSERT INTO chantiers (entreprise_id, nom) VALUES ($1, $2) RETURNING id`, [ent, `Essai partenaires dictée ${marque}`])
  ).rows[0].id as string;
  await pool.query(
    `INSERT INTO notes_vocales (entreprise_id, chantier_id, storage_key, mime_type, taille_octets, checksum, transcription, transcription_statut)
     VALUES ($1, $2, NULL, 'audio/webm', 0, 'essai', $3, 'reussie')`,
    [ent, chantierId, DICTEE]
  );

  const navigateur = await lancerNavigateur();
  const contexte = await navigateur.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await contexte.newPage();

  try {
    await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
    await page.fill('input[name="email"]', "demo@atlas.local");
    await page.fill('input[name="password"]', "demo1234");
    await page.click('button[type="submit"]');
    await page.waitForURL(`${BASE}/`, { timeout: 20000 });

    await page.goto(`${BASE}/chantiers/${chantierId}/transcription`, { waitUntil: "networkidle" });
    await page.click("text=Créer le devis à partir de ma dictée");
    const carte = page.locator('[data-sorte="main-oeuvre"]');
    await carte.locator('[data-atlas="question-main-oeuvre"]').waitFor({ timeout: 60000 });
    const question = carte.locator('[data-atlas="mo-question"]');
    const detail = carte.locator('[data-atlas="mo-detail"]');
    const pastille = carte.locator('[data-atlas="mo-partenaires"]');
    const deSonEquipe = espaces(await question.innerText());
    const detailEquipe = espaces(await detail.innerText());

    await cas("la pastille « Mes partenaires » est sur la question, éteinte tant qu'il n'en prend pas", async () => {
      assert.equal(await pastille.count(), 1);
      assert.equal(await pastille.getAttribute("aria-pressed"), "false");
      assert.match(detailEquipe, /2 hommes pendant 2 jours/, detailEquipe);
    });

    await cas("un prix à la journée touché devient la main d'œuvre : 2 jours × 450 € × 1,35", async () => {
      await pastille.click();
      await page.locator(`[data-atlas="mo-prix-${aLaJournee}"]`).click();
      await page.locator('[data-atlas="mo-liste"]').waitFor({ state: "detached" });
      assert.equal(espaces(await question.innerText()), "Où mettre les 1 215 € de main d'œuvre ?");
      assert.equal(espaces(await detail.innerText()), "2 jours × 450 € × 1,35");
      assert.match(await carte.locator('[data-atlas="mo-partenaire-pris"]').innerText(), new RegExp(durand));
      assert.equal(await pastille.getAttribute("aria-pressed"), "true");
      assert.equal(await carte.locator('[data-atlas="mo-quantite"]').count(), 0, "à la journée, rien ne se tape");
    });

    await cas("la croix revient à son équipe, sa question et son calcul", async () => {
      await carte.locator('[data-atlas="mo-revenir"]').click();
      assert.equal(espaces(await question.innerText()), deSonEquipe);
      assert.equal(espaces(await detail.innerText()), detailEquipe);
      assert.equal(await carte.locator('[data-atlas="mo-partenaire-pris"]').count(), 0);
    });

    await cas("à l'heure, la quantité se tape et le total suit : 10 h × 60 € × 1,20", async () => {
      await pastille.click();
      await page.locator(`[data-atlas="mo-prix-${aLHeure}"]`).click();
      const quantite = carte.locator('[data-atlas="mo-quantite"]');
      await quantite.fill("10");
      assert.equal(espaces(await question.innerText()), "Où mettre les 720 € de main d'œuvre ?");
      assert.equal(espaces(await detail.innerText()), "10 heures × 60 € × 1,20");
    });

    await cas("le devis porte la ligne de son partenaire, au centime de ce que la carte montrait", async () => {
      await carte.locator("button", { hasText: /^Sur une ligne Main d.œuvre$/ }).click();
      await page.locator("button", { hasText: /^Continuer/ }).first().click();
      await page.waitForURL(`**/chantiers/${chantierId}/devis-complet`, { timeout: 60000 });
      const { rows } = await pool.query(`SELECT libelle, quantite, unite, montant FROM lignes_prix WHERE chantier_id = $1`, [chantierId]);
      const sienne = rows.find((l) => String(l.libelle).includes(morel));
      assert.ok(sienne, `aucune ligne au nom du partenaire : ${rows.map((l) => l.libelle).join(" || ")}`);
      assert.equal(Number(sienne.montant), 720);
      assert.equal(Number(sienne.quantite), 10);
      // L'unité s'écrit comme sur toutes les lignes du devis (`unite-de-ligne.ts`) :
      // « h » pour l'heure, comme la feuille du devis écrit « jour » pour la journée.
      assert.equal(sienne.unite, "h");
      assert.ok(
        !rows.some((l) => /jour\/homme/.test(String(l.unite))),
        `la main d'œuvre de son équipe est restée sur le devis : ${JSON.stringify(rows)}`
      );
    });
  } finally {
    await contexte.close();
    await navigateur.close();
    await pool.query(`DELETE FROM prix_achat WHERE id = ANY($1)`, [[aLaJournee, aLHeure]]);
    await pool.query(`DELETE FROM societes_achat WHERE id = ANY($1)`, [[idDurand, idMorel]]);
    await pool.query(`UPDATE marges_achat SET main_oeuvre = $2 WHERE entreprise_id = $1`, [ent, margeAvant?.main_oeuvre ?? null]);
    await pool.end();
  }

  console.log(`\n${echecs === 0 ? "✅" : "❌"} Mes partenaires sur la main d'œuvre dictée — ${echecs} échec(s).`);
  process.exit(echecs === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
