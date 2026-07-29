import assert from "node:assert";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as tarifsRepo from "../src/server/repositories/tarifs";
import { creerTarifAction, modifierTarifAction, supprimerTarifAction } from "../src/app/reglages/actions";

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

  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise(
    { nom: "Entreprise Tarifs Action" },
    { email: "tarifs-action@test.local", nom: "Test" }
  );
  const ctx = { entrepriseId: entreprise.id, utilisateurId };
  process.env.AUTH_TEST_UTILISATEUR_ID = utilisateurId;

  let tarifId: string;
  await test("creerTarifAction persiste un nouveau tarif", async () => {
    const t = await creerTarifAction("Déplacement", "35.00");
    tarifId = t.id;
    assert.equal(t.intitule, "Déplacement");
    assert.equal(t.prix, "35.00");
  });

  await test("modifierTarifAction met à jour le tarif", async () => {
    await modifierTarifAction(tarifId, { prix: "40.00" });
    const liste = await tarifsRepo.listerTarifs(ctx);
    assert.equal(liste.find((t) => t.id === tarifId)?.prix, "40.00");
  });

  await test("supprimerTarifAction retire le tarif (suppression douce)", async () => {
    await supprimerTarifAction(tarifId);
    const liste = await tarifsRepo.listerTarifs(ctx);
    assert.ok(!liste.some((t) => t.id === tarifId));
  });

  console.log(`\n${passed} test(s) réussi(s), ${failed} échoué(s).`);
  await pool.end();
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
