import assert from "node:assert";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as tarifsRepo from "../src/server/repositories/tarifs";

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
    { nom: "Entreprise Tarifs A" },
    { email: "tarifs-a@test.local", nom: "A" }
  );
  const A = { entrepriseId: entA.id, utilisateurId: userA };
  const { entreprise: entB, utilisateurId: userB } = await entreprisesRepo.creerEntreprise(
    { nom: "Entreprise Tarifs B" },
    { email: "tarifs-b@test.local", nom: "B" }
  );
  const B = { entrepriseId: entB.id, utilisateurId: userB };

  await test("Lecture : aucun tarif au départ", async () => {
    const liste = await tarifsRepo.listerTarifs(A);
    assert.equal(liste.length, 0);
  });

  let tarifId: string;
  await test("Création d'un tarif", async () => {
    const t = await tarifsRepo.creerTarif(A, { intitule: "Main d'œuvre", prix: "280.00" });
    tarifId = t.id;
    assert.equal(t.intitule, "Main d'œuvre");
    assert.equal(t.prix, "280.00");
  });

  await test("Modification d'un tarif : intitulé et prix", async () => {
    const maj = await tarifsRepo.modifierTarif(A, tarifId, { intitule: "Main d'œuvre (jour)", prix: "300.00" });
    assert.equal(maj.intitule, "Main d'œuvre (jour)");
    assert.equal(maj.prix, "300.00");
  });

  await test("Persistance après relecture", async () => {
    const liste = await tarifsRepo.listerTarifs(A);
    const t = liste.find((x) => x.id === tarifId)!;
    assert.equal(t.intitule, "Main d'œuvre (jour)");
    assert.equal(t.prix, "300.00");
  });

  await test("Validation : un prix négatif est rejeté (CHECK déjà en place)", async () => {
    await assert.rejects(() => tarifsRepo.creerTarif(A, { intitule: "Invalide", prix: "-10.00" }));
  });

  await test("Validation : un prix négatif en modification est aussi rejeté", async () => {
    await assert.rejects(() => tarifsRepo.modifierTarif(A, tarifId, { prix: "-5.00" }));
    // Le tarif ne doit pas avoir été altéré par la tentative.
    const liste = await tarifsRepo.listerTarifs(A);
    assert.equal(liste.find((x) => x.id === tarifId)?.prix, "300.00");
  });

  await test("Suppression douce : disparaît de la liste", async () => {
    const t2 = await tarifsRepo.creerTarif(A, { intitule: "Temporaire", prix: "10.00" });
    await tarifsRepo.supprimerTarif(A, t2.id);
    const liste = await tarifsRepo.listerTarifs(A);
    assert.ok(!liste.some((x) => x.id === t2.id));
  });

  await test("Isolation : B ne voit pas les tarifs de A", async () => {
    const liste = await tarifsRepo.listerTarifs(B);
    assert.equal(liste.length, 0);
  });

  await test("Isolation : B ne peut pas modifier un tarif de A", async () => {
    const resultat = await tarifsRepo.modifierTarif(B, tarifId, { prix: "1.00" });
    assert.equal(resultat, undefined, "RLS doit filtrer silencieusement, pas d'exception");
    const liste = await tarifsRepo.listerTarifs(A);
    assert.equal(liste.find((x) => x.id === tarifId)?.prix, "300.00", "Le tarif de A ne doit pas être affecté");
  });

  console.log(`\n${passed} test(s) réussi(s), ${failed} échoué(s).`);
  await pool.end();
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
