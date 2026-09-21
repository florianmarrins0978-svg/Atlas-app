import assert from "node:assert";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as photosRepo from "../src/server/repositories/photos";
import { enregistrerObjet, lireObjet, supprimerObjet } from "../src/server/storage/local-storage";
import { purgerFichiersEnAttente } from "../src/server/repositories/fichiers";
import { nettoyerBase } from "./_test-db";
import { PHOTOS_MAX_PAR_CHANTIER } from "../src/lib/photos-plafonds";

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

  await test("ajouterPhoto persiste les métadonnées réelles", async () => {
    const objet = await enregistrerObjet(`chantiers/${chantier.id}/photos`, Buffer.from("abc"), ".jpg");
    const ajout = await photosRepo.ajouterPhoto(A, chantier.id, {
      storageKey: objet.storageKey,
      mimeType: "image/jpeg",
      tailleOctets: objet.tailleOctets,
      checksum: objet.checksum,
    });
    assert.ok(ajout.ok, "la photo a été refusée");
    assert.ok(ajout.photo.id);
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

  // ═══ LE PLAFOND DU CHANTIER — sa décision du 20 septembre 2026 ═══════════
  //
  // **Tenu par le DÉPÔT, pas par l'écran** : une sélection de la photothèque se
  // recommence, et deux écrans ajoutent au même chantier. Et la photo refusée
  // ne laisse pas d'octets orphelins : ses octets sont déjà rangés quand le
  // dépôt refuse, ils partent donc en purge comme une photo effacée.
  await test(`la ${PHOTOS_MAX_PAR_CHANTIER + 1}e photo d'un chantier est refusée, ses octets partent en purge`, async () => {
    const plein = await chantiersRepo.creerChantier(A, { nom: "Chantier plein" });
    for (let i = 0; i < PHOTOS_MAX_PAR_CHANTIER; i++) {
      const objet = await enregistrerObjet(`chantiers/${plein.id}/photos`, Buffer.from(`photo ${i}`), ".jpg");
      const ajout = await photosRepo.ajouterPhoto(A, plein.id, {
        storageKey: objet.storageKey,
        mimeType: "image/jpeg",
        tailleOctets: objet.tailleOctets,
        checksum: objet.checksum,
      });
      assert.ok(ajout.ok, `la photo n° ${i + 1} a été refusée sous le plafond`);
    }
    const objet = await enregistrerObjet(`chantiers/${plein.id}/photos`, Buffer.from("une de trop"), ".jpg");
    const refus = await photosRepo.ajouterPhoto(A, plein.id, {
      storageKey: objet.storageKey,
      mimeType: "image/jpeg",
      tailleOctets: objet.tailleOctets,
      checksum: objet.checksum,
    });
    assert.equal(refus.ok, false, "la photo de trop est entrée");
    assert.match(refus.ok ? "" : refus.raison, /30 photos au plus par chantier/);
    assert.equal((await photosRepo.listerPhotos(A, plein.id)).length, PHOTOS_MAX_PAR_CHANTIER);
    const enPurge = await pool.query(`SELECT 1 FROM fichiers_a_purger WHERE storage_key = $1`, [objet.storageKey]);
    assert.equal(enPurge.rowCount, 1, "les octets de la photo refusée ne sont pas en file de purge");
  });

  console.log(`\n${passed} test(s) réussi(s), ${failed} échoué(s).`);
  await pool.end();
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
