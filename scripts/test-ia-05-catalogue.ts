import assert from "node:assert";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as cataloguePrestationsRepo from "../src/server/repositories/catalogue-prestations";
import * as catalogueMaterielsRepo from "../src/server/repositories/catalogue-materiels";
import * as historiquePrixRepo from "../src/server/repositories/historique-prix";
import { poserQuestion } from "../src/server/ai/services/assistant-service";

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
  // Nettoyage ciblé : le catalogue est global (jamais tronqué par les autres
  // tests), on nettoie donc explicitement les entrées créées par CE fichier.
  await pool.query(`DELETE FROM historique_prix`);
  await pool.query(`DELETE FROM catalogue_prestations WHERE nom_canonique LIKE 'Test IA-05%'`);
  await pool.query(`DELETE FROM catalogue_materiels WHERE nom_canonique LIKE 'Test IA-05%'`);
  await pool.query(`
    TRUNCATE TABLE
      lignes_devis, devis, lignes_prix, photos, notes_vocales, fichiers_a_purger,
      materiel, prestations, chantiers, clients, tarifs,
      entreprise_compteurs, membres_entreprise, entreprises, users
    RESTART IDENTITY CASCADE
  `);

  const { entreprise: entA, utilisateurId: userA } = await entreprisesRepo.creerEntreprise(
    { nom: "Entreprise Catalogue A" },
    { email: "catalogue-a@test.local", nom: "A" }
  );
  const A = { entrepriseId: entA.id, utilisateurId: userA };
  const { entreprise: entB, utilisateurId: userB } = await entreprisesRepo.creerEntreprise(
    { nom: "Entreprise Catalogue B" },
    { email: "catalogue-b@test.local", nom: "B" }
  );
  const B = { entrepriseId: entB.id, utilisateurId: userB };

  {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`SELECT set_config('app.entreprise_id', $1, true)`, [entA.id]);
      await client.query(`INSERT INTO tarifs (entreprise_id, intitule, prix) VALUES ($1, 'Test IA-05 Élagage', '450.00')`, [
        entA.id,
      ]);
      await client.query("COMMIT");
    } finally {
      client.release();
    }
  }

  let prestationId = "";

  // --- Création d'une prestation ---
  await test("Création d'une prestation dans le catalogue partagé", async () => {
    const p = await cataloguePrestationsRepo.creerPrestationCatalogue({
      nomCanonique: "Test IA-05 Élagage",
      synonymes: ["abattage", "démontage"],
      variantes: ["sapin", "arbre"],
    });
    prestationId = p.id;
    assert.equal(p.nomCanonique, "Test IA-05 Élagage");
    assert.deepEqual(p.synonymes, ["abattage", "démontage"]);
  });

  await test("Création idempotente : un nom déjà existant renvoie l'entrée existante, pas un doublon", async () => {
    const p2 = await cataloguePrestationsRepo.creerPrestationCatalogue({ nomCanonique: "Test IA-05 Élagage" });
    assert.equal(p2.id, prestationId);
    const toutes = await cataloguePrestationsRepo.listerCataloguePrestations();
    assert.equal(toutes.filter((p) => p.nomCanonique === "Test IA-05 Élagage").length, 1);
  });

  // --- Création d'un matériel ---
  await test("Création d'un matériel dans le catalogue partagé", async () => {
    const m = await catalogueMaterielsRepo.creerMaterielCatalogue({
      nomCanonique: "Test IA-05 Nacelle",
      variantes: ["plateforme"],
    });
    assert.equal(m.nomCanonique, "Test IA-05 Nacelle");
  });

  // --- Recherche (synonymes/variantes) ---
  await test("Recherche par synonyme : 'abattage' retrouve la prestation canonique", async () => {
    const resultats = await cataloguePrestationsRepo.rechercherPrestationCatalogue("abattage");
    assert.ok(resultats.some((p) => p.nomCanonique === "Test IA-05 Élagage"));
  });

  await test("Recherche par variante : 'sapin' retrouve la même prestation canonique", async () => {
    const resultats = await cataloguePrestationsRepo.rechercherPrestationCatalogue("sapin");
    assert.ok(resultats.some((p) => p.nomCanonique === "Test IA-05 Élagage"));
  });

  await test("Recherche sans correspondance : renvoie une liste vide, jamais une invention", async () => {
    const resultats = await cataloguePrestationsRepo.rechercherPrestationCatalogue("xyzintrouvable123");
    assert.equal(resultats.length, 0);
  });

  // --- Historique des prix ---
  await test("Historique des prix : plusieurs prix conservés, jamais écrasés", async () => {
    await historiquePrixRepo.enregistrerPrixHistorique(A, { prestationId, prix: "400.00", origine: "manuel" });
    await historiquePrixRepo.enregistrerPrixHistorique(A, { prestationId, prix: "450.00", origine: "devis" });
    const historique = await historiquePrixRepo.listerHistoriquePrix(A, prestationId);
    assert.equal(historique.length, 2);
    const dernier = await historiquePrixRepo.getDernierPrixHistorique(A, prestationId);
    assert.equal(dernier?.prix, "450.00", "Le plus récent doit être renvoyé en premier");
  });

  // --- Isolation multi-société sur l'historique ---
  await test("Isolation : B ne voit jamais l'historique de prix de A (catalogue partagé, historique séparé)", async () => {
    const historiqueB = await historiquePrixRepo.listerHistoriquePrix(B, prestationId);
    assert.equal(historiqueB.length, 0);
    // Le catalogue lui-même reste visible par tous (partagé, par design).
    const resultatsB = await cataloguePrestationsRepo.rechercherPrestationCatalogue("sapin");
    assert.ok(resultatsB.some((p) => p.nomCanonique === "Test IA-05 Élagage"), "Le catalogue est partagé entre sociétés");
  });

  // --- Rapprochement IA-04 via le catalogue (plus la table codée en dur) ---
  await test("Rapprochement tarifaire IA-04 : passe désormais par le catalogue (synonyme 'sapin')", async () => {
    const chantier = await chantiersRepo.creerChantier(A, { nom: "Chantier catalogue" });
    const reponse = await poserQuestion(
      A,
      chantier.id,
      [],
      "Prépare le devis : démontage d'un sapin dans le jardin."
    );
    assert.equal(reponse.succes, true);
    if (reponse.succes) {
      assert.ok(reponse.sources.includes("RechercherPrestation"), "Le catalogue doit être consulté");
      assert.ok(
        reponse.propositions?.some((p) => p.type === "ajouter_ligne_prix"),
        "Le tarif doit être rapproché via le nom canonique du catalogue"
      );
    }
  });

  // --- Absence de création sans confirmation ---
  await test("Absence de création automatique : une simple question ne crée jamais d'entrée catalogue", async () => {
    const avant = await cataloguePrestationsRepo.listerCataloguePrestations();
    const chantier = await chantiersRepo.creerChantier(A, { nom: "Chantier pas de creation auto" });
    await poserQuestion(A, chantier.id, [], "Quelles sont les prestations prévues ?");
    const apres = await cataloguePrestationsRepo.listerCataloguePrestations();
    assert.equal(apres.length, avant.length, "Aucune prestation catalogue ne doit être créée sans confirmation explicite");
  });

  console.log(`\n${passed} test(s) réussi(s), ${failed} échoué(s).`);
  await pool.end();
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
