import assert from "node:assert";
import type { BrowserContext, Page } from "playwright";
import { ECRAN_DU_PATRON, lancerNavigateur } from "./e2e-browser";
import { allerALAnnee } from "./_choix-annee";
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
 *   3. la pièce s'ouvre : reconstituée d'abord, la photo d'origine derrière
 *      son onglet ; Valider, Rejeter et Suivant restent à l'écran ;
 *   4. Valider passe à la suivante ; Rejeter demande pourquoi ;
 *   5. revenir sur une ligne validée dit « Vous l'aviez validée » ;
 *   6. une pièce d'un autre montant se lit AVANT de valider ; une facture
 *      faite hors d'Atlas se voit, et s'ouvre ;
 *   7. le patron lit le rejet dans Mes dossiers et y répond ;
 *   8. le comptable voit la ligne « corrigée » ;
 *   9. sur un ordinateur, la pièce s'ouvre À CÔTÉ de la liste, les montants
 *      tombent l'un sous l'autre, et Rejeter reste à l'écran ;
 *  10. un lien inventé ne montre rien.
 *
 * Le téléphone du comptable est celui du patron (`ECRAN_DU_PATRON`, 664 points
 * de haut) : sur un écran de 844, la page d'avant laissait Valider à l'écran,
 * et le défaut qu'il a vu ne se serait pas montré.
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

/** Ces boutons sont-ils entièrement dans la fenêtre ? Une boîte absente n'est pas « à l'écran ». */
async function aLEcran(page: Page, reperes: string[]): Promise<string[]> {
  return page.evaluate((rs) => {
    const hauteur = window.innerHeight;
    return rs.filter((r) => {
      const b = document.querySelector(`[data-atlas="${r}"]`)?.getBoundingClientRect();
      return !b || b.height === 0 || b.top < 0 || b.bottom > hauteur;
    });
  }, reperes);
}

/** L'image d'origine visible, chargée pour de bon (une image de 0 pixel ne prouve rien). */
async function origineChargee(page: Page) {
  await page.waitForFunction(() => {
    const i = [...document.querySelectorAll<HTMLImageElement>('img[data-atlas="original"]')].find((x) => x.offsetParent !== null);
    return Boolean(i && i.complete && i.naturalWidth > 0);
  }, null, { timeout: 15_000 });
}

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
  // Un ticket de 62,40 € joint malgré l'écart à une ligne de 67,89 € : le
  // comptable doit le lire avant de valider.
  const autreMontant = await pool.query(
    `INSERT INTO achats_tva (entreprise_id, date_achat, fournisseur, total_ttc, taux_tva, tva_deductible, saisie, nature, vehicule)
     VALUES ($1, '2025-01-21', $2, 62.40, 20, 10.40, 'main', 'carburant', 'utilitaire') RETURNING id`,
    [entreprise, `${MARQUE} TOTAL CHOLET`]
  );
  await ligne("ECART", "2025-01-22", "67.89", "CB TOTAL CHOLET E2E", "ticket", autreMontant.rows[0].id, null);
  // Un virement reçu qui paie la moitié d'une facture faite hors d'Atlas,
  // photographiée (migration 0150).
  await pool.query(
    `INSERT INTO mouvements_bancaires (entreprise_id, cle, jour, montant, sens, libelle, justification, relie_par, justifie_le, piece_cle, piece_nature, piece_total)
     VALUES ($1, $2, '2025-01-24', 864.00, 'entree', 'VIR DURAND HORS ATLAS E2E', 'facture_hors_atlas', 'patron', now(), $3, 'photo', 1728.00)`,
    [entreprise, `${MARQUE}-HORS`, photo.storageKey]
  );
  await pool.query(
    `INSERT INTO dossiers_comptables (entreprise_id, du, au, fichier_cle, taille_octets, empreinte, garde_jusqu_au, arrete_par)
     VALUES ($1, '2025-01-01', '2025-01-31', 'e2e-verif', 1000, repeat('a', 64), '2035-01-31', $2)`,
    [entreprise, utilisateur]
  );

  const browser = await lancerNavigateur();
  const patron = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await seConnecter(patron);
  const comptable = await browser.newContext({ ...ECRAN_DU_PATRON });
  const lui = await comptable.newPage();
  let lien = "";

  await test("le patron touche « Envoyer au comptable » et reçoit un lien privé", async () => {
    await page.goto(`${BASE}/termines/comptable/dossiers`, { waitUntil: "networkidle" });
    await allerALAnnee(page, 2025);
    await page.click('[data-atlas="envoyer-au-comptable"]');
    const bloc = page.locator('[data-atlas="lien-du-comptable"]');
    await bloc.waitFor({ timeout: 30_000 });
    // L'adresse ne s'affiche plus (planche du 25 octobre) : elle se transmet.
    lien = ((await bloc.getAttribute("data-lien")) ?? "").trim();
    assert.match(lien, /\/comptable\/[A-Za-z0-9_-]{40,}$/);
    assert.match((await bloc.locator('[data-atlas="envoyer-par-email"]').getAttribute("href")) ?? "", /^mailto:/);
    // Sa remarque du 27 octobre 2026 : la page qu'il ouvre pour voir ce que voit
    // son comptable n'avait aucun retour. Elle s'ouvre dans l'onglet, en aperçu.
    assert.equal(await bloc.locator('[data-atlas="voir-la-page-du-comptable"]').getAttribute("href"), `${lien}?apercu=1`);
    assert.equal(await bloc.locator('[data-atlas="voir-la-page-du-comptable"]').getAttribute("target"), null, "la page s'ouvre dans un autre onglet : le retour se perd");
  });

  await test("l'aperçu du patron porte un bouton Fermer qui le ramène à ses dossiers, et la page du comptable n'en porte pas", async () => {
    await page.goto(`${lien.replace(/^https?:\/\/[^/]+/, BASE)}?apercu=1`, { waitUntil: "networkidle" });
    const fermer = page.locator('[data-atlas="fermer-apercu"]');
    assert.equal(await fermer.count(), 1, "l'aperçu n'a pas de bouton Fermer");
    assert.equal(await fermer.getAttribute("href"), "/termines/comptable/dossiers");
    const boite = await fermer.boundingBox();
    assert.ok(boite && boite.width > 0 && boite.height >= 44, `le bouton Fermer ne se touche pas : ${JSON.stringify(boite)}`);
    await fermer.click();
    await page.waitForURL(`${BASE}/termines/comptable/dossiers`, { timeout: 30_000 });
    // Le comptable, lui, n'a nulle part où « fermer » : l'adresse nue n'en montre pas.
    await page.goto(lien.replace(/^https?:\/\/[^/]+/, BASE), { waitUntil: "networkidle" });
    assert.equal(await page.locator('[data-atlas="fermer-apercu"]').count(), 0);
  });

  await test("le comptable l'ouvre sans compte : ses lignes, et pas la barre d'Atlas", async () => {
    await lui.goto(lien.replace(/^https?:\/\/[^/]+/, BASE), { waitUntil: "networkidle" });
    const texte = await lui.locator('[data-atlas="verification-comptable"]').innerText();
    assert.match(texte, new RegExp(`Dossier justifié, ${nom}`));
    // Un seul mois : le compte du dossier suffit, sans « dont … en janvier ».
    assert.match(texte, /0 sur 5 lignes vérifiées/);
    assert.equal(await lui.locator('[data-atlas="ligne-du-comptable"]').count(), 5);
    assert.doesNotMatch(await lui.locator("body").innerText(), /PLANNING|RÉGLAGES/);
  });

  await test("sur un téléphone, chaque ligne garde sa date", async () => {
    const date = lui.locator('[data-atlas="ligne-du-comptable"]', { hasText: "CB ITM STATION E2E" }).locator('[data-atlas="date-de-la-ligne"]');
    assert.equal((await date.innerText()).trim(), "09/01");
    const boite = await date.boundingBox();
    assert.ok(boite && boite.width > 0 && boite.height > 0, `la date est cachée : ${JSON.stringify(boite)}`);
  });

  await test("la pièce s'ouvre : reconstituée d'abord, la photo d'origine derrière son onglet", async () => {
    await lui.locator('[data-atlas="ligne-du-comptable"]', { hasText: "CB ITM STATION E2E" }).locator('[data-atlas="ouvrir-justificatif"]').click();
    const panneau = lui.locator('[data-atlas="panneau-justificatif"]');
    await panneau.waitFor();
    const reconstituee = panneau.locator('[data-atlas="reconstituee"]');
    assert.match(await reconstituee.innerText(), /INTERMARCHE[\s\S]*TOTAL TTC[\s\S]*48,11/);
    assert.equal(await panneau.locator('img[data-atlas="original"]').isVisible(), false, "la photo passe avant la pièce reconstituée");
    // Sur un téléphone, la pièce prend tout l'écran, et ses trois boutons y restent.
    const boite = await panneau.boundingBox();
    assert.ok(boite && boite.x === 0 && boite.width >= 380, `le panneau ne couvre pas l'écran : ${JSON.stringify(boite)}`);
    assert.deepEqual(await aLEcran(lui, ["valider", "rejeter", "suivant"]), [], "un bouton tombe sous l'écran, pièce ouverte");
    await panneau.locator('[data-atlas="onglet-origine"]').click();
    assert.equal((await panneau.locator('[data-atlas="onglet-origine"]').innerText()).trim(), "Photo d’origine");
    await origineChargee(lui);
    assert.equal(await reconstituee.isVisible(), false);
    await panneau.locator('[data-atlas="onglet-reconstitue"]').click();
    assert.equal(await reconstituee.isVisible(), true);
  });

  await test("Valider passe à la ligne suivante", async () => {
    await lui.click('[data-atlas="valider"]');
    const rappel = await lui.locator('[data-atlas="panneau-justificatif"]').innerText();
    assert.match(rappel, /CB LA POSTE E2E/);
  });

  await test("Rejeter demande pourquoi, et la raison s'écrit sur la ligne", async () => {
    await lui.click('[data-atlas="rejeter"]');
    assert.match(await lui.locator('[data-atlas="panneau-justificatif"]').innerText(), /Justifier le rejet/);
    await lui.fill('[data-atlas="raison-du-rejet"]', "Ce ticket se retrouve, cherchez-le");
    assert.deepEqual(await aLEcran(lui, ["raison-du-rejet", "confirmer-rejet"]), [], "la raison ou Rejeter tombe sous l'écran");
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

  await test("une pièce d'un autre montant se lit dans la liste, avant de valider, et s'alerte", async () => {
    const ecart = lui.locator('[data-atlas="ligne-du-comptable"]', { hasText: "CB TOTAL CHOLET E2E" }).locator('[data-atlas="ecart-de-la-piece"]');
    assert.match(await ecart.innerText(), /TOTAL CHOLET de 62,40\s€, pas le montant/);
    const enPartie = lui.locator('[data-atlas="ligne-du-comptable"]', { hasText: "VIR DURAND HORS ATLAS E2E" }).locator('[data-atlas="ecart-de-la-piece"]');
    assert.equal((await enPartie.innerText()).trim(), "payée en partie");
    // L'un s'alerte (`ecartSignale`), l'autre non : ils ne se peignent pas pareil.
    const couleur = (l: typeof ecart) => l.evaluate((e) => getComputedStyle(e).color);
    assert.notEqual(await couleur(ecart), await couleur(enPartie), "un paiement en partie s'alerte comme un écart");
    await lui.locator('[data-atlas="ligne-du-comptable"]', { hasText: "CB TOTAL CHOLET E2E" }).locator('[data-atlas="ouvrir-justificatif"]').click();
    assert.match(await lui.locator('[data-atlas="panneau-justificatif"] [data-atlas="ecart-de-la-piece"]').innerText(), /Ticket E2E-VERIF TOTAL CHOLET de 62,40\s€, pas le montant/);
    await lui.click("text=Fermer");
  });

  await test("une facture faite hors d'Atlas se voit comme pièce, avec son total, et s'ouvre", async () => {
    const rangee = lui.locator('[data-atlas="ligne-du-comptable"]', { hasText: "VIR DURAND HORS ATLAS E2E" });
    assert.match(await rangee.locator('[data-atlas="ouvrir-justificatif"]').innerText(), /Facture faite hors d’Atlas/);
    await rangee.locator('[data-atlas="ouvrir-justificatif"]').click();
    const panneau = lui.locator('[data-atlas="panneau-justificatif"]');
    assert.match(await panneau.locator('[data-atlas="reconstituee"]').innerText(), /Facture faite hors d’Atlas[\s\S]*Total TTC[\s\S]*1\s728,00\s€/);
    assert.match(await panneau.locator('[data-atlas="ecart-de-la-piece"]').innerText(), /Facture faite hors d’Atlas, payée en partie/);
    // Servie par la route du jeton, par `pieceDeLaLigne` : la photo jointe.
    await panneau.locator('[data-atlas="onglet-origine"]').click();
    await origineChargee(lui);
    await lui.click("text=Fermer");
  });

  await test("les verdicts survivent au rechargement, et la ligne prend la couleur du sien", async () => {
    await lui.reload({ waitUntil: "networkidle" });
    assert.match(await lui.locator('[data-atlas="avancement"]').innerText(), /2 sur 5/);
    const rejetee = lui.locator('[data-atlas="ligne-du-comptable"]', { hasText: "CB LA POSTE E2E" });
    assert.match(await rejetee.innerText(), /Rejetée : Ce ticket se retrouve/);
    const fond = (texte: string) => lui.locator('[data-atlas="ligne-du-comptable"]', { hasText: texte }).evaluate((e) => getComputedStyle(e).backgroundColor);
    const [validee, refusee, attente] = [await fond("CB ITM STATION E2E"), await fond("CB LA POSTE E2E"), await fond("PRLV URSSAF E2E")];
    assert.notEqual(validee, attente, "une ligne validée ne se teinte pas");
    assert.notEqual(refusee, attente, "une ligne rejetée ne se teinte pas");
    assert.notEqual(validee, refusee, "validée et rejetée ont la même teinte");
  });

  await test("le patron lit le rejet dans Mes dossiers, et y répond", async () => {
    await page.goto(`${BASE}/termines/comptable/dossiers`, { waitUntil: "networkidle" });
    await allerALAnnee(page, 2025);
    assert.match(await page.locator('[data-atlas="verification-du-comptable"]').innerText(), /Vérifié par votre comptable : 2 sur 5/);
    const carte = page.locator('[data-atlas="rejets-du-comptable"] [data-atlas="ligne-a-regarder"]');
    assert.equal(await carte.count(), 1);
    assert.match(await carte.innerText(), /Rejetée par votre comptable[\s\S]*« Ce ticket se retrouve, cherchez-le »/);
    await carte.locator('[data-atlas="ticket-perdu"]').click();
    await carte.locator('[data-atlas="valider-ticket-perdu"]').click();
    await page.waitForFunction(() => document.querySelectorAll('[data-atlas="rejets-du-comptable"] [data-atlas="ligne-a-regarder"]').length === 0, null, { timeout: 30_000 });
  });

  await test("le comptable voit la ligne « corrigée », de nouveau à vérifier", async () => {
    await lui.reload({ waitUntil: "networkidle" });
    assert.match(await lui.locator('[data-atlas="ligne-du-comptable"]', { hasText: "CB LA POSTE E2E" }).innerText(), /Corrigée depuis votre rejet : Ce ticket se retrouve/);
    assert.match(await lui.locator('[data-atlas="avancement"]').innerText(), /1 sur 5/);
  });

  await test("sur un ordinateur, la pièce s'ouvre à côté de la liste, les montants en colonne, Rejeter à l'écran", async () => {
    const bureau = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const p = await bureau.newPage();
    await p.goto(lien.replace(/^https?:\/\/[^/]+/, BASE), { waitUntil: "networkidle" });
    await p.locator('[data-atlas="ouvrir-justificatif"]').first().click();
    const panneau = await p.locator('[data-atlas="panneau-justificatif"]').boundingBox();
    const liste = await p.locator('[data-atlas="lignes-du-comptable"]').boundingBox();
    assert.ok(panneau && liste, "le panneau ou la liste n'a pas de boîte : rien à mesurer");
    assert.ok(panneau.width > 300 && panneau.x >= liste.x + liste.width - 1, `la pièce recouvre la liste : ${JSON.stringify({ panneau, liste })}`);
    // Un seul tableau : chaque montant finit au même bord, quel que soit le nom de sa pièce.
    const droites = await p.locator('[data-atlas="montant-de-la-ligne"]').evaluateAll((es) => es.map((e) => Math.round(e.getBoundingClientRect().right)));
    assert.equal(droites.length, 5, "les montants ne se mesurent pas");
    assert.deepEqual([...new Set(droites)].length, 1, `les montants ne tombent pas l'un sous l'autre : ${droites.join(", ")}`);
    await p.click('[data-atlas="rejeter"]');
    assert.deepEqual(await aLEcran(p, ["raison-du-rejet", "confirmer-rejet"]), [], "Rejeter tombe sous l'écran pendant qu'il écrit sa raison");
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
