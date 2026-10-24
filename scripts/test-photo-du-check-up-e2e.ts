import assert from "node:assert";
import { createHash, randomBytes } from "node:crypto";
import path from "node:path";
import sharp from "sharp";
import type { BrowserContext, Page } from "playwright";
import { lancerNavigateur } from "./e2e-browser";
import { pool } from "../src/server/db/client";
import { ADRESSE } from "./_adresse";

/**
 * POUR MON COMPTABLE, LOT 5 — la photo prise depuis la ligne, et le ticket
 * recopié ligne par ligne.
 *
 *   1. « Photographier le ticket » ouvre la prise de vue SUR la carte, pas Ma TVA ;
 *   2. la photo part redressée et réduite (le ticket, pas la table) ;
 *   3. la feuille de Ma TVA s'ouvre, et « Ajouter aux achats » relie le ticket
 *      à SA ligne : la carte s'en va ;
 *   4. un ticket recopié se lit en entier sur la page du comptable, sa ligne
 *      du total surlignée.
 *
 * **La lecture par l'IA n'est pas éprouvée ici** : ce poste n'a pas de clé
 * (`CLAUDE.md` §1 ter). La feuille s'ouvre donc vide, comme chez lui quand la
 * lecture échoue ; ce que la lecture rend est éprouvé par
 * `test-lecture-ticket.ts`, et ce qu'on en fait par `test-ticket-imprime.ts`.
 */

const BASE = ADRESSE;
const MARQUE = "E2E-PHOTO";
const RACINE_STOCKAGE = path.join(process.cwd(), ".storage");

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

/** Un ticket blanc, penché, sur une table en bois : 1 200 × 1 600, comme une photo réduite. */
async function photoDeTicket(): Promise<Buffer> {
  const W = 1200;
  const H = 1600;
  const data = Buffer.alloc(W * H * 3);
  const a = (7 * Math.PI) / 180;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const dx = x - W / 2;
      const dy = y - H / 2;
      const u = dx * Math.cos(a) + dy * Math.sin(a) + 220;
      const v = -dx * Math.sin(a) + dy * Math.cos(a) + 520;
      const k = (y * W + x) * 3;
      const surLeTicket = u >= 0 && v >= 0 && u < 440 && v < 1040;
      const encre = surLeTicket && Math.floor(v / 36) % 2 === 1 && v % 36 < 7 && u > 40 && u < 400;
      const [r, g, b] = !surLeTicket ? [122, 74, 36] : encre ? [40, 40, 38] : [244, 242, 236];
      data[k] = r;
      data[k + 1] = g;
      data[k + 2] = b;
    }
  return sharp(data, { raw: { width: W, height: H, channels: 3 } }).jpeg({ quality: 90 }).toBuffer();
}

async function main() {
  const { rows } = await pool.query(
    `SELECT m.entreprise_id AS entreprise, m.utilisateur_id AS utilisateur FROM membres_entreprise m JOIN users u ON u.id = m.utilisateur_id WHERE u.email = 'demo@atlas.local' LIMIT 1`
  );
  assert.ok(rows[0], "le compte de démonstration est absent : la base n'est pas amorcée");
  const { entreprise, utilisateur } = rows[0] as { entreprise: string; utilisateur: string };
  const { rows: base } = await pool.query(`SELECT current_database() AS nom`);
  assert.match(base[0].nom, /^atlas_test/, "cette suite touche aux dossiers : elle refuse une autre base qu'une base d'essai");

  const nettoyer = async () => {
    await pool.query(`DELETE FROM dossiers_comptables WHERE entreprise_id = $1 AND fichier_cle = 'e2e-photo'`, [entreprise]);
    await pool.query(`DELETE FROM mouvements_bancaires WHERE entreprise_id = $1 AND cle LIKE $2`, [entreprise, `${MARQUE}%`]);
    await pool.query(`DELETE FROM achats_tva WHERE entreprise_id = $1 AND fournisseur LIKE $2`, [entreprise, `${MARQUE}%`]);
  };
  await nettoyer();
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const { rows: ligne } = await pool.query(
    `INSERT INTO mouvements_bancaires (entreprise_id, cle, jour, montant, sens, libelle) VALUES ($1, $2, $3, 37.40, 'sortie', 'CB QUINCAILLERIE PHOTO') RETURNING id`,
    [entreprise, `${MARQUE}-QUINCAILLERIE`, aujourdhui]
  );
  const mouvementId = ligne[0].id as string;

  const browser = await lancerNavigateur();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await seConnecter(context);
  const carte = page.locator('[data-atlas="ligne-a-regarder"]', { hasText: "37,40" });

  await test("« Photographier le ticket » se fait sur la carte, sans partir vers Ma TVA", async () => {
    await page.goto(`${BASE}/termines/comptable`, { waitUntil: "networkidle" });
    await carte.waitFor();
    assert.equal(await carte.locator('a[data-atlas="photographier-ticket"]').count(), 0, "le bouton mène encore ailleurs");
    await carte.locator('[data-atlas="photo-du-ticket-entree"]').setInputFiles({ name: "ticket.jpg", mimeType: "image/jpeg", buffer: await photoDeTicket() });
    await page.locator('[data-atlas="ajouter-aux-achats"]').waitFor({ timeout: 60_000 });
    assert.equal(new URL(page.url()).pathname, "/termines/comptable");
  });

  await test("la feuille de Ma TVA s'ouvre, et le ticket rejoint SA ligne", async () => {
    const feuille = page.locator('[data-atlas="ajouter-aux-achats"]').locator("xpath=..");
    await feuille.locator('input[placeholder="Station, magasin…"]').fill(`${MARQUE} QUINCAILLERIE`);
    await feuille.locator('[data-nature="materiel"]').click();
    await feuille.locator('input[placeholder="0,00 €"]').fill("37,40");
    await page.click('[data-atlas="ajouter-aux-achats"]');
    await page.waitForFunction(
      () => ![...document.querySelectorAll('[data-atlas="ligne-a-regarder"]')].some((e) => e.textContent?.includes("37,40")),
      null,
      { timeout: 30_000 }
    );
    const { rows: r } = await pool.query(`SELECT justification, relie_par, achat_id FROM mouvements_bancaires WHERE id = $1`, [mouvementId]);
    assert.equal(r[0].justification, "ticket");
    assert.equal(r[0].relie_par, "patron");
    assert.ok(r[0].achat_id);
  });

  await test("la photo rangée est le ticket redressé et réduit, pas la table", async () => {
    const { rows: r } = await pool.query(`SELECT photo_cle FROM achats_tva WHERE fournisseur = $1`, [`${MARQUE} QUINCAILLERIE`]);
    assert.ok(r[0]?.photo_cle, "le ticket n'a pas gardé sa photo");
    const meta = await sharp(path.join(RACINE_STOCKAGE, r[0].photo_cle)).metadata();
    assert.equal(meta.width, 1000, `la photo fait ${meta.width} px de large : elle n'a pas été redressée`);
    assert.ok((meta.height ?? 0) / 1000 > 2 && (meta.height ?? 0) / 1000 < 2.7, `proportions ${meta.height}/1000 : ce n'est pas le ticket`);
  });

  await test("un ticket recopié se lit en entier chez le comptable, son total surligné", async () => {
    const { rows: a } = await pool.query(`SELECT achat_id FROM mouvements_bancaires WHERE id = $1`, [mouvementId]);
    await pool.query(`UPDATE achats_tva SET lignes_imprimees = $2, total_ttc = 37.40 WHERE id = $1`, [
      a[0].achat_id,
      JSON.stringify([
        { gauche: "QUINCAILLERIE DU PORT", droite: null },
        { gauche: "VIS INOX X100", droite: "12,40" },
        { gauche: "VIS INOX X100", droite: "12,40" },
        { gauche: "CHEVILLES", droite: "12,60" },
        { gauche: "TOTAL A PAYER", droite: "37,40" },
      ]),
    ]);
    const { rows: d } = await pool.query(
      `INSERT INTO dossiers_comptables (entreprise_id, du, au, fichier_cle, taille_octets, empreinte, garde_jusqu_au, arrete_par)
       VALUES ($1, $2, $2, 'e2e-photo', 1, repeat('0', 64), '2099-01-01', $3) RETURNING id`,
      [entreprise, aujourdhui, utilisateur]
    );
    const jeton = randomBytes(32).toString("base64url");
    await pool.query(`INSERT INTO envois_comptable (entreprise_id, dossier_id, jeton_empreinte, expire_le) VALUES ($1, $2, $3, now() + interval '1 day')`, [
      entreprise,
      d[0].id,
      createHash("sha256").update(jeton).digest("hex"),
    ]);
    const lui = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
    await lui.goto(`${BASE}/comptable/${jeton}`, { waitUntil: "networkidle" });
    await lui.locator('[data-atlas="ligne-du-comptable"]', { hasText: "CB QUINCAILLERIE PHOTO" }).locator('[data-atlas="ouvrir-justificatif"]').click();
    const piece = lui.locator('[data-atlas="reconstituee"]');
    const texte = await piece.innerText();
    assert.equal(texte.match(/VIS INOX X100/g)?.length, 2, "un doublon a été regroupé");
    assert.match(texte, /CHEVILLES/);
    const surlignee = await piece.locator("div[style*='font-weight']").innerText();
    assert.match(surlignee, /TOTAL A PAYER\s*37,40/);
    assert.doesNotMatch(texte, /TOTAL TTC/);
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
