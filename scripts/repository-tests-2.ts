import assert from "node:assert";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as membresRepo from "../src/server/repositories/membres-entreprise";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as photosRepo from "../src/server/repositories/photos";
import * as notesRepo from "../src/server/repositories/notes-vocales";
import { purgerFichiersEnAttente } from "../src/server/repositories/fichiers";
import { nettoyerBase } from "./_test-db";

// Lancer : DATABASE_URL=postgresql://atlas_owner:...@127.0.0.1:5432/atlas_test npx tsx scripts/repository-tests-2.ts

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

  // ===================================================================
  // 1-2. entreprises : création atomique (entreprise + adhésion + compteur)
  // ===================================================================

  const { entreprise: entrepriseA, utilisateurId: userA } = await entreprisesRepo.creerEntreprise(
    { nom: "Entreprise Repo2 A" },
    { email: "repo2-a@test.local", nom: "Propriétaire A" }
  );
  const A: { entrepriseId: string; utilisateurId: string } = { entrepriseId: entrepriseA.id, utilisateurId: userA };

  await test("creerEntreprise provisionne entreprise + adhésion + compteur atomiquement", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`SELECT set_config('app.entreprise_id', $1, true)`, [entrepriseA.id]);
      const membre = await client.query(
        `SELECT role FROM membres_entreprise WHERE entreprise_id=$1 AND utilisateur_id=$2`,
        [entrepriseA.id, userA]
      );
      assert.equal(membre.rows[0]?.role, "proprietaire");

      const compteur = await client.query(
        `SELECT prochain_numero_devis FROM entreprise_compteurs WHERE entreprise_id=$1`,
        [entrepriseA.id]
      );
      assert.equal(compteur.rows[0]?.prochain_numero_devis, 1);
      await client.query("COMMIT");
    } finally {
      client.release();
    }
  });

  const { entreprise: entrepriseB, utilisateurId: userB } = await entreprisesRepo.creerEntreprise(
    { nom: "Entreprise Repo2 B" },
    { email: "repo2-b@test.local", nom: "Propriétaire B" }
  );
  const B = { entrepriseId: entrepriseB.id, utilisateurId: userB };

  await test("ajouterMembre + listerMembres", async () => {
    const { utilisateurId: second } = await entreprisesRepo.creerEntreprise(
      { nom: "Entreprise jetable (pour créer un 2e utilisateur)" },
      { email: "second-membre@test.local", nom: "Second" }
    );
    await membresRepo.ajouterMembre(A, second, "membre");
    const membres = await membresRepo.listerMembres(A);
    assert.equal(membres.length, 2);
  });

  await test("Isolation : B ne voit pas les membres de A", async () => {
    const membresVusParB = await membresRepo.listerMembres(B);
    assert.ok(membresVusParB.every((m) => m.entrepriseId === B.entrepriseId));
  });

  // ===================================================================
  // 3. Photos et notes vocales
  // ===================================================================

  const chantierA = await chantiersRepo.creerChantier(A, { nom: "Chantier photos" });

  await test("ajouterPhoto + listerPhotos", async () => {
    await photosRepo.ajouterPhoto(A, chantierA.id, {
      storageKey: "test/photo-1.jpg",
      mimeType: "image/jpeg",
      tailleOctets: 1000,
      checksum: "c1",
    });
    await photosRepo.ajouterPhoto(A, chantierA.id, {
      storageKey: "test/photo-2.jpg",
      mimeType: "image/jpeg",
      tailleOctets: 1000,
      checksum: "c2",
    });
    const liste = await photosRepo.listerPhotos(A, chantierA.id);
    assert.equal(liste.length, 2);
    assert.equal(liste[1].ordre, 1);
  });

  await test("Isolation : B ne peut pas lister les photos du chantier de A", async () => {
    const liste = await photosRepo.listerPhotos(B, chantierA.id);
    assert.equal(liste.length, 0);
  });

  await test("supprimerPhoto : soft delete + mise en file de purge", async () => {
    const [photo] = await photosRepo.listerPhotos(A, chantierA.id);
    await photosRepo.supprimerPhoto(A, photo.id);
    const liste = await photosRepo.listerPhotos(A, chantierA.id);
    assert.equal(liste.length, 1, "La photo supprimée ne doit plus apparaître dans la liste active");
    const { rows } = await pool.query(`SELECT * FROM fichiers_a_purger WHERE storage_key = $1`, [photo.storageKey]);
    assert.equal(rows.length, 1, "La clé supprimée doit être mise en file de purge");
  });

  await test("enregistrerNoteVocale : première création", async () => {
    const note = await notesRepo.enregistrerNoteVocale(A, chantierA.id, {
      storageKey: "test/note-v1.m4a",
      mimeType: "audio/mp4",
      tailleOctets: 5000,
      checksum: "n1",
      dureeSecondes: 60,
    });
    assert.equal(note.storageKey, "test/note-v1.m4a");
  });

  await test("enregistrerNoteVocale : remplacement — ancienne clé mise en file, jamais perdue avant purge", async () => {
    await notesRepo.enregistrerNoteVocale(A, chantierA.id, {
      storageKey: "test/note-v2.m4a",
      mimeType: "audio/mp4",
      tailleOctets: 6000,
      checksum: "n2",
      dureeSecondes: 90,
    });
    const note = await notesRepo.getNoteVocale(A, chantierA.id);
    assert.equal(note?.storageKey, "test/note-v2.m4a", "La note doit maintenant pointer sur la nouvelle clé");

    const { rows } = await pool.query(`SELECT * FROM fichiers_a_purger WHERE storage_key = $1`, ["test/note-v1.m4a"]);
    assert.equal(rows.length, 1, "L'ancienne clé doit être en file de purge, pas supprimée directement");
  });

  await test("Échec simulé d'un remplacement : rollback ne perd jamais la dernière version valide", async () => {
    const avant = await notesRepo.getNoteVocale(A, chantierA.id);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`SELECT set_config('app.entreprise_id', $1, true)`, [A.entrepriseId]);
      await client.query(`UPDATE notes_vocales SET storage_key = 'test/note-v3-ratee.m4a' WHERE chantier_id = $1`, [
        chantierA.id,
      ]);
      // Simulation d'un échec après l'écriture mais avant la validation (ex. erreur réseau upload).
      await client.query("ROLLBACK");
    } finally {
      client.release();
    }
    const apres = await notesRepo.getNoteVocale(A, chantierA.id);
    assert.equal(apres?.storageKey, avant?.storageKey, "La note doit rester sur la dernière version validée");
    assert.notEqual(apres?.storageKey, "test/note-v3-ratee.m4a");
  });

  // ===================================================================
  // 4. Purge idempotente
  // ===================================================================

  await test("purgerFichiersEnAttente : purge les entrées anciennes, idempotent si rejoué", async () => {
    await pool.query(
      `INSERT INTO fichiers_a_purger (storage_key, mis_en_file_le) VALUES ('test/vieux-fichier.jpg', now() - interval '48 hours')`
    );
    const nb1 = await purgerFichiersEnAttente(24);
    assert.ok(nb1 >= 1, "Au moins l'entrée ancienne doit être purgée");
    const nb2 = await purgerFichiersEnAttente(24);
    assert.equal(nb2, 0, "Rejouer la purge sans nouvelle entrée ne doit rien supprimer (idempotent)");
  });

  await test("purgerFichiersEnAttente : respecte le délai de grâce (récent = pas encore purgé)", async () => {
    await pool.query(`INSERT INTO fichiers_a_purger (storage_key, mis_en_file_le) VALUES ('test/recent.jpg', now())`);
    const nb = await purgerFichiersEnAttente(24);
    assert.equal(nb, 0, "Un fichier récent ne doit pas être purgé avant le délai de grâce");
  });

  console.log(`\n${passed} test(s) réussi(s), ${failed} échoué(s).`);
  await pool.end();
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
