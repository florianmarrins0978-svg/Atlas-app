/**
 * LES DOSSIERS DU PLAN D'ARROSAGE, EN BASE — migration 0193,
 * `src/server/repositories/dossiers-arrosage.ts`, `ARCHITECTURE.md` §599.
 *
 * Connectée en `atlas_app`, donc pleinement soumise à la RLS : c'est ce que la
 * suite démontre. Une entreprise ne voit, ne relit, ne renomme, ne supprime et
 * n'enrichit jamais le dossier d'une autre, pas même par son identifiant.
 *
 * Et les règles qu'il a posées le 21 novembre 2026 : une version ne s'écrase
 * pas ; le même plan deux fois ne fait pas de version ; supprimer, c'est
 * oublier (nom, lien, photo, lecture et PDF partent, le calcul reste cinq ans) ;
 * effacer un client oublie ses dossiers ; la purge efface au bout de cinq ans.
 */
import assert from "node:assert/strict";
import { pool } from "../src/server/db/client";
import {
  creerDossier,
  enregistrerPlan,
  lirePlan,
  listerDossiers,
  ouvrirDossier,
  purgerLesDossiersOublies,
  renommerDossier,
  supprimerDossier,
  type NouveauPlan,
} from "../src/server/repositories/dossiers-arrosage";
import { effacerClient } from "../src/server/repositories/donnees-client";
import { empreinteDuPlan, figerLePlan, resumeDuPlan, type SaisieDuPlan } from "../src/lib/arrosage/plan-enregistre";
import { RETOUCHES_VIERGES, supprimer } from "../src/lib/arrosage/retouches";
import type { ParametresPlan } from "../src/lib/arrosage/consignes";
import type { Ctx } from "../src/server/repositories/context";
import { nettoyerBase } from "./_test-db";

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

async function creerEntreprise(nom: string): Promise<Ctx> {
  const { rows: e } = await pool.query(`INSERT INTO entreprises (nom) VALUES ($1) RETURNING id`, [nom]);
  const entrepriseId = e[0].id as string;
  const { rows: u } = await pool.query(`INSERT INTO users (email, nom) VALUES ($1,$2) RETURNING id`, [
    `${nom.toLowerCase().replace(/\s/g, "-")}@test.local`,
    nom,
  ]);
  const utilisateurId = u[0].id as string;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SELECT set_config('app.entreprise_id', $1, true)`, [entrepriseId]);
    await client.query(`INSERT INTO membres_entreprise (entreprise_id, utilisateur_id, role) VALUES ($1,$2,'proprietaire')`, [entrepriseId, utilisateurId]);
    await client.query(`INSERT INTO entreprise_compteurs (entreprise_id) VALUES ($1)`, [entrepriseId]);
    await client.query("COMMIT");
  } finally {
    client.release();
  }
  return { entrepriseId, utilisateurId } as Ctx;
}

async function creerClient(ctx: Ctx, nom: string): Promise<string> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SELECT set_config('app.entreprise_id', $1, true)`, [ctx.entrepriseId]);
    const { rows } = await client.query(`INSERT INTO clients (entreprise_id, nom, civilite) VALUES ($1,$2,'mme') RETURNING id`, [ctx.entrepriseId, nom]);
    await client.query("COMMIT");
    return rows[0].id as string;
  } finally {
    client.release();
  }
}

/** Lire une table sous le contexte d'une entreprise : la RLS s'applique comme à l'appli. */
async function sous(ctx: Ctx, requete: string, valeurs: unknown[] = []) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SELECT set_config('app.entreprise_id', $1, true)`, [ctx.entrepriseId]);
    const { rows } = await client.query(requete, valeurs);
    await client.query("COMMIT");
    return rows;
  } finally {
    client.release();
  }
}

const JARDIN = {
  seau: 10, temps: 18, pression: 3, compteur: "oui", regardVersZone: 0, amenee: 0,
  zones: [
    { id: 1, type: "gazon", nom: "Pelouse arrière", x: 0, y: 0, L: 12, l: 12 },
    { id: 2, type: "gazon", nom: "Pelouse avant", x: 14, y: 0, L: 8, l: 8 },
  ],
  nourrice: { x: 13, y: 6 },
  couronne: 50,
} as unknown as ParametresPlan;

function unPlan(saisie: SaisieDuPlan, cles: { photo?: string; pdf?: string } = {}): NouveauPlan {
  const resultat = figerLePlan(saisie);
  return {
    saisie,
    resultat,
    empreinte: empreinteDuPlan(resultat),
    resume: resumeDuPlan(resultat),
    photoCle: cles.photo ?? null,
    pdfCle: cles.pdf ?? null,
    versionCalcul: "essai",
    modele: null,
  };
}

const SAISIE: SaisieDuPlan = { parametres: JARDIN, retouches: RETOUCHES_VIERGES, reservesDuCroquis: [], sansDessin: null, lecture: { zones: 2, lu: "Madame Intel, 3 rue des Lilas" } };

async function main() {
  await nettoyerBase();
  const A = await creerEntreprise("Dossiers A");
  const B = await creerEntreprise("Dossiers B");

  let dossierA = "";
  let planA = "";

  await test("un dossier se crée, et le même nom ne se reprend pas, casse comprise", async () => {
    const c = await creerDossier(A, { nom: "  Plan d’arrosage de Madame Intel ", clientId: null });
    assert.ok(c.ok, c.ok ? "" : c.raison);
    dossierA = c.ok ? c.id : "";
    const deux = await creerDossier(A, { nom: "plan d’arrosage de madame intel", clientId: null });
    assert.deepEqual(deux, { ok: false, raison: "Un dossier porte déjà ce nom." });
    const vide = await creerDossier(A, { nom: "   ", clientId: null });
    assert.equal(vide.ok, false);
    const liste = await listerDossiers(A);
    assert.deepEqual(liste.map((d) => d.nom), ["Plan d’arrosage de Madame Intel"]);
  });

  await test("une version s'ajoute, le même plan deux fois n'en fait pas, un plan retouché en fait une", async () => {
    const v1 = await enregistrerPlan(A, { dossierId: dossierA }, unPlan(SAISIE, { photo: "croquis/a1.jpg", pdf: "plans/a1.pdf" }));
    assert.ok(v1.ok && !v1.deja && v1.version === 1, JSON.stringify(v1));
    planA = v1.ok && !v1.deja ? v1.planId : "";
    const encore = await enregistrerPlan(A, { dossierId: dossierA }, unPlan(SAISIE, { pdf: "plans/a1-bis.pdf" }));
    assert.deepEqual(encore, { ok: true, deja: true, dossierId: dossierA });
    const { rows } = await pool.query(`SELECT 1 FROM fichiers_a_purger WHERE storage_key = 'plans/a1-bis.pdf'`);
    assert.equal(rows.length, 1, "le PDF rangé pour rien n'est pas parti à la purge");
    const retouche = { ...SAISIE, retouches: supprimer(RETOUCHES_VIERGES, figerLePlan(SAISIE).postes.amenee[0].cle) };
    const v2 = await enregistrerPlan(A, { dossierId: dossierA }, unPlan(retouche));
    assert.ok(v2.ok && !v2.deja && v2.version === 2, JSON.stringify(v2));
    const ouvert = await ouvrirDossier(A, dossierA);
    assert.deepEqual(ouvert?.versions.map((v) => v.version), [2, 1]);
  });

  // Les fichiers sont rangés AVANT que le dépôt tranche (l'action compose le
  // PDF puis appelle `enregistrerPlan`) : un refus qui les laisserait dans le
  // stockage y garderait le croquis du client, sans rien qui y renvoie.
  await test("un enregistrement refusé envoie ses fichiers à la purge", async () => {
    const pris = await enregistrerPlan(A, { nouveau: { nom: "plan d’arrosage de madame intel", clientId: null } }, unPlan(SAISIE, { photo: "croquis/refus-nom.jpg", pdf: "plans/refus-nom.pdf" }));
    assert.deepEqual(pris, { ok: false, raison: "Un dossier porte déjà ce nom." });
    const parti = await enregistrerPlan(B, { dossierId: dossierA }, unPlan(SAISIE, { photo: "croquis/refus-dossier.jpg", pdf: "plans/refus-dossier.pdf" }));
    assert.deepEqual(parti, { ok: false, raison: "Ce dossier n’existe plus." });
    const { rows } = await pool.query(`SELECT storage_key FROM fichiers_a_purger WHERE storage_key LIKE '%refus-%' ORDER BY storage_key`);
    assert.deepEqual(rows.map((r) => r.storage_key), ["croquis/refus-dossier.jpg", "croquis/refus-nom.jpg", "plans/refus-dossier.pdf", "plans/refus-nom.pdf"]);
  });

  await test("un plan relu est celui qui a été rendu, sans recalcul", async () => {
    const p = await lirePlan(A, dossierA, planA);
    assert.ok(p);
    assert.equal(p.version, 1);
    assert.equal(p.resultat.plan.secteurs.length, figerLePlan(SAISIE).plan.secteurs.length);
    assert.equal(p.photoCle, "croquis/a1.jpg");
  });

  await test("l'autre entreprise ne voit, ne relit, ne renomme, ne supprime ni n'enrichit ce dossier", async () => {
    assert.deepEqual(await listerDossiers(B), []);
    assert.equal(await ouvrirDossier(B, dossierA), null);
    assert.equal(await lirePlan(B, dossierA, planA), null);
    assert.deepEqual(await renommerDossier(B, dossierA, { nom: "Volé", clientId: null }), { ok: false, raison: "Ce dossier n’existe plus." });
    assert.deepEqual(await supprimerDossier(B, dossierA), { ok: false, raison: "Ce dossier n’existe plus." });
    assert.deepEqual(await enregistrerPlan(B, { dossierId: dossierA }, unPlan(SAISIE)), { ok: false, raison: "Ce dossier n’existe plus." });
    assert.equal((await sous(B, `SELECT id FROM plans_arrosage`)).length, 0);
    // Sans contexte, rien : la RLS ne laisse rien voir, en silence.
    const { rows } = await pool.query(`SELECT id FROM dossiers_arrosage`);
    assert.equal(rows.length, 0);
  });

  await test("un dossier ne se relie qu'à un client de SA propre entreprise", async () => {
    const clientDeB = await creerClient(B, "Client de B");
    const r = await creerDossier(A, { nom: "Chez le client de B", clientId: clientDeB });
    assert.deepEqual(r, { ok: false, raison: "Cette fiche client n’existe plus." });
  });

  await test("supprimer, c'est oublier : nom, lien, photo, lecture et PDF partent ; le calcul reste, cinq ans", async () => {
    const maintenant = new Date("2026-11-21T10:00:00Z");
    const s = await supprimerDossier(A, dossierA, maintenant);
    assert.deepEqual(s, { ok: true });
    assert.deepEqual(await listerDossiers(A), []);
    assert.equal(await lirePlan(A, dossierA, planA), null);
    const [d] = await sous(A, `SELECT nom, client_id, oublie_le FROM dossiers_arrosage WHERE id = $1`, [dossierA]);
    assert.equal(d.nom, null);
    assert.ok(d.oublie_le);
    const plans = await sous(A, `SELECT photo_cle, pdf_cle, saisie->'lecture' AS lecture, resultat IS NOT NULL AS calcul FROM plans_arrosage WHERE dossier_id = $1`, [dossierA]);
    assert.equal(plans.length, 2);
    for (const p of plans) {
      assert.equal(p.photo_cle, null);
      assert.equal(p.pdf_cle, null);
      assert.equal(p.lecture, null, "ce que l'IA a lu sur la photo est resté");
      assert.equal(p.calcul, true);
    }
    const { rows: fichiers } = await pool.query(`SELECT storage_key FROM fichiers_a_purger WHERE storage_key IN ('croquis/a1.jpg','plans/a1.pdf')`);
    assert.equal(fichiers.length, 2, "la photo et le PDF ne sont pas partis à la purge");
    const { rows: file } = await pool.query(`SELECT purger_le FROM dossiers_arrosage_a_purger WHERE dossier_id = $1`, [dossierA]);
    assert.equal(new Date(file[0].purger_le).toISOString(), "2031-11-21T10:00:00.000Z");
  });

  await test("le nom d'un dossier oublié se reprend", async () => {
    const c = await creerDossier(A, { nom: "Plan d’arrosage de Madame Intel", clientId: null });
    assert.ok(c.ok);
  });

  await test("effacer un client oublie ses dossiers", async () => {
    const clientA = await creerClient(A, "Durand");
    const c = await creerDossier(A, { nom: "Jardin Durand", clientId: clientA });
    assert.ok(c.ok);
    const liste = await listerDossiers(A);
    assert.equal(liste.find((d) => d.nom === "Jardin Durand")?.client?.nom, "Mme Durand");
    await effacerClient(A, clientA);
    assert.equal((await listerDossiers(A)).some((d) => d.nom === "Jardin Durand"), false);
    const [d] = await sous(A, `SELECT nom, oublie_le FROM dossiers_arrosage WHERE id = $1`, [c.ok ? c.id : ""]);
    assert.equal(d.nom, null);
    assert.ok(d.oublie_le);
  });

  await test("la purge efface un dossier oublié au bout de cinq ans, pas avant", async () => {
    const avant = await purgerLesDossiersOublies(new Date("2031-11-20T10:00:00Z"));
    assert.equal(avant.dossiersEffaces, 0);
    assert.equal((await sous(A, `SELECT id FROM dossiers_arrosage WHERE id = $1`, [dossierA])).length, 1);
    const apres = await purgerLesDossiersOublies(new Date("2031-11-21T10:00:01Z"));
    assert.equal(apres.dossiersEffaces, 1);
    assert.equal((await sous(A, `SELECT id FROM dossiers_arrosage WHERE id = $1`, [dossierA])).length, 0);
    assert.equal((await sous(A, `SELECT id FROM plans_arrosage WHERE dossier_id = $1`, [dossierA])).length, 0);
  });

  console.log(`\n${failed === 0 ? "✅" : "❌"} Dossiers d'arrosage : ${passed} réussi(s), ${failed} échec(s).`);
  await pool.end();
  process.exit(failed ? 1 : 0);
}

main().catch(async (e) => {
  console.error(e);
  await pool.end();
  process.exit(1);
});
