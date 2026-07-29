import assert from "node:assert";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import { getStatutAffiche, statutLabel } from "../src/lib/chantier-etat";

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
    { nom: "Entreprise Dashboard A" },
    { email: "dashboard-a@test.local", nom: "A" }
  );
  const A = { entrepriseId: entA.id, utilisateurId: userA };
  const { entreprise: entB, utilisateurId: userB } = await entreprisesRepo.creerEntreprise(
    { nom: "Entreprise Dashboard B" },
    { email: "dashboard-b@test.local", nom: "B" }
  );
  const B = { entrepriseId: entB.id, utilisateurId: userB };

  await test("Indicateur 'nombre de chantiers' : 0 pour une entreprise sans chantier", async () => {
    const liste = await chantiersRepo.listerChantiersPourAffichage(A);
    assert.equal(liste.length, 0);
  });

  await chantiersRepo.creerChantier(A, { nom: "Chantier 1" });
  await chantiersRepo.creerChantier(A, { nom: "Chantier 2" });
  await chantiersRepo.creerChantier(A, { nom: "Chantier 3" });
  await chantiersRepo.creerChantier(B, { nom: "Chantier de B (ne doit jamais compter pour A)" });

  await test("Indicateur 'nombre de chantiers' : reflète exactement les chantiers réels de l'entreprise", async () => {
    const liste = await chantiersRepo.listerChantiersPourAffichage(A);
    assert.equal(liste.length, 3);
  });

  await test("Isolation : le compteur de A n'inclut jamais les chantiers de B", async () => {
    const liste = await chantiersRepo.listerChantiersPourAffichage(A);
    assert.ok(liste.every((c) => c.nom !== "Chantier de B (ne doit jamais compter pour A)"));
    const listeB = await chantiersRepo.listerChantiersPourAffichage(B);
    assert.equal(listeB.length, 1);
  });

  await test("Persistance : le compteur reflète une insertion ultérieure sans redémarrage", async () => {
    await chantiersRepo.creerChantier(A, { nom: "Chantier 4" });
    const liste = await chantiersRepo.listerChantiersPourAffichage(A);
    assert.equal(liste.length, 4);
  });

  await test("Validation : chaque statut affiché correspond à un libellé réel (aucune donnée mockée)", async () => {
    const liste = await chantiersRepo.listerChantiersPourAffichage(A);
    for (const c of liste) {
      const statut = getStatutAffiche(c);
      assert.ok(statutLabel[statut], `Le statut '${statut}' doit avoir un libellé`);
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
