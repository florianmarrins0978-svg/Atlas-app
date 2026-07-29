import assert from "node:assert";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as photosRepo from "../src/server/repositories/photos";
import { enregistrerObjet, lireObjet, supprimerObjet } from "../src/server/storage/local-storage";
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
    { nom: "Entreprise Photos A" },
    { email: "photos-a@test.local", nom: "A" }
  );
  const A = { entrepriseId: entA.id, utilisateurId: userA };
  const { entreprise: entB, utilisateurId: userB } = await entreprisesRepo.creerEntreprise(
    { nom: "Entreprise Photos B" },
    { email: "photos-b@test.local", nom: "B" }
  );
  const B = { entrepriseId: entB.id, utilisateurId: userB };

  const chantier = await chantiersRepo.creerChantier(A, { nom: "Chantier photos réelles" });

  await test("Stockage local : enregistrer puis lire un objet retourne les mêmes octets", async () => {
    const contenu = Buffer.from("contenu-image-test");
    const objet = await enregistrerObjet("test/photos", contenu, ".jpg");
    const relu = await lireObjet(objet.storageKey);
    assert.ok(relu.equals(contenu));
    assert.equal(objet.tailleOctets, contenu.length);
    await supprimerObjet(objet.storageKey);
  });

  await test("Stockage local : supprimer une clé déjà absente ne lève pas d'erreur (idempotent)", async () => {
    await supprimerObjet("test/photos/inexistant.jpg");
    await supprimerObjet("test/photos/inexistant.jpg");
  });

  let photoId: string;
  await test("ajouterPhoto persiste les métadonnées réelles", async () => {
    const objet = await enregistrerObjet(`chantiers/${chantier.id}/photos`, Buffer.from("abc"), ".jpg");
    const photo = await photosRepo.ajouterPhoto(A, chantier.id, {
      storageKey: objet.storageKey,
      mimeType: "image/jpeg",
      tailleOctets: objet.tailleOctets,
      checksum: objet.checksum,
    });
    photoId = photo.id;
    const liste = await photosRepo.listerPhotos(A, chantier.id);
    assert.equal(liste.length, 1);
    assert.equal(liste[0].storageKey, objet.storageKey);
  });

  await test("Isolation : B ne peut pas lister les photos du chantier de A", async () => {
    const liste = await photosRepo.listerPhotos(B, chantier.id);
    assert.equal(liste.length, 0);
  });

  await test("supprimerPhoto : disparaît de la liste, mise en file de purge, puis purge réelle du fichier", async () => {
    const [photo] = await photosRepo.listerPhotos(A, chantier.id);
    await photosRepo.supprimerPhoto(A, photo.id);
    const liste = await photosRepo.listerPhotos(A, chantier.id);
    assert.equal(liste.length, 0);

    // Force le fichier en file de purge à être considéré comme ancien, puis purge.
    await pool.query(`UPDATE fichiers_a_purger SET mis_en_file_le = now() - interval '48 hours' WHERE storage_key = $1`, [
      photo.storageKey,
    ]);
    const nb = await purgerFichiersEnAttente(24);
    assert.ok(nb >= 1);
    await assert.rejects(() => lireObjet(photo.storageKey), "Le fichier doit être réellement supprimé après purge");
  });

  console.log(`\n${passed} test(s) réussi(s), ${failed} échoué(s).`);
  await pool.end();
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
