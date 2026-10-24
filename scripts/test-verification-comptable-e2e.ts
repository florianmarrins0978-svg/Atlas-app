import assert from "node:assert";
import type { BrowserContext, Page } from "playwright";
import { lancerNavigateur } from "./e2e-browser";
import { pool } from "../src/server/db/client";
import { enregistrerObjet, supprimerObjet } from "../src/server/storage";
import { ADRESSE } from "./_adresse";

/**
 * POUR MON COMPTABLE, LOT 4 — le comptable vérifie par son lien, et le patron
 * reçoit ses rejets. Écran 7 de `appli/pour-mon-comptable.html`.
 *
 * La suite base (`test-verification-comptable-db.ts`, sous `atlas_app`)
 * éprouve l'isolation du jeton ; celle-ci joue les deux côtés dans un vrai
 * navigateur, dans l'ordre où ils se passent :
 *
 *   1. le patron touche « Envoyer au comptable » et reçoit un lien ;
 *   2. le comptable l'ouvre SANS compte : ses lignes, pas la barre d'Atlas ;
 *   3. la pièce s'ouvre : reconstituée d'abord, la photo d'origine en glissant ;
 *   4. Valider passe à la suivante ; Rejeter demande pourquoi ;
 *   5. revenir sur une ligne validée dit « Vous l'aviez validée » ;
 *   6. le patron lit le rejet dans Mes dossiers et y répond ;
 *   7. le comptable voit la ligne « corrigée » ;
 *   8. sur un ordinateur, la pièce s'ouvre À CÔTÉ de la liste ;
 *   9. un lien inventé ne montre rien.
 */

const BASE = ADRESSE;
const MARQUE = "E2E-VERIF";

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

// Un PNG de 1 × 1 : assez pour qu'une image se charge, et se mesure.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==", "base64");

async function main() {
  const { rows } = await pool.query(
    `SELECT m.entreprise_id AS entreprise, m.utilisateur_id AS utilisateur, e.nom FROM membres_entreprise m JOIN users u ON u.id = m.utilisateur_id JOIN entreprises e ON e.id = m.entreprise_id WHERE u.email = 'demo@atlas.local' LIMIT 1`
  );
  assert.ok(rows[0], "le compte de démonstration est absent : la base n'est pas amorcée");
  const { entreprise, utilisateur, nom } = rows[0] as { entreprise: string; utilisateur: string; nom: string };
  const { rows: base } = await pool.query(`SELECT current_database() AS nom`);
  assert.match(base[0].nom, /^atlas_test/, "cette suite vide les dossiers : elle refuse une autre base qu'une base d'essai");

  const photo = await enregistrerObjet(`entreprises/${entreprise}/tickets`, PNG, ".png", "image/png");
  const nettoyer = async () => {
    await pool.query(`DELETE FROM dossiers_comptables WHERE entreprise_id = $1`, [entreprise]);
    await pool.query(`DELETE FROM mouvements_bancaires WHERE entreprise_id = $1 AND cle LIKE $2`, [entreprise, `${MARQUE}%`]);
    await pool.query(`DELETE FROM achats_tva WHERE entreprise_id = $1 AND fournisseur LIKE $2`, [entreprise, `${MARQUE}%`]);
  };
  await nettoyer();

  // Un dossier de janvier 2025 rangé, trois lignes justifiées.
  const ticket = await pool.query(
    `INSERT INTO achats_tva (entreprise_id, date_achat, fournisseur, total_ttc, taux_tva, tva_deductible, saisie, nature, vehicule, photo_cle)
     VALUES ($1, '2025-01-09', $2, 48.11, 20, 8.02, 'main', 'carburant', 'utilitaire', $3) RETURNING id`,
    [entreprise, `${MARQUE} INTERMARCHE`, photo.storageKey]
  );
  const ligne = async (cle: string, jour: string, montant: string, libelle: string, justification: string, achat: string | null, motif: string | null) =>
    (
      await pool.query(
        `INSERT INTO mouvements_bancaires (entreprise_id, cle, jour, montant, sens, libelle, justification, achat_id, motif, relie_par, justifie_le)
         VALUES ($1, $2, $3, $4, 'sortie', $5, $6, $7, $8, 'patron', now()) RETURNING id`,
        [entreprise, `${MARQUE}-${cle}`, jour, montant, libelle, justification, achat, motif]
      )
    ).rows[0].id as string;
  await ligne("GASOIL", "2025-01-09", "48.11", "CB ITM STATION E2E", "ticket", ticket.rows[0].id, null);
  await ligne("POSTE", "2025-01-12", "12.55", "CB LA POSTE E2E", "ticket_perdu", null, null);
  await ligne("URSSAF", "2025-01-20", "456.78", "PRLV URSSAF E2E", "motif", null, "impots");
  await pool.query(
    `INSERT INTO dossiers_comptables (entreprise_id, du, au, fichier_cle, taille_octets, empreinte, garde_jusqu_au, arrete_par)
     VALUES ($1, '2025-01-01', '2025-01-31', 'e2e-verif', 1000, repeat('a', 64), '2035-01-31', $2)`,
    [entreprise, utilisateur]
  );

  const browser = await lancerNavigateur();
  const patron = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await seConnecter(patron);
  const comptable = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const lui = await comptable.newPage();
  let lien = "";

  await test("le patron touche « Envoyer au comptable » et reçoit un lien privé", async () => {
    await page.goto(`${BASE}/termines/comptable/dossiers`, { waitUntil: "networkidle" });
    await page.selectOption('[data-atlas="filtre-annee"]', "2025");
    await page.click('[data-atlas="envoyer-au-comptable"]');
    const bloc = page.locator('[data-atlas="lien-du-comptable"]');
    await bloc.waitFor({ timeout: 30_000 });
    lien = (await bloc.locator("p").innerText()).trim();
    assert.match(lien, /\/comptable\/[A-Za-z0-9_-]{40,}$/);
    assert.match((await bloc.locator("a").getAttribute("href")) ?? "", /^mailto:/);
  });

  await test("le comptable l'ouvre sans compte : ses lignes, et pas la barre d'Atlas", async () => {
    await lui.goto(lien.replace(/^https?:\/\/[^/]+/, BASE), { waitUntil: "networkidle" });
    const texte = await lui.locator('[data-atlas="verification-comptable"]').innerText();
    assert.match(texte, new RegExp(`Dossier justifié, ${nom}`));
    assert.match(texte, /0 sur 3 lignes vérifiées en janvier 2025/);
    assert.equal(await lui.locator('[data-atlas="ligne-du-comptable"]').count(), 3);
    assert.doesNotMatch(await lui.locator("body").innerText(), /PLANNING|RÉGLAGES/);
  });

  await test("la pièce s'ouvre : reconstituée d'abord, la photo d'origine en glissant", async () => {
    await lui.locator('[data-atlas="ligne-du-comptable"]', { hasText: "CB ITM STATION E2E" }).locator('[data-atlas="ouvrir-justificatif"]').click();
    const panneau = lui.locator('[data-atlas="panneau-justificatif"]');
    await panneau.waitFor();
    const piece = await panneau.locator('[data-atlas="reconstituee"]').innerText();
    assert.match(piece, /INTERMARCHE[\s\S]*TOTAL TTC[\s\S]*48,11/);
    const photo = panneau.locator('img[data-atlas="original"]');
    await photo.waitFor({ state: "attached" });
    await lui.waitForFunction(() => {
      const i = document.querySelector('img[data-atlas="original"]') as HTMLImageElement | null;
      return Boolean(i && i.complete && i.naturalWidth > 0);
    }, null, { timeout: 15_000 });
    // Sur un téléphone, la pièce prend tout l'écran.
    const boite = await panneau.boundingBox();
    assert.ok(boite && boite.x === 0 && boite.width >= 380, `le panneau ne couvre pas l'écran : ${JSON.stringify(boite)}`);
  });

  await test("Valider passe à la ligne suivante", async () => {
    await lui.click('[data-atlas="valider"]');
    const rappel = await lui.locator('[data-atlas="panneau-justificatif"]').innerText();
    assert.match(rappel, /CB LA POSTE E2E/);
  });

  await test("Rejeter demande pourquoi, et la raison s'écrit sur la ligne", async () => {
    await lui.click('[data-atlas="rejeter"]');
    assert.match(await lui.locator('[data-atlas="panneau-justificatif"]').innerText(), new RegExp(`Pourquoi \\? ${nom} le lira\\.`));
    await lui.fill('[data-atlas="raison-du-rejet"]', "Ce ticket se retrouve, cherchez-le");
    await lui.click('[data-atlas="confirmer-rejet"]');
    assert.match(await lui.locator('[data-atlas="accord"]').innerText(), /Rejetée : Ce ticket se retrouve, cherchez-le/);
  });

  await test("revenir sur une ligne validée dit « Vous l'aviez validée » et demande d'expliquer", async () => {
    // Sur un téléphone la pièce couvre la liste : on la ferme d'abord.
    await lui.click("text=Fermer");
    await lui.locator('[data-atlas="ligne-du-comptable"]', { hasText: "CB ITM STATION E2E" }).locator('[data-atlas="ouvrir-justificatif"]').click();
    await lui.click('[data-atlas="rejeter"]');
    const texte = await lui.locator('[data-atlas="panneau-justificatif"]').innerText();
    assert.match(texte, /Vous l’aviez validée\./);
    assert.match(texte, /Expliquez ce changement/);
    await lui.locator('[data-atlas="panneau-justificatif"] button', { hasText: "Annuler" }).click();
    await lui.click("text=Fermer");
  });

  await test("les verdicts survivent au rechargement", async () => {
    await lui.reload({ waitUntil: "networkidle" });
    assert.match(await lui.locator('[data-atlas="avancement"]').innerText(), /2 sur 3/);
    assert.match(await lui.locator('[data-atlas="ligne-du-comptable"]', { hasText: "CB LA POSTE E2E" }).innerText(), /Ce ticket se retrouve/);
  });

  await test("le patron lit le rejet dans Mes dossiers, et y répond", async () => {
    await page.goto(`${BASE}/termines/comptable/dossiers`, { waitUntil: "networkidle" });
    await page.selectOption('[data-atlas="filtre-annee"]', "2025");
    assert.match(await page.locator('[data-atlas="verification-du-comptable"]').innerText(), /Vérifié par votre comptable : 2 sur 3/);
    const carte = page.locator('[data-atlas="rejets-du-comptable"] [data-atlas="ligne-a-regarder"]');
    assert.equal(await carte.count(), 1);
    assert.match(await carte.innerText(), /Votre comptable l’a rejetée : Ce ticket se retrouve, cherchez-le\./);
    await carte.locator('[data-atlas="ticket-perdu"]').click();
    await carte.locator('[data-atlas="valider-ticket-perdu"]').click();
    await page.waitForFunction(() => document.querySelectorAll('[data-atlas="rejets-du-comptable"] [data-atlas="ligne-a-regarder"]').length === 0, null, { timeout: 30_000 });
  });

  await test("le comptable voit la ligne « corrigée », de nouveau à vérifier", async () => {
    await lui.reload({ waitUntil: "networkidle" });
    assert.match(await lui.locator('[data-atlas="ligne-du-comptable"]', { hasText: "CB LA POSTE E2E" }).innerText(), /Corrigée depuis votre rejet : Ce ticket se retrouve/);
    assert.match(await lui.locator('[data-atlas="avancement"]').innerText(), /1 sur 3/);
  });

  await test("sur un ordinateur, la pièce s'ouvre à côté de la liste", async () => {
    const bureau = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const p = await bureau.newPage();
    await p.goto(lien.replace(/^https?:\/\/[^/]+/, BASE), { waitUntil: "networkidle" });
    await p.locator('[data-atlas="ouvrir-justificatif"]').first().click();
    const panneau = await p.locator('[data-atlas="panneau-justificatif"]').boundingBox();
    const liste = await p.locator('[data-atlas="lignes-du-comptable"]').boundingBox();
    assert.ok(panneau && liste, "le panneau ou la liste n'a pas de boîte : rien à mesurer");
    assert.ok(panneau.width > 300 && panneau.x >= liste.x + liste.width - 1, `la pièce recouvre la liste : ${JSON.stringify({ panneau, liste })}`);
    await bureau.close();
  });

  await test("un lien inventé ne montre rien, et sa pièce non plus", async () => {
    await lui.goto(`${BASE}/comptable/${"x".repeat(43)}`, { waitUntil: "networkidle" });
    assert.match(await lui.locator("body").innerText(), /Ce lien n’est plus valable/);
    assert.equal(await lui.locator('[data-atlas="ligne-du-comptable"]').count(), 0);
    const r = await lui.request.get(`${BASE}/comptable/${"x".repeat(43)}/piece/00000000-0000-0000-0000-000000000000`);
    assert.equal(r.status(), 404);
  });

  await nettoyer();
  await supprimerObjet(photo.storageKey);
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
