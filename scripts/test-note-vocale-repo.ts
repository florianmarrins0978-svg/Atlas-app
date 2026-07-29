import assert from "node:assert";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as notesRepo from "../src/server/repositories/notes-vocales";
import { enregistrerObjet, lireObjet } from "../src/server/storage/local-storage";
import { purgerFichiersEnAttente } from "../src/server/repositories/fichiers";

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
    { nom: "Entreprise Note A" },
    { email: "note-a@test.local", nom: "A" }
  );
  const A = { entrepriseId: entA.id, utilisateurId: userA };
  const { entreprise: entB, utilisateurId: userB } = await entreprisesRepo.creerEntreprise(
    { nom: "Entreprise Note B" },
    { email: "note-b@test.local", nom: "B" }
  );
  const B = { entrepriseId: entB.id, utilisateurId: userB };

  const chantier = await chantiersRepo.creerChantier(A, { nom: "Chantier note vocale" });

  await test("Aucune note au départ", async () => {
    const note = await notesRepo.getNoteVocale(A, chantier.id);
    assert.equal(note, null);
  });

  let ancienneCle: string;
  await test("Première création", async () => {
    const objet = await enregistrerObjet(`chantiers/${chantier.id}/notes`, Buffer.from("audio-v1"), ".webm");
    const note = await notesRepo.enregistrerNoteVocale(A, chantier.id, {
      storageKey: objet.storageKey,
      mimeType: "audio/webm",
      tailleOctets: objet.tailleOctets,
      checksum: objet.checksum,
      dureeSecondes: 42,
    });
    ancienneCle = note.storageKey;
    assert.equal(note.dureeSecondes, 42);
  });

  await test("Remplacement atomique : nouvelle clé active, ancienne mise en file (jamais perdue avant purge)", async () => {
    const objet = await enregistrerObjet(`chantiers/${chantier.id}/notes`, Buffer.from("audio-v2"), ".webm");
    const note = await notesRepo.enregistrerNoteVocale(A, chantier.id, {
      storageKey: objet.storageKey,
      mimeType: "audio/webm",
      tailleOctets: objet.tailleOctets,
      checksum: objet.checksum,
      dureeSecondes: 77,
    });
    assert.equal(note.storageKey, objet.storageKey);
    assert.notEqual(note.storageKey, ancienneCle);

    // L'ancienne clé doit encore être physiquement lisible (purge différée, pas immédiate).
    const octetsAncien = await lireObjet(ancienneCle);
    assert.equal(octetsAncien.toString(), "audio-v1");

    const { rows } = await pool.query(`SELECT * FROM fichiers_a_purger WHERE storage_key = $1`, [ancienneCle]);
    assert.equal(rows.length, 1);
  });

  await test("Une seule ligne notes_vocales par chantier après remplacement", async () => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`SELECT set_config('app.entreprise_id', $1, true)`, [A.entrepriseId]);
      const { rows } = await client.query(`SELECT COUNT(*) FROM notes_vocales WHERE chantier_id = $1`, [chantier.id]);
      assert.equal(Number(rows[0].count), 1);
      await client.query("COMMIT");
    } finally {
      client.release();
    }
  });

  await test("Purge différée supprime réellement l'ancienne clé après le délai", async () => {
    await pool.query(`UPDATE fichiers_a_purger SET mis_en_file_le = now() - interval '48 hours' WHERE storage_key = $1`, [
      ancienneCle,
    ]);
    await purgerFichiersEnAttente(24);
    await assert.rejects(() => lireObjet(ancienneCle));
  });

  await test("Isolation : B ne peut pas lire la note vocale du chantier de A", async () => {
    const note = await notesRepo.getNoteVocale(B, chantier.id);
    assert.equal(note, null);
  });

  await test("supprimerNoteVocale : suppression réelle et complète", async () => {
    await notesRepo.supprimerNoteVocale(A, chantier.id);
    const note = await notesRepo.getNoteVocale(A, chantier.id);
    assert.equal(note, null);
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`SELECT set_config('app.entreprise_id', $1, true)`, [A.entrepriseId]);
      const { rows } = await client.query(`SELECT COUNT(*) FROM notes_vocales WHERE chantier_id = $1`, [chantier.id]);
      assert.equal(Number(rows[0].count), 0);
      await client.query("COMMIT");
    } finally {
      client.release();
    }
  });

  console.log(`\n${passed} test(s) réussi(s), ${failed} échoué(s).`);
  await pool.end();
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
