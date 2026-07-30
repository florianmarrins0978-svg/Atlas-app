import assert from "node:assert";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as notesRepo from "../src/server/repositories/notes-vocales";
import { fournisseurTranscriptionDev } from "../src/server/ai/providers/transcription/dev";
import { extraire } from "../src/server/ai/services/extraction-service";
import { PropositionExtractionSchema } from "../src/server/ai/schemas/extraction";
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
    { nom: "Entreprise IA A" },
    { email: "ia-a@test.local", nom: "A" }
  );
  const A = { entrepriseId: entA.id, utilisateurId: userA };
  const { entreprise: entB, utilisateurId: userB } = await entreprisesRepo.creerEntreprise(
    { nom: "Entreprise IA B" },
    { email: "ia-b@test.local", nom: "B" }
  );
  const B = { entrepriseId: entB.id, utilisateurId: userB };

  // --- Fournisseur transcription (dev) ---

  await test("Fournisseur transcription dev : succès sur un fichier non vide", async () => {
    const resultat = await fournisseurTranscriptionDev.transcrire(Buffer.from("abc"), "audio/webm");
    assert.equal(resultat.succes, true);
    if (resultat.succes) assert.match(resultat.texte, /simulée/);
  });

  await test("Fournisseur transcription dev : échec propre sur fichier vide (jamais de texte inventé)", async () => {
    const resultat = await fournisseurTranscriptionDev.transcrire(Buffer.from(""), "audio/webm");
    assert.equal(resultat.succes, false);
  });

  // --- Fournisseur extraction (dev) ---

  await test("Fournisseur extraction dev : détecte durée, équipe, matériel, prestations", async () => {
    const texte =
      "Chantier Dupont, deux jours, deux hommes, dix plaques de BA13, poser la cloison, évacuation des déchets";
    const resultat = await extraire(texte);
    assert.equal(resultat.succes, true);
    if (resultat.succes) {
      assert.match(resultat.proposition.dureePrevue ?? "", /jour/);
      assert.match(resultat.proposition.tailleEquipe ?? "", /homme/);
      assert.ok(resultat.proposition.materiel.some((m) => /plaque/i.test(m.libelle)));
      assert.ok(resultat.proposition.prestations.length > 0);
    }
  });

  await test("Fournisseur extraction dev : texte vide rejeté proprement", async () => {
    const resultat = await extraire("");
    assert.equal(resultat.succes, false);
  });

  await test("Fournisseur extraction dev : ambiguïté conservée et signalée séparément", async () => {
    const resultat = await extraire("Peut-être trois jours, poser du carrelage");
    assert.equal(resultat.succes, true);
    if (resultat.succes) {
      assert.ok(resultat.proposition.ambiguites.length > 0, "Une ambiguïté doit être détectée");
    }
  });

  await test("Validation zod : rejette une réponse hors schéma (simulateur de réponse IA invalide)", async () => {
    const reponseInvalide = { prestations: "pas un tableau" };
    const analyse = PropositionExtractionSchema.safeParse(reponseInvalide);
    assert.equal(analyse.success, false);
  });

  // --- Transitions d'état de transcription ---

  const chantier = await chantiersRepo.creerChantier(A, { nom: "Chantier IA" });
  await notesRepo.enregistrerNoteVocale(A, chantier.id, {
    storageKey: "test/ia-note.webm",
    mimeType: "audio/webm",
    tailleOctets: 100,
    checksum: "abc",
  });

  await test("État initial : non_demandee", async () => {
    const note = await notesRepo.getNoteVocale(A, chantier.id);
    assert.equal(note?.transcriptionStatut, "non_demandee");
  });

  await test("marquerTranscriptionEnCours : passe à en_cours, efface une éventuelle erreur précédente", async () => {
    const note = await notesRepo.marquerTranscriptionEnCours(A, chantier.id);
    assert.equal(note.transcriptionStatut, "en_cours");
    assert.equal(note.transcriptionErreur, null);
  });

  await test("enregistrerSuccesTranscription : passe à reussie avec le texte", async () => {
    const note = await notesRepo.enregistrerSuccesTranscription(A, chantier.id, "Texte transcrit réel.");
    assert.equal(note.transcriptionStatut, "reussie");
    assert.equal(note.transcription, "Texte transcrit réel.");
  });

  await test("enregistrerEchecTranscription : passe à echouee", async () => {
    const note = await notesRepo.enregistrerEchecTranscription(A, chantier.id, "Erreur technique simulée.");
    assert.equal(note.transcriptionStatut, "echouee");
    assert.equal(note.transcriptionErreur, "Erreur technique simulée.");
  });

  await test("Remplacement de l'audio réinitialise l'état de transcription", async () => {
    await notesRepo.enregistrerSuccesTranscription(A, chantier.id, "Ancienne transcription.");
    await notesRepo.enregistrerNoteVocale(A, chantier.id, {
      storageKey: "test/ia-note-v2.webm",
      mimeType: "audio/webm",
      tailleOctets: 200,
      checksum: "def",
    });
    const note = await notesRepo.getNoteVocale(A, chantier.id);
    assert.equal(note?.transcriptionStatut, "non_demandee");
    assert.equal(note?.transcription, null);
  });

  // --- Isolation ---

  await test("Isolation : B ne peut pas déclencher/lire l'état de transcription du chantier de A", async () => {
    const note = await notesRepo.getNoteVocale(B, chantier.id);
    assert.equal(note, null);
    const resultat = await notesRepo.marquerTranscriptionEnCours(B, chantier.id);
    assert.equal(resultat, undefined, "RLS doit filtrer silencieusement, aucun effet sur le chantier de A");
  });

  console.log(`\n${passed} test(s) réussi(s), ${failed} échoué(s).`);
  await pool.end();
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
