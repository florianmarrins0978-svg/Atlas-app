import assert from "node:assert";
import type { BrowserContext, Page } from "playwright";
import { ECRAN_DU_PATRON, lancerNavigateur } from "./e2e-browser";
import { allerALAnnee } from "./_choix-annee";
import { pool } from "../src/server/db/client";
import { empreinteDuJeton, tirerUnJeton } from "../src/server/empreinte-du-code";
import { ADRESSE } from "./_adresse";

/**
 * POUR MON COMPTABLE, LOT 7 : le comptable renvoie le dossier à corriger. Sa
 * planche du 27 octobre 2026 (`appli/soignee/comptable-retour.html`).
 *
 * La suite base (`test-retour-comptable-db.ts`, sous `atlas_app`) éprouve le
 * refus sans rejet, l'immuabilité et l'isolation ; celle-ci joue la BOUCLE,
 * des deux côtés, dans l'ordre où elle se passe :
 *
 *   1. une ligne rejetée, « Renvoyer à corriger » paraît sans attendre la fin ;
 *   2. le comptable relit ses rejets, laisse un mot et son adresse, renvoie ;
 *   3. revenu au dossier, la barre dit quand il a renvoyé ;
 *   4. le patron trouve la demande sur son accueil, avec le mot ;
 *   5. dans Mes dossiers, il reprend la ligne : « Tout est corrigé », et
 *      « Prévenir mon comptable » ouvre SA messagerie, adressée au comptable ;
 *   6. le comptable, sur le même lien, voit la ligne corrigée en tête.
 *
 * Rien ne part au comptable sans l'appui du patron : la suite vérifie que le
 * geste est un `mailto:`, jamais un envoi d'Atlas.
 */

const BASE = ADRESSE;
const MARQUE = "E2E-RETOUR";
const MOT = "Une ligne à reprendre avant que je signe.";

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

async function main() {
  const { rows } = await pool.query(
    `SELECT m.entreprise_id AS entreprise, m.utilisateur_id AS utilisateur FROM membres_entreprise m JOIN users u ON u.id = m.utilisateur_id WHERE u.email = 'demo@atlas.local' LIMIT 1`
  );
  assert.ok(rows[0], "le compte de démonstration est absent : la base n'est pas amorcée");
  const { entreprise, utilisateur } = rows[0] as { entreprise: string; utilisateur: string };
  const { rows: base } = await pool.query(`SELECT current_database() AS nom`);
  assert.match(base[0].nom, /^atlas_test/, "cette suite vide les dossiers : elle refuse une autre base qu'une base d'essai");

  // Le renvoi part avec son dossier (clé étrangère en cascade).
  const nettoyer = async () => {
    await pool.query(`DELETE FROM dossiers_comptables WHERE entreprise_id = $1`, [entreprise]);
    await pool.query(`DELETE FROM mouvements_bancaires WHERE entreprise_id = $1 AND cle LIKE $2`, [entreprise, `${MARQUE}%`]);
  };
  await nettoyer();

  // Un dossier d'avril 2025 : deux lignes, l'une validée, l'autre à vérifier.
  const ligne = async (cle: string, jour: string, montant: string, libelle: string) =>
    (
      await pool.query(
        `INSERT INTO mouvements_bancaires (entreprise_id, cle, jour, montant, sens, libelle, justification, relie_par, justifie_le)
         VALUES ($1, $2, $3, $4, 'sortie', $5, 'ticket_perdu', 'patron', now() - interval '1 hour') RETURNING id`,
        [entreprise, `${MARQUE}-${cle}`, jour, montant, libelle]
      )
    ).rows[0].id as string;
  const gasoil = await ligne("GASOIL", "2025-04-09", "48.11", "CB ITM STATION RETOUR");
  await ligne("POSTE", "2025-04-12", "9.28", "CB LA POSTE RETOUR");
  const dossier = (
    await pool.query(
      `INSERT INTO dossiers_comptables (entreprise_id, du, au, fichier_cle, taille_octets, empreinte, garde_jusqu_au, arrete_par)
       VALUES ($1, '2025-04-01', '2025-04-30', 'e2e-retour', 1000, repeat('e', 64), '2035-04-30', $2) RETURNING id`,
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

  await test("sans rejet, rien ne propose de renvoyer", async () => {
    await lui.goto(adresse, { waitUntil: "networkidle" });
    assert.match(await lui.locator('[data-atlas="avancement"]').innerText(), /1 sur 2/);
    assert.equal(await lui.locator('[data-atlas="renvoyer-a-corriger"]').count(), 0);
  });

  await test("une ligne rejetée, « Renvoyer à corriger » paraît", async () => {
    const rangee = lui.locator('[data-atlas="ligne-du-comptable"]', { hasText: "CB LA POSTE RETOUR" });
    await rangee.locator('[aria-label="Rejeter"]').click();
    await lui.fill('[data-atlas="raison-du-rejet"]', "Ce ticket se retrouve.");
    await lui.click('[data-atlas="confirmer-rejet"]');
    await lui.locator('[data-atlas="panneau-justificatif"] button', { hasText: "Fermer" }).click();
    await lui.locator('[data-atlas="renvoyer-a-corriger"]').waitFor({ timeout: 20_000 });
  });

  await test("il relit ses rejets, laisse un mot et son adresse, et renvoie", async () => {
    await lui.click('[data-atlas="renvoyer-a-corriger"]');
    assert.match(await lui.locator('[data-atlas="lignes-renvoyees"]').innerText(), /CB LA POSTE RETOUR[\s\S]*Rejetée : Ce ticket se retrouve\./);
    await lui.fill('[data-atlas="mot-du-comptable"]', MOT);
    await lui.getByLabel("Votre e-mail", { exact: true }).fill("claire@cabinet-bernard.fr");
    await lui.click('[data-atlas="renvoyer-a-l-artisan"]');
    const envoye = lui.locator('[data-atlas="renvoi-envoye"]');
    await envoye.waitFor({ timeout: 20_000 });
    assert.match(await envoye.innerText(), /Renvoyé à[\s\S]*1 ligne à reprendre\.[\s\S]*claire@cabinet-bernard\.fr/);
  });

  await test("revenu au dossier, la barre dit quand il a renvoyé", async () => {
    await lui.click('[data-atlas="revenir-au-dossier"]');
    await lui.reload({ waitUntil: "networkidle" });
    assert.match(await lui.locator('[data-atlas="deja-renvoye"]').innerText(), /^Renvoyé le /);
  });

  const patron = await browser.newContext({ ...ECRAN_DU_PATRON });
  const page = await seConnecter(patron);

  await test("le patron trouve la demande sur son accueil, avec le mot", async () => {
    await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
    const carte = page.locator('[data-atlas="carte-correction-comptable"]');
    await carte.waitFor({ timeout: 20_000 });
    assert.match(await carte.innerText(), /Correction demandée[\s\S]*«\s?Une ligne à reprendre avant que je signe\.\s?»[\s\S]*Votre comptable a rejeté 1 ligne\./);
    assert.doesNotMatch(await carte.innerText(), /1 ligne à reprendre/, "la carte redit ce qu'elle vient de dire");
    assert.equal(await carte.locator('a', { hasText: "Corriger les lignes" }).getAttribute("href"), "/termines/comptable/dossiers");
  });

  await test("« J'ai vu » range la carte de l'accueil", async () => {
    await page.locator('[data-atlas="carte-correction-comptable"] button', { hasText: "J’ai vu" }).click();
    await page.reload({ waitUntil: "networkidle" });
    assert.equal(await page.locator('[data-atlas="carte-correction-comptable"]').count(), 0);
  });

  await test("dans Mes dossiers, il reprend la ligne, et le comptable se prévient de SA messagerie", async () => {
    await page.goto(`${BASE}/termines/comptable/dossiers`, { waitUntil: "networkidle" });
    await allerALAnnee(page, 2025);
    assert.match(await page.locator('[data-atlas="correction-demandee"]').innerText(), /Correction demandée le[\s\S]*«\s?Une ligne à reprendre avant que je signe\.\s?»/);
    const carte = page.locator('[data-atlas="rejets-du-comptable"] [data-atlas="ligne-a-regarder"]');
    assert.equal(await carte.count(), 1);
    await carte.locator('[data-atlas="ticket-perdu"]').click();
    await carte.locator('[data-atlas="valider-ticket-perdu"]').click();
    const prevenir = page.locator('[data-atlas="tout-corrige"] [data-atlas="prevenir-mon-comptable"]');
    await prevenir.waitFor({ timeout: 30_000 });
    assert.equal(await page.locator('[data-atlas="correction-demandee"]').count(), 0);
    const href = (await prevenir.getAttribute("href")) ?? "";
    assert.match(href, /^mailto:claire@cabinet-bernard\.fr\?/, "le geste doit ouvrir sa messagerie, adressée au comptable");
    const parametres = new URLSearchParams(href.slice(href.indexOf("?") + 1));
    assert.equal(parametres.get("subject"), "Dossier justifié corrigé");
    assert.doesNotMatch(parametres.get("body") ?? "", /https?:/, "le lien du comptable ne voyage pas");
  });

  await test("le comptable, sur le même lien, voit la ligne corrigée", async () => {
    await lui.reload({ waitUntil: "networkidle" });
    await lui.locator('[data-atlas="lignes-corrigees"]').waitFor({ timeout: 20_000 });
    assert.match(await lui.locator('[data-atlas="ligne-du-comptable"]', { hasText: "CB LA POSTE RETOUR" }).innerText(), /Corrigée depuis votre rejet : Ce ticket se retrouve/);
    assert.equal(await lui.locator('[data-atlas="renvoyer-a-corriger"]').count(), 0, "plus aucun rejet : plus rien à renvoyer");
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
