import assert from "node:assert";
import type { BrowserContext, Page } from "playwright";
import { lancerNavigateur } from "./e2e-browser";
import { pool } from "../src/server/db/client";
import { ADRESSE } from "./_adresse";

/**
 * POUR MON COMPTABLE, LOT 2 — le parcours du patron, du doigt jusqu'à la ligne.
 *
 * Ses choix des 23 et 24 octobre 2026 sur `appli/pour-mon-comptable.html`.
 * Les suites base éprouvent les règles et le dépôt
 * (`test-pour-mon-comptable.ts`, `test-pour-mon-comptable-db.ts`) ; celle-ci
 * traverse les écrans, là où vivent les raccords :
 *
 *   1. Terminés porte la carte, et son compte est CELUI du dossier ;
 *   2. le Check up relie le ticket qui tombe juste, et dit ce qu'il a fait ;
 *   3. « Ticket perdu » prévient AVANT de valider que la TVA ne se déduit pas ;
 *   4. un virement se justifie par sa nature ;
 *   5. le relevé du mois montre chaque ligne avec sa pièce, la plus récente
 *      en haut, et le filtre « Sans ticket » ne garde que ce qui manque.
 *
 * **Les dates partent d'aujourd'hui**, jamais d'un jour figé : le dossier en
 * cours est l'année courante, et une date écrite en dur sortirait du dossier
 * le 1ᵉʳ janvier suivant, rendant cette suite verte sans rien éprouver.
 */

const BASE = ADRESSE;
const MARQUE = "E2E-COMPTABLE";

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

async function sansTicket(page: Page): Promise<number> {
  await page.goto(`${BASE}/termines`, { waitUntil: "networkidle" });
  const texte = (await page.locator('[data-atlas="carte-comptable"]').textContent()) ?? "";
  if (/Tout est justifié/.test(texte)) return 0;
  const m = /(\d+) sans ticket/.exec(texte);
  assert.ok(m, `la carte du dossier est illisible : « ${texte} »`);
  return Number(m[1]);
}

async function main() {
  const { rows } = await pool.query(
    `SELECT m.entreprise_id AS entreprise FROM membres_entreprise m JOIN users u ON u.id = m.utilisateur_id WHERE u.email = 'demo@atlas.local' LIMIT 1`
  );
  assert.ok(rows[0], "le compte de démonstration est absent : la base n'est pas amorcée");
  const { entreprise } = rows[0] as { entreprise: string };

  await pool.query(`DELETE FROM mouvements_bancaires WHERE entreprise_id = $1 AND cle LIKE $2`, [entreprise, `${MARQUE}%`]);
  await pool.query(`DELETE FROM achats_tva WHERE entreprise_id = $1 AND fournisseur LIKE $2`, [entreprise, `${MARQUE}%`]);
  await pool.query(`DELETE FROM devis_recus WHERE entreprise_id = $1 AND nom = 'Facture E2E'`, [entreprise]);
  await pool.query(`DELETE FROM societes_achat WHERE entreprise_id = $1 AND nom LIKE $2`, [entreprise, `${MARQUE}%`]);

  const aujourdhui = jour(0);
  const mouvement = (cle: string, j: string, montant: string, libelle: string) =>
    pool.query(
      `INSERT INTO mouvements_bancaires (entreprise_id, cle, jour, montant, sens, libelle) VALUES ($1, $2, $3, $4, 'sortie', $5)`,
      [entreprise, `${MARQUE}-${cle}`, j, montant, libelle]
    );
  await mouvement("PLEIN", aujourdhui, "67.89", "CB STATION E2E");
  await mouvement("PERDU", aujourdhui, "12.34", "CB BOULANGERIE E2E");
  await mouvement("URSSAF", aujourdhui, "456.78", "PRLV URSSAF E2E");
  await pool.query(
    `INSERT INTO achats_tva (entreprise_id, date_achat, fournisseur, total_ttc, taux_tva, tva_deductible, saisie, nature, vehicule) VALUES ($1, $2, $3, 67.89, 20, 11.31, 'main', 'carburant', 'utilitaire')`,
    [entreprise, jour(-1), `${MARQUE} station`]
  );

  const browser = await lancerNavigateur();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await seConnecter(context);

  let avant = 0;
  await test("Terminés porte la carte « Pour mon comptable »", async () => {
    avant = await sansTicket(page);
    assert.ok(avant >= 3, `la carte annonce ${avant} sans ticket, il en faut au moins trois`);
  });

  await test("la carte mène au dossier, qui montre les lignes à regarder", async () => {
    await page.click('[data-atlas="carte-comptable"]');
    await page.waitForURL(`${BASE}/termines/comptable`, { timeout: 30_000 });
    await page.waitForSelector('[data-atlas="check-up"]');
    assert.equal(await page.locator('[data-atlas="ligne-a-regarder"]', { hasText: "12,34" }).count(), 1);
  });

  // Sa remarque du 27 octobre 2026 : le descriptif des mois passe en tête, les
  // lignes à justifier viennent ensuite.
  await test("les mois viennent avant les lignes à justifier", async () => {
    const mois = await page.locator('[data-atlas="periodes"]').boundingBox();
    const aJustifier = await page.locator('[data-atlas="a-regarder"]').boundingBox();
    assert.ok(mois && aJustifier && mois.width > 0 && aJustifier.width > 0, "un des deux blocs ne se mesure pas : la comparaison ne dit rien");
    assert.ok(mois.y < aJustifier.y, `les mois sont à ${Math.round(mois.y)} px, les lignes à justifier à ${Math.round(aJustifier.y)} px`);
  });

  await test("le Check up relie le ticket qui tombe juste, et dit ce qu'il a fait", async () => {
    await page.click('[data-atlas="check-up"]');
    const bilan = await page.locator('[data-atlas="bilan-check-up"]').textContent({ timeout: 30_000 });
    assert.match(bilan ?? "", /reliée?s?/);
    await page.waitForFunction(
      () => ![...document.querySelectorAll('[data-atlas="ligne-a-regarder"]')].some((e) => e.textContent?.includes("67,89")),
      null,
      { timeout: 30_000 }
    );
  });

  await test("« Ticket perdu » prévient avant de valider, puis la ligne quitte la liste", async () => {
    const carte = page.locator('[data-atlas="ligne-a-regarder"]', { hasText: "12,34" });
    await carte.locator('[data-atlas="ticket-perdu"]').click();
    assert.match((await carte.textContent()) ?? "", /Sa TVA ne sera pas déduite/);
    await carte.locator('[data-atlas="valider-ticket-perdu"]').click();
    await page.waitForFunction(
      () => ![...document.querySelectorAll('[data-atlas="ligne-a-regarder"]')].some((e) => e.textContent?.includes("12,34")),
      null,
      { timeout: 30_000 }
    );
  });

  await test("un prélèvement se justifie par sa nature", async () => {
    const carte = page.locator('[data-atlas="ligne-a-regarder"]', { hasText: "456,78" });
    await carte.locator('[data-atlas="autre-chose"]').click();
    await carte.locator('[data-atlas="choix-motif"]', { hasText: "Impôts, cotisations" }).click();
    await page.waitForFunction(
      () => ![...document.querySelectorAll('[data-atlas="ligne-a-regarder"]')].some((e) => e.textContent?.includes("456,78")),
      null,
      { timeout: 30_000 }
    );
  });

  await test("Terminés dit désormais trois de moins, comme le dossier", async () => {
    assert.equal(await sansTicket(page), avant - 3);
  });

  await test("le relevé du mois montre chaque pièce, la plus récente en haut", async () => {
    await page.goto(`${BASE}/termines/comptable/${aujourdhui.slice(0, 7)}`, { waitUntil: "networkidle" });
    const texte = (await page.locator('[data-atlas="releve"]').textContent()) ?? "";
    assert.match(texte, /CB STATION E2E[\s\S]*Ticket du [\s\S]*relié par Atlas/);
    assert.match(texte, /CB BOULANGERIE E2E[\s\S]*Ticket perdu, mention validée/);
    assert.match(texte, /PRLV URSSAF E2E[\s\S]*Impôts, cotisations/);
    const jours = await page.locator('[data-atlas="releve"] li > h3').allTextContents();
    assert.ok(jours.length > 0, "aucun jour affiché : le relevé ne mesure rien");
  });

  await test("le filtre « À justifier » ne garde que ce qui manque", async () => {
    // Une ligne À ELLE qui manque : sans elle, la suite dépendait des restes
    // d'autres suites, et une base fraîche affichait « Rien ne manque. ».
    await mouvement("MANQUE", aujourdhui, "9.99", "CB SANS PIECE E2E");
    await page.reload({ waitUntil: "networkidle" });
    await page.click('[data-atlas="filtre-a-justifier"]');
    // La LISTE, et elle seule : le texte de toute la page porte aussi les
    // données que Next.js range au bas du document, où les lignes filtrées
    // figurent encore sans être affichées.
    const texte = (await page.locator('[data-atlas="releve"]').innerText()) ?? "";
    assert.match(texte, /CB SANS PIECE E2E/);
    assert.doesNotMatch(texte, /CB STATION E2E/);
    assert.doesNotMatch(texte, /CB BOULANGERIE E2E/);
  });

  // Sa demande du 27 octobre 2026 (option B de la planche) : la ligne à
  // justifier du relevé porte ses gestes dessous, sans remonter au dossier.
  await test("une ligne à justifier du relevé porte ses gestes dessous, et les autres non", async () => {
    const ligne = page.locator('[data-atlas="releve"] li', { hasText: "CB SANS PIECE E2E" });
    const gestes = ligne.locator('[data-atlas="gestes-de-la-ligne"]');
    assert.equal(await gestes.count(), 1, "la ligne à justifier ne porte pas ses gestes");
    assert.equal(await gestes.locator('[data-atlas="photographier-ticket"]').count(), 1, "« Photographier le ticket » manque sous la ligne");
    // Le nom et le montant ne se répètent pas : la ligne les porte déjà.
    assert.equal(await gestes.locator("text=CB SANS PIECE E2E").count(), 0, "la carte redit le nom de la ligne");
    await page.click('[data-atlas="filtre-a-justifier"]');
    assert.equal(await page.locator('[data-atlas="releve"] li', { hasText: "CB STATION E2E" }).count(), 0);
  });

  await test("une période illisible et une pièce inconnue ne s'ouvrent pas", async () => {
    // Le statut ne dit rien ici : l'écran de chargement a déjà répondu 200
    // quand la page refuse. On regarde donc ce qui est AFFICHÉ.
    await page.goto(`${BASE}/termines/comptable/2026-13`, { waitUntil: "networkidle" });
    assert.equal(await page.locator('[data-atlas="releve"]').count(), 0);
    assert.match(await page.locator("body").innerText(), /404|could not be found|introuvable/i);
    const t = await page.request.get(`${BASE}/termines/comptable/piece/00000000-0000-0000-0000-000000000000`);
    assert.equal(t.status(), 404);
  });

  // ─── Sa remarque du 25 octobre 2026 : un virement reçu sans facture d'Atlas
  // du même montant n'apparaissait nulle part, et le dossier ne s'arrêtait plus.
  // Le geste se joue d'où il le joue, lui : sa carte, dans le dossier.
  await test("un virement reçu sans facture d'Atlas se règle dans sa carte, par sa nature", async () => {
    await pool.query(
      `INSERT INTO mouvements_bancaires (entreprise_id, cle, jour, montant, sens, contrepartie, libelle) VALUES ($1, $2, $3, 777.77, 'entree', 'M REMBOURSE E2E', 'VIR M REMBOURSE E2E')`,
      [entreprise, `${MARQUE}-RECU`, aujourdhui]
    );
    await page.goto(`${BASE}/termines/comptable`, { waitUntil: "networkidle" });
    const carte = page.locator('[data-atlas="ligne-a-regarder"]', { hasText: "777,77" });
    assert.equal(await carte.count(), 1, "le virement reçu n'a pas sa carte dans le dossier");
    await carte.locator('[data-atlas="choisir-la-facture"]').click();
    assert.equal(await carte.locator('[data-atlas="facture-hors-atlas"]').count(), 1, "la facture faite hors d'Atlas n'est pas proposée");
    await carte.getByRole("button", { name: "Annuler" }).click();
    await carte.locator('[data-atlas="autre-chose"]').click();
    // Ses cinq réponses à lui, pas celles d'un virement envoyé.
    assert.equal(await carte.locator('[data-atlas="choix-motif"]', { hasText: "Un salaire" }).count(), 0);
    await carte.locator('[data-atlas="choix-motif"]', { hasText: "Un remboursement" }).click();
    await page.waitForFunction(
      () => ![...document.querySelectorAll('[data-atlas="ligne-a-regarder"]')].some((e) => e.textContent?.includes("777,77")),
      null,
      { timeout: 30_000 }
    );
    const { rows: [l] } = await pool.query(`SELECT justification, motif FROM mouvements_bancaires WHERE entreprise_id = $1 AND cle = $2`, [entreprise, `${MARQUE}-RECU`]);
    assert.deepEqual(l, { justification: "motif", motif: "remboursement" });
  });

  // ─── Et le même jour : « je pouvais valider une facture qui n'était pas du montant ».
  await test("une facture d'un autre montant montre l'écart avant d'être jointe", async () => {
    await mouvement("ECART", aujourdhui, "1450.00", "VIR SARL ECART E2E");
    const { rows: [societe] } = await pool.query(
      `INSERT INTO societes_achat (entreprise_id, rubrique, nom) VALUES ($1, 'fournisseur', $2) RETURNING id`,
      [entreprise, `${MARQUE} Motoculture`]
    );
    await pool.query(
      `INSERT INTO devis_recus (entreprise_id, societe_id, nom, fichier_cle, nature, genre, total_ttc) VALUES ($1, $2, 'Facture E2E', $3, 'pdf', 'facture', 1386.40)`,
      [entreprise, societe.id, `entreprises/${entreprise}/devis-recus/e2e.pdf`]
    );
    await page.goto(`${BASE}/termines/comptable`, { waitUntil: "networkidle" });
    const carte = page.locator('[data-atlas="ligne-a-regarder"]', { hasText: "VIR SARL ECART E2E" });
    await carte.locator('[data-atlas="joindre-facture"]').click();
    // Sa remarque du 27 octobre 2026 : la photo ou le fichier se proposent aussi.
    assert.equal(await carte.locator('[data-atlas="facture-hors-atlas"]').count(), 1, "la photo ou le fichier de la facture n'est pas proposé");
    await carte.locator('[data-atlas="choix-facture"]', { hasText: `${MARQUE} Motoculture` }).click();
    const encart = carte.locator('[data-atlas="ecart-de-montant"]');
    await encart.waitFor({ timeout: 30_000 });
    // L'espace des milliers est insécable (`enEuros`) : `\s` la reconnaît.
    assert.match(await encart.innerText(), /Pas le même montant[\s\S]*1\s386,40/);
    const { rows: [avant] } = await pool.query(`SELECT justification FROM mouvements_bancaires WHERE entreprise_id = $1 AND cle = $2`, [entreprise, `${MARQUE}-ECART`]);
    assert.equal(avant.justification, null, "la facture a été jointe sans son accord");
    await carte.locator('[data-atlas="joindre-malgre-ecart"]').click();
    await page.waitForFunction(
      () => ![...document.querySelectorAll('[data-atlas="ligne-a-regarder"]')].some((e) => e.textContent?.includes("VIR SARL ECART E2E")),
      null,
      { timeout: 30_000 }
    );
    await page.goto(`${BASE}/termines/comptable/${aujourdhui.slice(0, 7)}`, { waitUntil: "networkidle" });
    assert.match(await page.locator('[data-atlas="releve"]').innerText(), /VIR SARL ECART E2E[\s\S]*de 1\s386,40\s€, pas le montant/);
  });

  await pool.query(`DELETE FROM mouvements_bancaires WHERE entreprise_id = $1 AND cle LIKE $2`, [entreprise, `${MARQUE}%`]);
  await pool.query(`DELETE FROM achats_tva WHERE entreprise_id = $1 AND fournisseur LIKE $2`, [entreprise, `${MARQUE}%`]);
  await pool.query(`DELETE FROM devis_recus WHERE entreprise_id = $1 AND nom = 'Facture E2E'`, [entreprise]);
  await pool.query(`DELETE FROM societes_achat WHERE entreprise_id = $1 AND nom LIKE $2`, [entreprise, `${MARQUE}%`]);
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
