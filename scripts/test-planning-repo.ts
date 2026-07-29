import assert from "node:assert";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import { getPlanificationEtat, trierParDatePlanifiee } from "../src/lib/chantier-etat";

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

async function main() {
  await pool.query(`
    TRUNCATE TABLE
      lignes_devis, devis, lignes_prix, photos, notes_vocales, fichiers_a_purger,
      materiel, prestations, chantiers, clients, tarifs,
      entreprise_compteurs, membres_entreprise, entreprises, users
    RESTART IDENTITY CASCADE
  `);

  const { entreprise: entA, utilisateurId: userA } = await entreprisesRepo.creerEntreprise(
    { nom: "Entreprise Planning A" },
    { email: "planning-a@test.local", nom: "A" }
  );
  const A = { entrepriseId: entA.id, utilisateurId: userA };
  const { entreprise: entB, utilisateurId: userB } = await entreprisesRepo.creerEntreprise(
    { nom: "Entreprise Planning B" },
    { email: "planning-b@test.local", nom: "B" }
  );
  const B = { entrepriseId: entB.id, utilisateurId: userB };

  // Chantier sans devis envoyé : ne doit jamais apparaître dans le planning.
  await chantiersRepo.creerChantier(A, { nom: "Chantier brouillon" });

  // Deux chantiers éligibles (devis envoyé simulé directement en base).
  const c1 = await chantiersRepo.creerChantier(A, { nom: "Chantier à planifier" });
  const c2 = await chantiersRepo.creerChantier(A, { nom: "Chantier à planifier 2" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SELECT set_config('app.entreprise_id', $1, true)`, [A.entrepriseId]);
    await client.query(`UPDATE chantiers SET devis_envoye_at = now() WHERE id = ANY($1)`, [[c1.id, c2.id]]);
    await client.query("COMMIT");
  } finally {
    client.release();
  }

  await test("listerChantiersPourPlanning ne retourne que les chantiers avec devis envoyé", async () => {
    const liste = await chantiersRepo.listerChantiersPourPlanning(A);
    assert.equal(liste.length, 2);
    assert.ok(liste.every((c) => c.devisEnvoyeAt !== null));
  });

  await test("getPlanificationEtat : 'a_planifier' tant qu'aucune date n'est fixée", async () => {
    const liste = await chantiersRepo.listerChantiersPourPlanning(A);
    for (const c of liste) {
      assert.equal(getPlanificationEtat(c), "a_planifier");
    }
  });

  await test("Création d'une intervention (planifierChantier) : passe à 'planifie'", async () => {
    const maj = await chantiersRepo.planifierChantier(A, c1.id, "2026-09-15");
    assert.equal(maj.datePlanifiee, "2026-09-15");
    assert.equal(getPlanificationEtat(maj), "planifie");
  });

  await test("Modification d'une intervention : la date change", async () => {
    const maj = await chantiersRepo.planifierChantier(A, c1.id, "2026-09-20");
    assert.equal(maj.datePlanifiee, "2026-09-20");
  });

  await test("Persistance après relecture", async () => {
    const relu = await chantiersRepo.getChantier(A, c1.id);
    assert.equal(relu?.datePlanifiee, "2026-09-20");
  });

  await test("Tri par date de planification : chantiers sans date en dernier", async () => {
    const liste = await chantiersRepo.listerChantiersPourPlanning(A);
    const tries = trierParDatePlanifiee(liste);
    const indexC1 = tries.findIndex((c) => c.id === c1.id);
    const indexC2 = tries.findIndex((c) => c.id === c2.id);
    assert.ok(indexC1 < indexC2, "c1 (daté) doit précéder c2 (sans date)");
  });

  await test("Suppression d'une intervention (deplanifierChantier) : redevient 'a_planifier'", async () => {
    const maj = await chantiersRepo.deplanifierChantier(A, c1.id);
    assert.equal(maj.datePlanifiee, null);
    assert.equal(getPlanificationEtat(maj), "a_planifier");
  });

  await test("Isolation : B ne voit aucun chantier de A dans son planning", async () => {
    const liste = await chantiersRepo.listerChantiersPourPlanning(B);
    assert.equal(liste.length, 0);
  });

  await test("Isolation : une tentative de B sur un chantier de A n'a aucun effet", async () => {
    const resultat = await chantiersRepo.planifierChantier(B, c2.id, "2026-10-01");
    assert.equal(resultat, undefined, "RLS doit filtrer silencieusement (0 ligne affectée), pas d'exception");
    const relu = await chantiersRepo.getChantier(A, c2.id);
    assert.equal(relu?.datePlanifiee, null, "La tentative de B ne doit avoir aucun effet sur le chantier de A");
  });

  console.log(`\n${passed} test(s) réussi(s), ${failed} échoué(s).`);
  await pool.end();
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
