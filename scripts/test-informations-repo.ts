import assert from "node:assert";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as prestationsRepo from "../src/server/repositories/prestations";
import * as materielRepo from "../src/server/repositories/materiel";
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
    { nom: "Entreprise Informations A" },
    { email: "info-a@test.local", nom: "A" }
  );
  const A = { entrepriseId: entA.id, utilisateurId: userA };
  const { entreprise: entB, utilisateurId: userB } = await entreprisesRepo.creerEntreprise(
    { nom: "Entreprise Informations B" },
    { email: "info-b@test.local", nom: "B" }
  );
  const B = { entrepriseId: entB.id, utilisateurId: userB };

  const chantier = await chantiersRepo.creerChantier(A, { nom: "Chantier informations" });

  await test("Prestations vides au départ", async () => {
    const liste = await prestationsRepo.listerPrestations(A, chantier.id);
    assert.equal(liste.length, 0);
  });

  await test("Ajout de prestations respecte l'ordre d'insertion", async () => {
    await prestationsRepo.ajouterPrestation(A, chantier.id, "Dépose carrelage");
    await prestationsRepo.ajouterPrestation(A, chantier.id, "Pose faïence");
    await prestationsRepo.ajouterPrestation(A, chantier.id, "Robinetterie");
    const liste = await prestationsRepo.listerPrestations(A, chantier.id);
    assert.deepEqual(
      liste.map((p) => p.libelle),
      ["Dépose carrelage", "Pose faïence", "Robinetterie"]
    );
    assert.deepEqual(liste.map((p) => p.ordre), [0, 1, 2]);
  });

  await test("Modification d'une prestation", async () => {
    const [p] = await prestationsRepo.listerPrestations(A, chantier.id);
    const maj = await prestationsRepo.modifierPrestation(A, p.id, "Dépose carrelage (terminé)");
    assert.equal(maj.libelle, "Dépose carrelage (terminé)");
  });

  await test("Suppression d'une prestation", async () => {
    const avant = await prestationsRepo.listerPrestations(A, chantier.id);
    await prestationsRepo.supprimerPrestation(A, avant[1].id);
    const apres = await prestationsRepo.listerPrestations(A, chantier.id);
    assert.equal(apres.length, 2);
  });

  await test("Réordonnancement des prestations", async () => {
    const liste = await prestationsRepo.listerPrestations(A, chantier.id);
    const idsInverses = [...liste].reverse().map((p) => p.id);
    await prestationsRepo.reordonnerPrestations(A, chantier.id, idsInverses);
    const relue = await prestationsRepo.listerPrestations(A, chantier.id);
    assert.deepEqual(
      relue.map((p) => p.id),
      idsInverses
    );
  });

  await test("Matériel : ajout, modification, suppression, ordre", async () => {
    await materielRepo.ajouterMateriel(A, chantier.id, "Colle flex");
    await materielRepo.ajouterMateriel(A, chantier.id, "Joint gris");
    let liste = await materielRepo.listerMateriel(A, chantier.id);
    assert.equal(liste.length, 2);
    await materielRepo.modifierMateriel(A, liste[0].id, "Colle flex blanche");
    await materielRepo.supprimerMateriel(A, liste[1].id);
    liste = await materielRepo.listerMateriel(A, chantier.id);
    assert.equal(liste.length, 1);
    assert.equal(liste[0].libelle, "Colle flex blanche");
  });

  await test("Réordonnancement du matériel", async () => {
    await materielRepo.ajouterMateriel(A, chantier.id, "Joint silicone");
    const liste = await materielRepo.listerMateriel(A, chantier.id);
    const idsInverses = [...liste].reverse().map((m) => m.id);
    await materielRepo.reordonnerMateriel(A, chantier.id, idsInverses);
    const relue = await materielRepo.listerMateriel(A, chantier.id);
    assert.deepEqual(
      relue.map((m) => m.id),
      idsInverses
    );
  });

  await test("Durée et équipe : mise à jour et lecture", async () => {
    await chantiersRepo.mettreAJourDureeEquipe(A, chantier.id, { dureePrevue: "3 jours", tailleEquipe: "2 hommes" });
    const relu = await chantiersRepo.getChantier(A, chantier.id);
    assert.equal(relu?.dureePrevue, "3 jours");
    assert.equal(relu?.tailleEquipe, "2 hommes");
  });

  await test("Mise à jour partielle (durée seule) ne touche pas l'équipe", async () => {
    await chantiersRepo.mettreAJourDureeEquipe(A, chantier.id, { dureePrevue: "4 jours" });
    const relu = await chantiersRepo.getChantier(A, chantier.id);
    assert.equal(relu?.dureePrevue, "4 jours");
    assert.equal(relu?.tailleEquipe, "2 hommes");
  });

  await test("Isolation : B ne peut pas lister/modifier les prestations du chantier de A", async () => {
    const liste = await prestationsRepo.listerPrestations(B, chantier.id);
    assert.equal(liste.length, 0);
  });

  await test("Isolation : B ne peut pas lire la durée/équipe du chantier de A", async () => {
    const relu = await chantiersRepo.getChantier(B, chantier.id);
    assert.equal(relu, null);
  });

  console.log(`\n${passed} test(s) réussi(s), ${failed} échoué(s).`);
  await pool.end();
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
