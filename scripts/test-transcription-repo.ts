import assert from "node:assert";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as notesRepo from "../src/server/repositories/notes-vocales";
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
    { nom: "Entreprise Transcription A" },
    { email: "transcription-a@test.local", nom: "A" }
  );
  const A = { entrepriseId: entA.id, utilisateurId: userA };
  const { entreprise: entB, utilisateurId: userB } = await entreprisesRepo.creerEntreprise(
    { nom: "Entreprise Transcription B" },
    { email: "transcription-b@test.local", nom: "B" }
  );
  const B = { entrepriseId: entB.id, utilisateurId: userB };

  const chantierSansNote = await chantiersRepo.creerChantier(A, { nom: "Chantier sans note" });
  const chantierSansTranscription = await chantiersRepo.creerChantier(A, { nom: "Chantier note sans transcription" });
  const chantierAvecTranscription = await chantiersRepo.creerChantier(A, { nom: "Chantier avec transcription" });

  await test("Chantier sans note vocale : getNoteVocale renvoie null", async () => {
    const note = await notesRepo.getNoteVocale(A, chantierSansNote.id);
    assert.equal(note, null);
  });

  await test("Note vocale sans transcription (cas réel : audio enregistré, pas encore transcrit)", async () => {
    await notesRepo.enregistrerNoteVocale(A, chantierSansTranscription.id, {
      storageKey: "test/note-sans-transcription.webm",
      mimeType: "audio/webm",
      tailleOctets: 1000,
      checksum: "abc",
    });
    const note = await notesRepo.getNoteVocale(A, chantierSansTranscription.id);
    assert.ok(note);
    assert.equal(note?.transcription, null);
  });

  const texte = "Alors pour ce chantier, il faut prévoir deux jours de travail.";
  await test("Note vocale avec transcription : le texte brut est lisible tel quel", async () => {
    await notesRepo.enregistrerNoteVocale(A, chantierAvecTranscription.id, {
      storageKey: "test/note-avec-transcription.webm",
      mimeType: "audio/webm",
      tailleOctets: 2000,
      checksum: "def",
    });
    // Simule un service de transcription qui complète la ligne après coup —
    // mise à jour directe scopée par le contexte RLS de l'entreprise A.
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`SELECT set_config('app.entreprise_id', $1, true)`, [A.entrepriseId]);
      await client.query(`UPDATE notes_vocales SET transcription = $1 WHERE chantier_id = $2`, [
        texte,
        chantierAvecTranscription.id,
      ]);
      await client.query("COMMIT");
    } finally {
      client.release();
    }
    const note = await notesRepo.getNoteVocale(A, chantierAvecTranscription.id);
    assert.equal(note?.transcription, texte);
  });

  await test("Persistance après relecture (nouvelle requête)", async () => {
    const note = await notesRepo.getNoteVocale(A, chantierAvecTranscription.id);
    assert.equal(note?.transcription, texte);
  });

  await test("Isolation : B ne peut pas lire la transcription du chantier de A", async () => {
    const note = await notesRepo.getNoteVocale(B, chantierAvecTranscription.id);
    assert.equal(note, null);
  });

  console.log(`\n${passed} test(s) réussi(s), ${failed} échoué(s).`);
  await pool.end();
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
