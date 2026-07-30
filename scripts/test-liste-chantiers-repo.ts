import assert from "node:assert";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import { listerChantiersPourAffichage } from "../src/server/repositories/chantiers";
import { getStatutAffiche } from "../src/lib/chantier-etat";
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

async function main() {
  await nettoyerBase();

  const { entreprise: entA, utilisateurId: userA } = await entreprisesRepo.creerEntreprise(
    { nom: "Entreprise Liste A" },
    { email: "liste-a@test.local", nom: "A" }
  );
  const A = { entrepriseId: entA.id, utilisateurId: userA };
  const { entreprise: entB, utilisateurId: userB } = await entreprisesRepo.creerEntreprise(
    { nom: "Entreprise Liste B" },
    { email: "liste-b@test.local", nom: "B" }
  );
  const B = { entrepriseId: entB.id, utilisateurId: userB };

  await test("Entreprise sans chantier -> liste vide", async () => {
    const liste = await listerChantiersPourAffichage(A);
    assert.deepEqual(liste, []);
  });

  const setup = await pool.connect();
  try {
    await setup.query("BEGIN");
    await setup.query(`SELECT set_config('app.entreprise_id', $1, true)`, [A.entrepriseId]);

    // Chantier "brouillon" : rien.
    await setup.query(`INSERT INTO chantiers (entreprise_id, nom) VALUES ($1,'Brouillon test')`, [A.entrepriseId]);

    // Chantier "à vérifier" : photos + note, rien de vérifié.
    const { rows: r1 } = await setup.query(
      `INSERT INTO chantiers (entreprise_id, nom) VALUES ($1,'A verifier test') RETURNING id`,
      [A.entrepriseId]
    );
    await setup.query(
      `INSERT INTO photos (entreprise_id, chantier_id, storage_key, mime_type, taille_octets, checksum) VALUES ($1,$2,'k','image/jpeg',10,'c')`,
      [A.entrepriseId, r1[0].id]
    );
    await setup.query(
      `INSERT INTO notes_vocales (entreprise_id, chantier_id, storage_key, mime_type, taille_octets, checksum) VALUES ($1,$2,'k','audio/mp4',10,'c')`,
      [A.entrepriseId, r1[0].id]
    );

    // Chantier "vérifié" : informations vérifiées, rien de plus.
    await setup.query(
      `INSERT INTO chantiers (entreprise_id, nom, informations_verifiees_at) VALUES ($1,'Verifie test', now())`,
      [A.entrepriseId]
    );

    // Chantier "devis envoyé".
    await setup.query(
      `INSERT INTO chantiers (entreprise_id, nom, informations_verifiees_at, devis_envoye_at) VALUES ($1,'Devis envoye test', now(), now())`,
      [A.entrepriseId]
    );

    // Chantier "planifié".
    await setup.query(
      `INSERT INTO chantiers (entreprise_id, nom, informations_verifiees_at, devis_envoye_at, date_planifiee) VALUES ($1,'Planifie test', now(), now(), '2026-09-01')`,
      [A.entrepriseId]
    );

    await setup.query("COMMIT");
  } finally {
    setup.release();
  }

  await test("getStatutAffiche dérive le bon statut pour chaque cas", async () => {
    const liste = await listerChantiersPourAffichage(A);
    const parNom = Object.fromEntries(liste.map((c) => [c.nom, getStatutAffiche(c)]));
    assert.equal(parNom["Brouillon test"], "brouillon");
    assert.equal(parNom["A verifier test"], "a_verifier");
    assert.equal(parNom["Verifie test"], "verifie");
    assert.equal(parNom["Devis envoye test"], "devis_envoye");
    assert.equal(parNom["Planifie test"], "planifie");
  });

  await test("photosCount et aUneNoteVocale sont corrects", async () => {
    const liste = await listerChantiersPourAffichage(A);
    const c = liste.find((x) => x.nom === "A verifier test")!;
    assert.equal(c.photosCount, 1);
    assert.equal(c.aUneNoteVocale, true);
    const brouillon = liste.find((x) => x.nom === "Brouillon test")!;
    assert.equal(brouillon.photosCount, 0);
    assert.equal(brouillon.aUneNoteVocale, false);
  });

  await test("Isolation : B ne voit aucun chantier de A via listerChantiersPourAffichage", async () => {
    const liste = await listerChantiersPourAffichage(B);
    assert.equal(liste.length, 0);
  });

  console.log(`\n${passed} test(s) réussi(s), ${failed} échoué(s).`);
  await pool.end();
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
