import assert from "node:assert";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import { planifierChantierAction, deplanifierChantierAction } from "../src/app/planning/actions";

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
    { nom: "Entreprise Planning Action" },
    { email: "planning-action@test.local", nom: "Test" }
  );
  const ctx = { entrepriseId: entreprise.id, utilisateurId };
  process.env.AUTH_TEST_UTILISATEUR_ID = utilisateurId;
  const chantier = await chantiersRepo.creerChantier(ctx, { nom: "Chantier action planning" });

  await test("planifierChantierAction persiste la date", async () => {
    await planifierChantierAction(chantier.id, "2026-11-05");
    const relu = await chantiersRepo.getChantier(ctx, chantier.id);
    assert.equal(relu?.datePlanifiee, "2026-11-05");
  });

  await test("deplanifierChantierAction retire la date", async () => {
    await deplanifierChantierAction(chantier.id);
    const relu = await chantiersRepo.getChantier(ctx, chantier.id);
    assert.equal(relu?.datePlanifiee, null);
  });

  console.log(`\n${passed} test(s) réussi(s), ${failed} échoué(s).`);
  await pool.end();
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
