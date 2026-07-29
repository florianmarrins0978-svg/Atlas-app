import assert from "node:assert";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as lignesPrixRepo from "../src/server/repositories/lignes-prix";
import * as devisRepo from "../src/server/repositories/devis";
import * as photosRepo from "../src/server/repositories/photos";
import * as documentsRepo from "../src/server/repositories/documents";
import { ingererDevis, ingererTranscription, ingererPhotosMetadonnees } from "../src/server/documents/ingestion";
import { decouperTexte } from "../src/server/documents/chunking";
import { poserQuestion } from "../src/server/ai/services/assistant-service";
import { enregistrerNoteVocale } from "../src/server/repositories/notes-vocales";

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
      fragments_documents, documents,
      lignes_devis, devis, lignes_prix, photos, notes_vocales, fichiers_a_purger,
      materiel, prestations, chantiers, clients, tarifs, parametres_chiffrage,
      entreprise_compteurs, membres_entreprise, entreprises, users
    RESTART IDENTITY CASCADE
  `);

  const { entreprise: entA, utilisateurId: userA } = await entreprisesRepo.creerEntreprise(
    { nom: "Entreprise Documents A" },
    { email: "documents-a@test.local", nom: "A" }
  );
  const A = { entrepriseId: entA.id, utilisateurId: userA };
  const { entreprise: entB, utilisateurId: userB } = await entreprisesRepo.creerEntreprise(
    { nom: "Entreprise Documents B" },
    { email: "documents-b@test.local", nom: "B" }
  );
  const B = { entrepriseId: entB.id, utilisateurId: userB };

  // --- Découpage ---
  await test("Découpage : regroupe les phrases sans dépasser la taille maximale", async () => {
    const texte = "Première phrase courte. Deuxième phrase également courte. Troisième phrase un peu plus longue ici.";
    const fragments = decouperTexte(texte, 40);
    assert.ok(fragments.length > 1);
    assert.ok(fragments.every((f) => f.length <= 60)); // marge raisonnable, pas de coupure au milieu d'un mot
  });

  await test("Découpage : texte vide -> aucun fragment", async () => {
    assert.equal(decouperTexte("   ").length, 0);
  });

  // --- Ingestion : devis ---
  await test("Ingestion d'un devis : crée un document et des fragments avec la bonne provenance", async () => {
    const chantier = await chantiersRepo.creerChantier(A, { nom: "Chantier ingestion devis" });
    await lignesPrixRepo.ajouterLignePrix(A, chantier.id, "Pose de nacelle spécifique", "450.00");
    await devisRepo.getOuCreerDevisBrouillon(A, chantier.id);

    const document = await ingererDevis(A, chantier.id);
    assert.ok(document);
    assert.equal(document?.typeDocument, "devis");

    const resultats = await documentsRepo.rechercherFragments(A, "nacelle spécifique", chantier.id);
    assert.ok(resultats.length > 0);
    assert.equal(resultats[0].typeDocument, "devis");
    assert.equal(resultats[0].titre, document?.titre);
  });

  await test("Ingestion : aucun devis existant -> aucun document créé (jamais de contenu inventé)", async () => {
    const chantier = await chantiersRepo.creerChantier(A, { nom: "Chantier sans devis" });
    const document = await ingererDevis(A, chantier.id);
    assert.equal(document, null);
  });

  // --- Ingestion : transcription (intégration IA-01) ---
  await test("Intégration : une transcription réussie devient recherchable via ingererTranscription", async () => {
    const chantier = await chantiersRepo.creerChantier(A, { nom: "Chantier ingestion transcription" });
    await enregistrerNoteVocale(A, chantier.id, {
      storageKey: "test/ia-07-note.webm",
      mimeType: "audio/webm",
      tailleOctets: 10,
      checksum: "abc123",
    });
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`SELECT set_config('app.entreprise_id', $1, true)`, [A.entrepriseId]);
      await client.query(
        `UPDATE notes_vocales SET transcription = $1, transcription_statut = 'reussie' WHERE chantier_id = $2`,
        ["Le client souhaite un rappel pour la consigne de sécurité sur l'échafaudage.", chantier.id]
      );
      await client.query("COMMIT");
    } finally {
      client.release();
    }
    await ingererTranscription(A, chantier.id);
    const resultats = await documentsRepo.rechercherFragments(A, "échafaudage", chantier.id);
    assert.ok(resultats.length > 0);
    assert.equal(resultats[0].typeDocument, "transcription");
  });

  // --- Ingestion : photos (métadonnées uniquement, jamais d'analyse d'image) ---
  await test("Ingestion photos : utilise uniquement les métadonnées, jamais une analyse d'image", async () => {
    const chantier = await chantiersRepo.creerChantier(A, { nom: "Chantier ingestion photos" });
    await photosRepo.ajouterPhoto(A, chantier.id, {
      storageKey: "test/photo-ia07.jpg",
      mimeType: "image/jpeg",
      tailleOctets: 1000,
      nomOriginal: "facade-avant-travaux.jpg",
      checksum: "def456",
    });
    const document = await ingererPhotosMetadonnees(A, chantier.id);
    assert.ok(document);
    const resultats = await documentsRepo.rechercherFragments(A, "facade-avant-travaux", chantier.id);
    assert.ok(resultats.length > 0);
    assert.ok(!/analyse|détecte|contient une image de/i.test(resultats[0].contenu), "Aucune analyse visuelle ne doit être inventée");
  });

  // --- Recherche : absence de résultat ---
  await test("Recherche sans correspondance : liste vide, jamais une invention", async () => {
    const chantier = await chantiersRepo.creerChantier(A, { nom: "Chantier recherche vide" });
    const resultats = await documentsRepo.rechercherFragments(A, "mot totalement absent xyz123", chantier.id);
    assert.equal(resultats.length, 0);
  });

  // --- Multi-société / isolation ---
  await test("Isolation : B ne peut jamais retrouver un document de A", async () => {
    const chantierA = await chantiersRepo.creerChantier(A, { nom: "Chantier confidentiel A" });
    await lignesPrixRepo.ajouterLignePrix(A, chantierA.id, "Prestation confidentielle unique987", "100.00");
    await devisRepo.getOuCreerDevisBrouillon(A, chantierA.id);
    await ingererDevis(A, chantierA.id);

    const resultatsA = await documentsRepo.rechercherFragments(A, "confidentielle unique987");
    assert.ok(resultatsA.length > 0);

    const resultatsB = await documentsRepo.rechercherFragments(B, "confidentielle unique987");
    assert.equal(resultatsB.length, 0, "B ne doit jamais voir un document de A");
  });

  // --- Intégration avec l'assistant : citation systématique ---
  await test("Assistant : une réponse documentaire cite toujours le document et le passage", async () => {
    const chantier = await chantiersRepo.creerChantier(A, { nom: "Chantier assistant documents" });
    await lignesPrixRepo.ajouterLignePrix(A, chantier.id, "Réparation gouttière spécifique321", "260.00");
    await devisRepo.getOuCreerDevisBrouillon(A, chantier.id);
    await ingererDevis(A, chantier.id);

    const reponse = await poserQuestion(A, chantier.id, [], 'Recherche "gouttière spécifique321" dans les documents.');
    assert.equal(reponse.succes, true);
    if (reponse.succes) {
      assert.ok(reponse.sources.includes("RechercherDocuments"));
      assert.ok(reponse.texte.includes("gouttière spécifique321"));
      assert.ok(/D'après « .+ »/.test(reponse.texte), "La réponse doit citer explicitement le document source");
    }
  });

  await test("Assistant : absence d'information -> le dit explicitement, jamais d'invention", async () => {
    const chantier = await chantiersRepo.creerChantier(A, { nom: "Chantier assistant sans documents" });
    const reponse = await poserQuestion(A, chantier.id, [], 'Recherche "mot-cle-totalement-inexistant-999" dans les documents.');
    assert.equal(reponse.succes, true);
    if (reponse.succes) {
      assert.ok(reponse.texte.toLowerCase().includes("aucune information fiable"));
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
