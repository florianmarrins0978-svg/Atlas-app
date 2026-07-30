import assert from "node:assert";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as notesRepo from "../src/server/repositories/notes-vocales";
import * as prestationsRepo from "../src/server/repositories/prestations";
import * as materielRepo from "../src/server/repositories/materiel";
import { enregistrerObjet } from "../src/server/storage/local-storage";
import { lancerTranscriptionAction } from "../src/app/chantiers/[id]/note-vocale/actions";
import { extraireInformationsAction, appliquerExtractionAction } from "../src/app/chantiers/[id]/informations/actions";
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

  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise(
    { nom: "Entreprise IA Actions" },
    { email: "ia-actions@test.local", nom: "Test" }
  );
  const ctx = { entrepriseId: entreprise.id, utilisateurId };
  process.env.AUTH_TEST_UTILISATEUR_ID = utilisateurId;

  await test("lancerTranscriptionAction refuse un chantier sans note vocale", async () => {
    const chantier = await chantiersRepo.creerChantier(ctx, { nom: "Chantier sans note" });
    await assert.rejects(() => lancerTranscriptionAction(chantier.id));
  });

  await test("lancerTranscriptionAction (fournisseur dev) : passe par en_cours puis reussie", async () => {
    const chantier = await chantiersRepo.creerChantier(ctx, { nom: "Chantier avec note" });
    const objet = await enregistrerObjet(`chantiers/${chantier.id}/notes`, Buffer.from("audio réel de test"), ".webm");
    await notesRepo.enregistrerNoteVocale(ctx, chantier.id, {
      storageKey: objet.storageKey,
      mimeType: "audio/webm",
      tailleOctets: objet.tailleOctets,
      checksum: objet.checksum,
    });
    const resultat = await lancerTranscriptionAction(chantier.id);
    assert.equal(resultat.transcriptionStatut, "reussie");
    assert.ok(resultat.transcription);
  });

  await test("lancerTranscriptionAction : fichier audio introuvable -> echouee proprement, jamais de texte inventé", async () => {
    const chantier = await chantiersRepo.creerChantier(ctx, { nom: "Chantier fichier manquant" });
    await notesRepo.enregistrerNoteVocale(ctx, chantier.id, {
      storageKey: "chantiers/inexistant/notes/absent.webm",
      mimeType: "audio/webm",
      tailleOctets: 10,
      checksum: "abc",
    });
    const resultat = await lancerTranscriptionAction(chantier.id);
    assert.equal(resultat.transcriptionStatut, "echouee");
    assert.equal(resultat.transcriptionErreur, "Fichier audio introuvable.");
    assert.equal(resultat.transcription, null);
  });

  await test("extraireInformationsAction : texte libre sans note vocale associée, aucune mutation", async () => {
    const chantier = await chantiersRepo.creerChantier(ctx, { nom: "Chantier texte libre" });
    const avantPrestations = await prestationsRepo.listerPrestations(ctx, chantier.id);
    const resultat = await extraireInformationsAction("Deux jours, trois hommes, dix plaques de BA13, poser la cloison");
    assert.equal(resultat.succes, true);
    const apresPrestations = await prestationsRepo.listerPrestations(ctx, chantier.id);
    assert.equal(apresPrestations.length, avantPrestations.length, "Aucune mutation avant confirmation explicite");
  });

  await test("appliquerExtractionAction : applique uniquement après confirmation, via les repositories existants", async () => {
    const chantier = await chantiersRepo.creerChantier(ctx, { nom: "Chantier confirmation" });
    const resultat = await extraireInformationsAction("Deux jours, trois hommes, dix plaques de BA13, poser la cloison");
    assert.equal(resultat.succes, true);
    if (!resultat.succes) return;

    const { prestationsCreees, materielCree } = await appliquerExtractionAction(chantier.id, {
      prestations: resultat.proposition.prestations.map((p) => p.libelle),
      materiel: resultat.proposition.materiel.map((m) => m.libelle),
      dureePrevue: resultat.proposition.dureePrevue ?? undefined,
      tailleEquipe: resultat.proposition.tailleEquipe ?? undefined,
    });

    assert.equal(prestationsCreees.length, resultat.proposition.prestations.length);
    assert.equal(materielCree.length, resultat.proposition.materiel.length);

    const prestations = await prestationsRepo.listerPrestations(ctx, chantier.id);
    const materiel = await materielRepo.listerMateriel(ctx, chantier.id);
    assert.equal(prestations.length, resultat.proposition.prestations.length);
    assert.equal(materiel.length, resultat.proposition.materiel.length);

    const chantierMaj = await chantiersRepo.getChantier(ctx, chantier.id);
    assert.ok(chantierMaj?.dureePrevue);
    assert.ok(chantierMaj?.tailleEquipe);
  });

  await test("appliquerExtractionAction : ne retient que les éléments confirmés (sous-ensemble filtré côté appelant)", async () => {
    const chantier = await chantiersRepo.creerChantier(ctx, { nom: "Chantier partiel" });
    const { prestationsCreees } = await appliquerExtractionAction(chantier.id, {
      prestations: ["Prestation retenue"],
      materiel: [],
    });
    assert.equal(prestationsCreees.length, 1);
    const materiel = await materielRepo.listerMateriel(ctx, chantier.id);
    assert.equal(materiel.length, 0, "Le matériel non transmis ne doit jamais être ajouté");
  });

  console.log(`\n${passed} test(s) réussi(s), ${failed} échoué(s).`);
  await pool.end();
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
