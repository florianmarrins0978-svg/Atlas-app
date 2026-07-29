import assert from "node:assert";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import { getChantierPourHub } from "../src/server/repositories/chantiers";
import { getNextAction, getSecondarySteps, getStatutAffiche } from "../src/lib/chantier-etat";

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
    { nom: "Entreprise Hub A" },
    { email: "hub-a@test.local", nom: "A" }
  );
  const A = { entrepriseId: entA.id, utilisateurId: userA };
  const { entreprise: entB, utilisateurId: userB } = await entreprisesRepo.creerEntreprise(
    { nom: "Entreprise Hub B" },
    { email: "hub-b@test.local", nom: "B" }
  );
  const B = { entrepriseId: entB.id, utilisateurId: userB };

  let chantierId: string;
  const setup = await pool.connect();
  try {
    await setup.query("BEGIN");
    await setup.query(`SELECT set_config('app.entreprise_id', $1, true)`, [A.entrepriseId]);
    const { rows: c } = await setup.query(`INSERT INTO clients (entreprise_id, nom) VALUES ($1,'Client Hub') RETURNING id`, [
      A.entrepriseId,
    ]);
    const { rows: ch } = await setup.query(
      `INSERT INTO chantiers (entreprise_id, client_id, nom, adresse_chantier, informations_verifiees_at)
       VALUES ($1,$2,'Chantier Hub','12 rue Test', now()) RETURNING id`,
      [A.entrepriseId, c[0].id]
    );
    chantierId = ch[0].id;
    await setup.query(
      `INSERT INTO photos (entreprise_id, chantier_id, storage_key, mime_type, taille_octets, checksum) VALUES ($1,$2,'k','image/jpeg',10,'c')`,
      [A.entrepriseId, chantierId]
    );
    await setup.query(
      `INSERT INTO notes_vocales (entreprise_id, chantier_id, storage_key, mime_type, taille_octets, checksum) VALUES ($1,$2,'k','audio/mp4',10,'c')`,
      [A.entrepriseId, chantierId]
    );
    await setup.query("COMMIT");
  } finally {
    setup.release();
  }

  await test("getChantierPourHub retourne le chantier avec client + agrégats", async () => {
    const c = await getChantierPourHub(A, chantierId);
    assert.ok(c);
    assert.equal(c!.nom, "Chantier Hub");
    assert.equal(c!.clientNom, "Client Hub");
    assert.equal(c!.photosCount, 1);
    assert.ok(c!.informationsVerifieesAt !== null);
  });

  await test("Chantier introuvable -> null", async () => {
    const c = await getChantierPourHub(A, "00000000-0000-0000-0000-000000000000");
    assert.equal(c, null);
  });

  await test("Chantier d'une autre entreprise -> null (jamais distingué d'introuvable)", async () => {
    const c = await getChantierPourHub(B, chantierId);
    assert.equal(c, null);
  });

  await test("getNextAction / getSecondarySteps fonctionnent sur la forme réelle", async () => {
    const c = await getChantierPourHub(A, chantierId);
    const statut = getStatutAffiche(c!);
    assert.equal(statut, "verifie"); // photos + info vérifiées, pas de prix -> "verifie"
    const next = getNextAction(c!);
    assert.equal(next?.key, "prix");
    const steps = getSecondarySteps(c!.id, c!, next?.key);
    assert.ok(!steps.some((s) => s.key === "prix"), "L'étape correspondant à l'action principale ne doit pas être dupliquée");
    const photosStep = steps.find((s) => s.key === "photos");
    assert.equal(photosStep?.done, true);
    assert.equal(photosStep?.meta, "1 photo");
  });

  console.log(`\n${passed} test(s) réussi(s), ${failed} échoué(s).`);
  await pool.end();
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
