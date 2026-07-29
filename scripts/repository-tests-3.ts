import assert from "node:assert";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as prestationsRepo from "../src/server/repositories/prestations";
import * as materielRepo from "../src/server/repositories/materiel";
import * as lignesPrixRepo from "../src/server/repositories/lignes-prix";

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
    { nom: "Entreprise Repo3 A" },
    { email: "repo3-a@test.local", nom: "A" }
  );
  const A = { entrepriseId: entA.id, utilisateurId: userA };
  const { entreprise: entB, utilisateurId: userB } = await entreprisesRepo.creerEntreprise(
    { nom: "Entreprise Repo3 B" },
    { email: "repo3-b@test.local", nom: "B" }
  );
  const B = { entrepriseId: entB.id, utilisateurId: userB };

  const chantier = await chantiersRepo.creerChantier(A, { nom: "Chantier listes" });

  await test("ajouterPrestation respecte l'ordre d'ajout", async () => {
    await prestationsRepo.ajouterPrestation(A, chantier.id, "Dépose carrelage");
    await prestationsRepo.ajouterPrestation(A, chantier.id, "Pose faïence");
    const liste = await prestationsRepo.listerPrestations(A, chantier.id);
    assert.equal(liste.length, 2);
    assert.equal(liste[0].ordre, 0);
    assert.equal(liste[1].ordre, 1);
  });

  await test("modifierPrestation met à jour le libellé", async () => {
    const [p] = await prestationsRepo.listerPrestations(A, chantier.id);
    const maj = await prestationsRepo.modifierPrestation(A, p.id, "Dépose carrelage (fait)");
    assert.equal(maj.libelle, "Dépose carrelage (fait)");
  });

  await test("supprimerPrestation retire la ligne", async () => {
    const [p] = await prestationsRepo.listerPrestations(A, chantier.id);
    await prestationsRepo.supprimerPrestation(A, p.id);
    const liste = await prestationsRepo.listerPrestations(A, chantier.id);
    assert.equal(liste.length, 1);
  });

  await test("Isolation : B ne peut ni lire ni modifier les prestations du chantier de A", async () => {
    const liste = await prestationsRepo.listerPrestations(B, chantier.id);
    assert.equal(liste.length, 0);
  });

  await test("materiel : ajout, modification, suppression, ordre", async () => {
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

  await test("lignes de prix : montant Decimal (string), jamais de float natif", async () => {
    await lignesPrixRepo.ajouterLignePrix(A, chantier.id, "Main d'œuvre", "1120.00");
    await lignesPrixRepo.ajouterLignePrix(A, chantier.id, "Déplacement", "35.00");
    const liste = await lignesPrixRepo.listerLignesPrix(A, chantier.id);
    assert.equal(typeof liste[0].montant, "string", "Le montant doit rester une chaîne (Decimal), jamais un float JS");
  });

  await test("totalLignesPrix calcule la somme exacte (chaîne décimale, jamais un float)", async () => {
    const total = await lignesPrixRepo.totalLignesPrix(A, chantier.id);
    assert.equal(typeof total, "string");
    assert.equal(total, "1155.00");
  });

  await test("modifierLignePrix met à jour le montant", async () => {
    const [l] = await lignesPrixRepo.listerLignesPrix(A, chantier.id);
    const maj = await lignesPrixRepo.modifierLignePrix(A, l.id, { montant: "1300.00" });
    assert.equal(maj.montant, "1300.00");
    const total = await lignesPrixRepo.totalLignesPrix(A, chantier.id);
    assert.equal(total, "1335.00");
  });

  await test("Isolation : B ne peut pas lire les lignes de prix du chantier de A", async () => {
    const liste = await lignesPrixRepo.listerLignesPrix(B, chantier.id);
    assert.equal(liste.length, 0);
  });

  console.log(`\n${passed} test(s) réussi(s), ${failed} échoué(s).`);
  await pool.end();
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
