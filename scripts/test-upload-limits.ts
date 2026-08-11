import assert from "node:assert";
import { verifierTailleFichier, LIMITE_TELEVERSEMENT_OCTETS, MESSAGE_FICHIER_TROP_VOLUMINEUX } from "../src/server/upload-limits";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import { ajouterPhotoAction } from "../src/app/chantiers/[id]/photos-actions";
import { enregistrerNoteVocaleAction } from "../src/app/chantiers/[id]/note-vocale/actions";
import * as photosRepo from "../src/server/repositories/photos";
import { fermerLimiteur } from "../src/server/rate-limit";

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

function fichierDeTaille(octets: number, type: string, nom: string): File {
  return new File([new Uint8Array(octets)], nom, { type });
}

async function main() {
  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise(
    { nom: "Entreprise Upload Limits" },
    { email: `upload-limits-${Date.now()}@test.local`, nom: "U" }
  );
  process.env.AUTH_TEST_UTILISATEUR_ID = utilisateurId;
  const chantier = await chantiersRepo.creerChantier({ entrepriseId: entreprise.id, utilisateurId }, { nom: "Chantier upload limits" });

  await test("Fonction pure : un fichier sous la limite est accepté", async () => {
    const fichier = fichierDeTaille(1024, "image/jpeg", "photo.jpg");
    const resultat = verifierTailleFichier(fichier);
    assert.equal(resultat.ok, true);
  });

  await test("Fonction pure : un fichier au-dessus de la limite est rejeté avec un message clair", async () => {
    const fichier = fichierDeTaille(LIMITE_TELEVERSEMENT_OCTETS + 1, "image/jpeg", "photo.jpg");
    const resultat = verifierTailleFichier(fichier);
    assert.equal(resultat.ok, false);
    if (!resultat.ok) {
      assert.equal(resultat.message, MESSAGE_FICHIER_TROP_VOLUMINEUX);
      assert.ok(!/stack|Error:|at /.test(resultat.message), "Aucun détail technique ne doit être présent dans le message");
    }
  });

  await test("Fonction pure : un fichier exactement à la limite est accepté (limite inclusive)", async () => {
    const fichier = fichierDeTaille(LIMITE_TELEVERSEMENT_OCTETS, "image/jpeg", "photo.jpg");
    const resultat = verifierTailleFichier(fichier);
    assert.equal(resultat.ok, true);
  });

  await test("Régression : une photo normale (sous la limite) est toujours acceptée par l'action réelle", async () => {
    const formData = new FormData();
    formData.set("fichier", fichierDeTaille(500 * 1024, "image/jpeg", "photo-normale.jpg"));
    const photo = await ajouterPhotoAction(chantier.id, formData);
    assert.ok(photo);
    const liste = await photosRepo.listerPhotos({ entrepriseId: entreprise.id, utilisateurId }, chantier.id);
    assert.ok(liste.some((p) => p.id === photo.id));
  });

  await test("Upload photo : un fichier surdimensionné est rejeté par l'action réelle, message utilisateur propre", async () => {
    const formData = new FormData();
    formData.set("fichier", fichierDeTaille(LIMITE_TELEVERSEMENT_OCTETS + 1024, "image/jpeg", "photo-trop-grosse.jpg"));
    let leve = false;
    let message = "";
    try {
      await ajouterPhotoAction(chantier.id, formData);
    } catch (err) {
      leve = true;
      message = err instanceof Error ? err.message : String(err);
    }
    assert.ok(leve, "Un fichier surdimensionné doit être rejeté");
    assert.equal(message, MESSAGE_FICHIER_TROP_VOLUMINEUX);
  });

  await test("Régression : un enregistrement vocal normal (sous la limite) est toujours accepté", async () => {
    const formData = new FormData();
    formData.set("fichier", fichierDeTaille(200 * 1024, "audio/webm", "note.webm"));
    formData.set("dureeSecondes", "12");
    const note = await enregistrerNoteVocaleAction(chantier.id, formData);
    assert.ok(note);
  });

  await test("Upload note vocale : un fichier surdimensionné est rejeté avec un message clair", async () => {
    const formData = new FormData();
    formData.set("fichier", fichierDeTaille(LIMITE_TELEVERSEMENT_OCTETS + 1024, "audio/webm", "note-trop-grosse.webm"));
    let leve = false;
    let message = "";
    try {
      await enregistrerNoteVocaleAction(chantier.id, formData);
    } catch (err) {
      leve = true;
      message = err instanceof Error ? err.message : String(err);
    }
    assert.ok(leve);
    assert.equal(message, MESSAGE_FICHIER_TROP_VOLUMINEUX);
  });

  console.log(`\n${passed} test(s) réussi(s), ${failed} échoué(s).`);
  // Le limiteur de débit ouvre une connexion Redis dès qu'une action protégée
  // est traversée. Sans cette fermeture, le processus ne rend jamais la main —
  // tests tous verts, batterie arrêtée pour toujours (8 août 2026).
  await pool.end();
  await fermerLimiteur();
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
