import assert from "node:assert";
import { pool } from "../src/server/db/client";
import { AccesRefuseError } from "../src/server/db/with-entreprise";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as clientsRepo from "../src/server/repositories/clients";
import * as tarifsRepo from "../src/server/repositories/tarifs";
import * as devisRepo from "../src/server/repositories/devis";

// Lancer : DATABASE_URL=postgresql://atlas_owner:...@127.0.0.1:5432/atlas_test npx tsx scripts/repository-tests.ts

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

async function creerEntrepriseComplete(nom: string) {
  const { rows: e } = await pool.query(`INSERT INTO entreprises (nom) VALUES ($1) RETURNING id`, [nom]);
  const entrepriseId = e[0].id as string;
  const { rows: u } = await pool.query(`INSERT INTO users (email, nom) VALUES ($1,$2) RETURNING id`, [
    `${nom.toLowerCase().replace(/\s/g, "-")}@test.local`,
    nom,
  ]);
  const utilisateurId = u[0].id as string;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SELECT set_config('app.entreprise_id', $1, true)`, [entrepriseId]);
    await client.query(
      `INSERT INTO membres_entreprise (entreprise_id, utilisateur_id, role) VALUES ($1,$2,'proprietaire')`,
      [entrepriseId, utilisateurId]
    );
    await client.query(`INSERT INTO entreprise_compteurs (entreprise_id) VALUES ($1)`, [entrepriseId]);
    await client.query("COMMIT");
  } finally {
    client.release();
  }
  return { entrepriseId, utilisateurId };
}

async function main() {
  await pool.query(`
    TRUNCATE TABLE
      lignes_devis, devis, lignes_prix, photos, notes_vocales,
      materiel, prestations, chantiers, clients, tarifs,
      entreprise_compteurs, membres_entreprise, entreprises, users
    RESTART IDENTITY CASCADE
  `);

  const A = await creerEntrepriseComplete("Repo A");
  const B = await creerEntrepriseComplete("Repo B");

  await test("creerClient + listerClients", async () => {
    await clientsRepo.creerClient({ ...A }, { nom: "Client Test", telephone: "0600000000" });
    const liste = await clientsRepo.listerClients(A);
    assert.equal(liste.length, 1);
  });

  await test("creerChantier + getChantier", async () => {
    const c = await chantiersRepo.creerChantier(A, { nom: "Chantier repo" });
    const relu = await chantiersRepo.getChantier(A, c.id);
    assert.equal(relu?.nom, "Chantier repo");
  });

  await test("Isolation : B ne peut pas lire un chantier de A via le repository", async () => {
    const c = await chantiersRepo.creerChantier(A, { nom: "Chantier privé A" });
    const relu = await chantiersRepo.getChantier(B, c.id);
    assert.equal(relu, null, "Un chantier de A a été lu sous le contexte B");
  });

  await test("marquerInformationsVerifiees et marquerPrixValide renseignent les jalons", async () => {
    const c = await chantiersRepo.creerChantier(A, { nom: "Chantier jalons" });
    const c2 = await chantiersRepo.marquerInformationsVerifiees(A, c.id);
    assert.ok(c2.informationsVerifieesAt !== null);
    const c3 = await chantiersRepo.marquerPrixValide(A, c.id);
    assert.ok(c3.prixValideAt !== null);
  });

  await test("planifierChantier renseigne date_planifiee", async () => {
    const c = await chantiersRepo.creerChantier(A, { nom: "Chantier à planifier" });
    const c2 = await chantiersRepo.planifierChantier(A, c.id, "2026-09-01");
    assert.equal(c2.datePlanifiee, "2026-09-01");
  });

  await test("creerTarif + supprimerTarif (soft delete)", async () => {
    const t = await tarifsRepo.creerTarif(A, { intitule: "Test", prix: "42.00" });
    let liste = await tarifsRepo.listerTarifs(A);
    assert.ok(liste.some((x) => x.id === t.id));
    await tarifsRepo.supprimerTarif(A, t.id);
    liste = await tarifsRepo.listerTarifs(A);
    assert.ok(!liste.some((x) => x.id === t.id), "Le tarif supprimé apparaît encore");
  });

  await test("Flux devis complet : brouillon -> envoyé, chantier.devisEnvoyeAt renseigné", async () => {
    const c = await chantiersRepo.creerChantier(A, { nom: "Chantier devis repo" });
    const d = await devisRepo.getOuCreerDevisBrouillon(A, c.id);
    assert.equal(d.statut, "brouillon");
    const envoye = await devisRepo.envoyerDevis(A, d.id);
    assert.equal(envoye.statut, "envoye");
    const chantierMaj = await chantiersRepo.getChantier(A, c.id);
    assert.ok(chantierMaj?.devisEnvoyeAt !== null);
  });

  await test("Repository refuse un utilisateur non membre de l'entreprise ciblée", async () => {
    try {
      await chantiersRepo.listerChantiers({ utilisateurId: A.utilisateurId, entrepriseId: B.entrepriseId });
      throw new Error("Aurait dû lever AccesRefuseError");
    } catch (err) {
      assert.ok(err instanceof AccesRefuseError, `Erreur inattendue: ${err}`);
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
