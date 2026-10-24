import assert from "node:assert";
import { PDFDocument, StandardFonts } from "pdf-lib";
import type { BrowserContext, Page } from "playwright";
import { lancerNavigateur } from "./e2e-browser";
import { pool } from "../src/server/db/client";
import { ADRESSE } from "./_adresse";

/**
 * POUR MON COMPTABLE, LOT 3 — arrêter le dossier, et « Mes dossiers justifiés ».
 *
 * Ses choix du 24 octobre 2026 sur `appli/pour-mon-comptable.html` (écrans 2
 * et 5). Les règles et le dépôt sont éprouvés par
 * `test-dossiers-comptables-db.ts` ; celle-ci traverse les écrans :
 *
 *   1. tant qu'une ligne attend sa pièce, « Arrêter et ranger » n'est pas
 *      proposé, et l'écran dit combien attendent ;
 *   2. le premier dossier demande son début, se range, et mène à Mes dossiers ;
 *   3. le dossier suivant part du lendemain, sans demander de début ;
 *   4. Ouvrir sert le PDF, Télécharger le donne à garder ;
 *   5. le bilan du comptable s'ajoute, s'ouvre et se retire ;
 *   6. le menu Année retrouve un dossier d'une autre année ;
 *   7. trois mois avant l'effacement, la carte prévient, et « J'ai compris »
 *      la range.
 *
 * Elle VIDE les dossiers du compte de démonstration : elle ne se joue que sur
 * une base d'essai (`atlas_test…`).
 */

const BASE = ADRESSE;
const MARQUE = "E2E-DOSSIER";

let passed = 0;
let failed = 0;
async function test(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`✅ ${nom}`);
    passed++;
  } catch (err) {
    console.error(`❌ ${nom}`);
    console.error(`   ${err instanceof Error ? err.message : err}`);
    failed++;
  }
}

async function seConnecter(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', "demo@atlas.local");
  await page.fill('input[name="password"]', "demo1234");
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE}/`, { timeout: 30_000 });
  return page;
}

const jour = (decalage: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + decalage);
  return d.toISOString().slice(0, 10);
};

/**
 * Un bilan de DOUZE pages : un vrai bilan en compte vingt à soixante. Un
 * bilan d'une page a laissé passer, le 24 octobre 2026, le plafond de
 * l'attestation décennale (quatre pages) appliqué au bilan ; la simulation
 * de l'année l'a trouvé.
 */
async function unPdf(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const police = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= 12; i++) doc.addPage([595, 842]).drawText(`Bilan 2026, page ${i}`, { x: 60, y: 760, size: 24, font: police });
  return Buffer.from(await doc.save());
}

async function main() {
  const { rows } = await pool.query(
    `SELECT m.entreprise_id AS entreprise FROM membres_entreprise m JOIN users u ON u.id = m.utilisateur_id WHERE u.email = 'demo@atlas.local' LIMIT 1`
  );
  assert.ok(rows[0], "le compte de démonstration est absent : la base n'est pas amorcée");
  const { entreprise } = rows[0] as { entreprise: string };
  const { rows: base } = await pool.query(`SELECT current_database() AS nom`);
  assert.match(base[0].nom, /^atlas_test/, "cette suite vide les dossiers : elle refuse une autre base qu'une base d'essai");

  const nettoyer = async () => {
    await pool.query(`DELETE FROM bilans_comptables WHERE entreprise_id = $1`, [entreprise]);
    await pool.query(`DELETE FROM dossiers_comptables WHERE entreprise_id = $1`, [entreprise]);
    await pool.query(`DELETE FROM mouvements_bancaires WHERE entreprise_id = $1 AND cle LIKE $2`, [entreprise, `${MARQUE}%`]);
  };
  await nettoyer();

  // Le premier dossier tient sur deux jours, hier et aujourd'hui : rien
  // d'autre du compte de démonstration n'y tombe, et la ligne d'essai seule
  // décide s'il peut s'arrêter.
  const hier = jour(-1);
  const aujourdhui = jour(0);
  await pool.query(
    `DELETE FROM mouvements_bancaires WHERE entreprise_id = $1 AND jour BETWEEN $2 AND $3`,
    [entreprise, hier, aujourdhui]
  );
  await pool.query(
    `INSERT INTO mouvements_bancaires (entreprise_id, cle, jour, montant, sens, libelle) VALUES ($1, $2, $3, 23.45, 'sortie', 'CB QUINCAILLERIE E2E')`,
    [entreprise, `${MARQUE}-QUINCAILLERIE`, aujourdhui]
  );

  const browser = await lancerNavigateur();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  const page = await seConnecter(context);
  const carte = page.locator('[data-atlas="dossier-en-cours"]');

  await test("tant qu'une ligne attend sa pièce, le dossier ne se range pas", async () => {
    await page.goto(`${BASE}/termines/comptable`, { waitUntil: "networkidle" });
    await carte.locator('[data-atlas="arreter-mon-dossier"]').click();
    await carte.locator('[data-atlas="date-debut"]').fill(hier);
    // Le compte affiché vient de TOUT le dossier en cours : il en faut au moins un.
    assert.match(await carte.innerText(), /\d+ lignes? attend(ent)? encore un justificatif/);
    assert.equal(await carte.locator('[data-atlas="arreter-et-ranger"]').count(), 0);
  });

  // Ce que le Check up aurait fait : la mention « ticket perdu » validée.
  // Et le reste du dossier en cours, au compte de démonstration, l'est aussi :
  // ce n'est pas l'objet de cette suite.
  await pool.query(
    `UPDATE mouvements_bancaires SET justification = 'ticket_perdu', justifie_le = now() WHERE entreprise_id = $1 AND justification IS NULL`,
    [entreprise]
  );

  await test("le premier dossier demande son début, se range, et mène à Mes dossiers", async () => {
    await page.goto(`${BASE}/termines/comptable`, { waitUntil: "networkidle" });
    await carte.locator('[data-atlas="arreter-mon-dossier"]').click();
    await carte.locator('[data-atlas="date-debut"]').fill(hier);
    await carte.locator('[data-atlas="date-arret"]').fill(aujourdhui);
    await carte.locator('[data-atlas="arreter-et-ranger"]').click();
    await page.waitForURL(`${BASE}/termines/comptable/dossiers`, { timeout: 60_000 });
    await page.waitForSelector('[data-atlas="dossier-range"]');
    const texte = await page.locator('[data-atlas="dossiers-ranges"]').innerText();
    assert.equal(await page.locator('[data-atlas="dossier-range"]').count(), 1);
    assert.match(texte, /Rangé le .*, gardé jusqu’au .* \d{4}, [\d,]+ (Ko|Mo)/);
    assert.match(await page.locator("body").innerText(), /Atlas garde chaque dossier et son bilan dix ans, puis les efface\./);
  });

  await test("le dossier suivant part du lendemain, sans demander de début", async () => {
    await page.goto(`${BASE}/termines/comptable`, { waitUntil: "networkidle" });
    assert.match(await carte.innerText(), /Dossier en cours, depuis le/);
    await carte.locator('[data-atlas="arreter-mon-dossier"]').click();
    assert.equal(await carte.locator('[data-atlas="date-debut"]').count(), 0);
  });

  await test("Ouvrir sert le PDF, Télécharger le donne à garder", async () => {
    await page.goto(`${BASE}/termines/comptable/dossiers`, { waitUntil: "networkidle" });
    const href = await page.locator('[data-atlas="ouvrir-dossier"]').getAttribute("href");
    assert.ok(href);
    const vu = await page.request.get(`${BASE}${href}`);
    assert.equal(vu.status(), 200);
    assert.match(vu.headers()["content-type"] ?? "", /application\/pdf/);
    assert.equal((await vu.body()).subarray(0, 5).toString("latin1"), "%PDF-");
    const garde = await page.request.get(`${BASE}${href}?telecharger=1`);
    assert.match(garde.headers()["content-disposition"] ?? "", /attachment/);
    const inconnu = await page.request.get(`${BASE}/termines/comptable/dossiers/00000000-0000-0000-0000-000000000000`);
    assert.equal(inconnu.status(), 404);
  });

  await test("le bilan du comptable s'ajoute, s'ouvre et se retire", async () => {
    await page.click('[data-atlas="ajouter-bilan"]');
    await page.locator('[data-atlas="fichier-bilan"]').setInputFiles({ name: "Bilan 2026.pdf", mimeType: "application/pdf", buffer: await unPdf() });
    await page.waitForSelector('[data-atlas="bilan-range"]', { timeout: 30_000 });
    const lien = await page.locator('[data-atlas="bilan-range"] a').getAttribute("href");
    const vu = await page.request.get(`${BASE}${lien}`);
    assert.equal(vu.status(), 200);
    assert.equal((await vu.body()).subarray(0, 5).toString("latin1"), "%PDF-");
    await page.locator('[data-atlas="bilan-range"] button', { hasText: "Retirer" }).click();
    await page.waitForFunction(() => document.querySelectorAll('[data-atlas="bilan-range"]').length === 0, null, { timeout: 30_000 });
    assert.equal((await page.request.get(`${BASE}${lien}`)).status(), 404);
  });

  await test("le menu Année retrouve un dossier d'une autre année", async () => {
    const { rows: [d] } = await pool.query(`SELECT fichier_cle, empreinte, taille_octets FROM dossiers_comptables WHERE entreprise_id = $1`, [entreprise]);
    await pool.query(
      `INSERT INTO dossiers_comptables (entreprise_id, du, au, fichier_cle, taille_octets, empreinte, garde_jusqu_au, arrete_par)
       SELECT $1, '2024-01-01', '2024-12-31', $2, $3, $4, '2034-12-31', utilisateur_id FROM membres_entreprise WHERE entreprise_id = $1 LIMIT 1`,
      [entreprise, d.fichier_cle, d.taille_octets, d.empreinte]
    );
    await page.goto(`${BASE}/termines/comptable/dossiers`, { waitUntil: "networkidle" });
    assert.doesNotMatch(await page.locator('[data-atlas="dossiers-ranges"]').innerText(), /2024/);
    await page.selectOption('[data-atlas="filtre-annee"]', "2024");
    assert.match(await page.locator('[data-atlas="dossiers-ranges"]').innerText(), /Du 1ᵉʳ janvier 2024 au 31 décembre 2024/);
  });

  await test("trois mois avant l'effacement, la carte prévient, et « J’ai compris » la range", async () => {
    await pool.query(`UPDATE dossiers_comptables SET garde_jusqu_au = $2 WHERE entreprise_id = $1 AND au = '2024-12-31'`, [entreprise, jour(40)]);
    await page.goto(`${BASE}/termines/comptable/dossiers`, { waitUntil: "networkidle" });
    const echeance = page.locator('[data-atlas="echeance-dossier"]');
    assert.equal(await echeance.count(), 1);
    assert.match(await echeance.innerText(), /Du 1ᵉʳ janvier 2024 au 31 décembre 2024 et son bilan seront effacés le/);
    await echeance.locator("button", { hasText: "J’ai compris" }).click();
    assert.equal(await echeance.count(), 0);
    await page.reload({ waitUntil: "networkidle" });
    assert.equal(await page.locator('[data-atlas="echeance-dossier"]').count(), 0, "la carte revient après « J’ai compris »");
  });

  await nettoyer();
  await browser.close();
  await pool.end();
  console.log(`\n${passed} réussi(s), ${failed} échoué(s)`);
  if (failed > 0) process.exit(1);
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
