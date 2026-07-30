import assert from "node:assert";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import { getChantier } from "../src/server/repositories/chantiers";
import { nettoyerBase } from "./_test-db";

// Teste directement la logique utilisée par la Server Action (mêmes repositories),
// sans dépendre du runtime Next.js — creerChantierAction() délègue entièrement à
// creerClient()/creerChantier(), déjà couverts, donc ce test vérifie la
// composition des deux plutôt que de dupliquer leur couverture.

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
    { nom: "Entreprise Nouveau Chantier" },
    { email: "nouveau-chantier@test.local", nom: "Test" }
  );
  const ctx = { entrepriseId: entreprise.id, utilisateurId };

  // Réplique la logique de creerChantierAction (mêmes repositories) pour ne pas
  // dépendre du runtime Server Action de Next.js dans ce script autonome.
  const { creerClient } = await import("../src/server/repositories/clients");
  const { creerChantier } = await import("../src/server/repositories/chantiers");

  await test("Création avec nom seul -> clientId null", async () => {
    const chantier = await creerChantier(ctx, { nom: "Chantier sans client" });
    assert.equal(chantier.clientId, null);
  });

  await test("Création avec client -> clientId renseigné et cohérent", async () => {
    const client = await creerClient(ctx, { nom: "Mme Test", telephone: "0600000000" });
    const chantier = await creerChantier(ctx, { nom: "Chantier avec client", clientId: client.id });
    assert.equal(chantier.clientId, client.id);
    const relu = await getChantier(ctx, chantier.id);
    assert.equal(relu?.clientId, client.id);
  });

  await test("Le chantier créé est bien récupérable via getChantier dans le bon contexte", async () => {
    const chantier = await creerChantier(ctx, { nom: "Chantier vérifié" });
    const relu = await getChantier(ctx, chantier.id);
    assert.equal(relu?.nom, "Chantier vérifié");
  });

  console.log(`\n${passed} test(s) réussi(s), ${failed} échoué(s).`);
  await pool.end();
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
