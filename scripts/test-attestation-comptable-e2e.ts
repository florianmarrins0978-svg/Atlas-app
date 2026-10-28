import assert from "node:assert";
import type { BrowserContext, Page } from "playwright";
import { ECRAN_DU_PATRON, lancerNavigateur } from "./e2e-browser";
import { allerALAnnee } from "./_choix-annee";
import { pool } from "../src/server/db/client";
import { supprimerObjet } from "../src/server/storage";
import { empreinteDuJeton, tirerUnJeton } from "../src/server/empreinte-du-code";
import { ADRESSE } from "./_adresse";

/**
 * POUR MON COMPTABLE, LOT 6 — l'attestation que le comptable signe, et qui
 * revient au patron. Sa planche du 27 octobre 2026
 * (`appli/soignee/comptable-attestation.html`).
 *
 * La suite base (`test-attestation-comptable-db.ts`, sous `atlas_app`) éprouve
 * les comptes, l'immuabilité et l'isolation ; celle-ci joue le GESTE, des deux
 * côtés, dans l'ordre où il se passe :
 *
 *   1. tant qu'une ligne reste à vérifier, rien ne propose de signer ;
 *   2. la dernière vérifiée, « Terminer et signer » paraît ;
 *   3. conclusion proposée, qui signe, puis l'attestation relue et signée au
 *      doigt : le tampon se pose, et l'écran dit qu'elle est envoyée ;
 *   4. le PDF signé se télécharge par le lien ;
 *   5. revenu au dossier, la barre dit la conclusion au lieu de proposer ;
 *   6. le patron la trouve sur son accueil et dans Mes dossiers, et l'ouvre.
 *
 * Le téléphone du comptable est celui du patron (`ECRAN_DU_PATRON`) : le
 * bouton « Signer et envoyer » doit rester à l'écran sur 664 points.
 */

const BASE = ADRESSE;
const MARQUE = "E2E-ATTEST";

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

/** Un trait du doigt dans la zone de signature : ce que fait le comptable, pas un PNG fabriqué. */
async function signer(page: Page) {
  const zone = page.locator('[data-atlas="zone-de-signature"]');
  await zone.scrollIntoViewIfNeeded();
  const b = await zone.boundingBox();
  assert.ok(b && b.width > 100 && b.height > 60, "la zone de signature ne se mesure pas");
  await page.mouse.move(b.x + 30, b.y + b.height * 0.6);
  await page.mouse.down();
  for (let i = 0; i < 30; i++) await page.mouse.move(b.x + 30 + i * 6, b.y + b.height * 0.6 + Math.sin(i / 3) * 18);
  await page.mouse.up();
}

async function main() {
  const { rows } = await pool.query(
    `SELECT m.entreprise_id AS entreprise, m.utilisateur_id AS utilisateur FROM membres_entreprise m JOIN users u ON u.id = m.utilisateur_id WHERE u.email = 'demo@atlas.local' LIMIT 1`
  );
  assert.ok(rows[0], "le compte de démonstration est absent : la base n'est pas amorcée");
  const { entreprise, utilisateur } = rows[0] as { entreprise: string; utilisateur: string };
  const { rows: base } = await pool.query(`SELECT current_database() AS nom`);
  assert.match(base[0].nom, /^atlas_test/, "cette suite vide les dossiers : elle refuse une autre base qu'une base d'essai");

  const nettoyer = async () => {
    // Les PDF signés d'abord : la ligne partie, plus rien ne dirait où ils sont.
    const { rows: fichiers } = await pool.query(`SELECT fichier_cle FROM attestations_comptable WHERE entreprise_id = $1`, [entreprise]);
    for (const f of fichiers as { fichier_cle: string }[]) await supprimerObjet(f.fichier_cle);
    await pool.query(`DELETE FROM dossiers_comptables WHERE entreprise_id = $1`, [entreprise]);
    await pool.query(`DELETE FROM mouvements_bancaires WHERE entreprise_id = $1 AND cle LIKE $2`, [entreprise, `${MARQUE}%`]);
  };
  await nettoyer();

  // Un dossier de mars 2025 : deux lignes, l'une validée, l'autre encore à vérifier.
  const ligne = async (cle: string, jour: string, montant: string, libelle: string) =>
    (
      await pool.query(
        `INSERT INTO mouvements_bancaires (entreprise_id, cle, jour, montant, sens, libelle, justification, relie_par, justifie_le)
         VALUES ($1, $2, $3, $4, 'sortie', $5, 'ticket_perdu', 'patron', now() - interval '1 hour') RETURNING id`,
        [entreprise, `${MARQUE}-${cle}`, jour, montant, libelle]
      )
    ).rows[0].id as string;
  const gasoil = await ligne("GASOIL", "2025-03-09", "48.11", "CB ITM STATION ATTEST");
  const edf = await ligne("EDF", "2025-03-12", "9.28", "PRLV EDF DOMICILE ATTEST");
  const dossier = (
    await pool.query(
      `INSERT INTO dossiers_comptables (entreprise_id, du, au, fichier_cle, taille_octets, empreinte, garde_jusqu_au, arrete_par)
       VALUES ($1, '2025-03-01', '2025-03-31', 'e2e-attest', 1000, repeat('c', 64), '2035-03-31', $2) RETURNING id`,
      [entreprise, utilisateur]
    )
  ).rows[0].id as string;
  const jeton = tirerUnJeton();
  await pool.query(
    `INSERT INTO envois_comptable (entreprise_id, dossier_id, jeton_empreinte, cree_par, expire_le) VALUES ($1, $2, $3, $4, now() + interval '1 day')`,
    [entreprise, dossier, empreinteDuJeton(jeton), utilisateur]
  );
  await pool.query(
    `INSERT INTO verdicts_comptable (entreprise_id, dossier_id, mouvement_id, verdict, ligne_justifiee_le) SELECT $1, $2, id, 'valide', justifie_le FROM mouvements_bancaires WHERE id = $3`,
    [entreprise, dossier, gasoil]
  );

  const browser = await lancerNavigateur();
  const comptable = await browser.newContext({ ...ECRAN_DU_PATRON });
  const lui = await comptable.newPage();
  const adresse = `${BASE}/comptable/${jeton}`;

  await test("tant qu'une ligne reste à vérifier, rien ne propose de signer", async () => {
    await lui.goto(adresse, { waitUntil: "networkidle" });
    assert.match(await lui.locator('[data-atlas="avancement"]').innerText(), /1 sur 2/);
    assert.equal(await lui.locator('[data-atlas="terminer-et-signer"]').count(), 0);
  });

  await test("la dernière ligne rejetée, « Terminer et signer » paraît", async () => {
    const rangee = lui.locator('[data-atlas="ligne-du-comptable"]', { hasText: "PRLV EDF DOMICILE ATTEST" });
    await rangee.locator('[aria-label="Rejeter"]').click();
    await lui.fill('[data-atlas="raison-du-rejet"]', "Contrat du domicile.");
    await lui.click('[data-atlas="confirmer-rejet"]');
    await lui.locator('[data-atlas="panneau-justificatif"] button', { hasText: "Fermer" }).click();
    await lui.locator('[data-atlas="terminer-et-signer"]').waitFor({ timeout: 20_000 });
  });

  await test("conclusion proposée, qui signe, puis l'attestation signée au doigt", async () => {
    await lui.click('[data-atlas="terminer-et-signer"]');
    // Un rejet : Atlas propose « avec réserves », et la ligne rejetée se relit.
    assert.equal(await lui.locator('[data-atlas="conclusion-reserves"]').getAttribute("aria-checked"), "true");
    assert.match(await lui.locator('[data-atlas="lignes-rejetees"]').innerText(), /PRLV EDF DOMICILE ATTEST[\s\S]*Contrat du domicile/);
    await lui.click('[data-atlas="continuer"]');
    assert.equal(await lui.locator('[data-atlas="continuer"]').isDisabled(), true, "on continue sans dire qui signe");
    await lui.getByLabel("Nom et prénom", { exact: true }).fill("Claire Bernard");
    await lui.getByLabel("Dénomination sociale", { exact: true }).fill("Cabinet Bernard & Associés");
    await lui.getByLabel("E-mail", { exact: true }).fill("claire@cabinet-bernard.fr");
    await lui.click('[data-atlas="continuer"]');
    const apercu = await lui.locator('[data-atlas="apercu-attestation"]').innerText();
    assert.match(apercu, /Conforme avec réserves/);
    assert.match(apercu, /J’atteste avoir contrôlé les 2 lignes/);
    assert.equal(await lui.locator('[data-atlas="signer-et-envoyer"]').isDisabled(), true, "on signe sans avoir signé");
    await signer(lui);
    await lui.click('[data-atlas="signer-et-envoyer"]');
    await lui.locator('[data-atlas="tampon-pose"]').waitFor({ timeout: 30_000 });
    await lui.locator('[data-atlas="attestation-envoyee"]').waitFor({ timeout: 15_000 });
  });

  await test("le PDF signé se télécharge par le lien", async () => {
    const r = await lui.request.get(`${adresse}/attestation/pdf?telecharger=1`);
    assert.equal(r.status(), 200);
    assert.equal(r.headers()["content-type"], "application/pdf");
    assert.equal((await r.body()).subarray(0, 5).toString("latin1"), "%PDF-");
  });

  await test("revenu au dossier, la barre dit la conclusion au lieu de proposer", async () => {
    await lui.locator("button", { hasText: "Revenir au dossier" }).click();
    await lui.reload({ waitUntil: "networkidle" });
    assert.match(await lui.locator('[data-atlas="attestation-signee"]').innerText(), /Conforme avec réserves[\s\S]*Signée le/);
    assert.equal(await lui.locator('[data-atlas="terminer-et-signer"]').count(), 0);
  });

  const patron = await browser.newContext({ ...ECRAN_DU_PATRON });
  const page = await seConnecter(patron);

  await test("le patron la trouve sur son accueil, et « J'ai vu » la range", async () => {
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    const carte = page.locator('[data-atlas="carte-attestation"]');
    await carte.waitFor({ timeout: 20_000 });
    assert.match(await carte.innerText(), /Votre comptable a signé[\s\S]*Conforme avec réserves[\s\S]*Claire Bernard a vérifié les 2 lignes du dossier\. 1 ligne à reprendre\./);
    await carte.locator("button", { hasText: "J’ai vu" }).click();
    await page.reload({ waitUntil: "networkidle" });
    assert.equal(await page.locator('[data-atlas="carte-attestation"]').count(), 0);
  });

  await test("le patron l'ouvre dans Mes dossiers, sous le compte du comptable", async () => {
    await page.goto(`${BASE}/termines/comptable/dossiers`, { waitUntil: "networkidle" });
    await allerALAnnee(page, 2025);
    const rangee = page.locator('[data-atlas="attestation-du-comptable"]');
    assert.match(await rangee.innerText(), /Attestation du comptable[\s\S]*Conforme avec réserves, signée le/);
    const href = (await rangee.locator('[data-atlas="ouvrir-attestation"]').getAttribute("href")) ?? "";
    const fichier = new URL(href, BASE).searchParams.get("fichier") ?? "";
    assert.match(fichier, /^\/termines\/comptable\/attestations\/[0-9a-f-]{36}\/pdf$/);
    const r = await page.request.get(`${BASE}${fichier}`);
    assert.equal(r.status(), 200);
    assert.equal(r.headers()["content-type"], "application/pdf");
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
