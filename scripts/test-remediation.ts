import assert from "node:assert";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as prestationsRepo from "../src/server/repositories/prestations";
import * as materielRepo from "../src/server/repositories/materiel";
import * as lignesPrixRepo from "../src/server/repositories/lignes-prix";
import * as tarifsRepo from "../src/server/repositories/tarifs";
import * as devisRepo from "../src/server/repositories/devis";
import * as cataloguePrestationsRepo from "../src/server/repositories/catalogue-prestations";
import { enregistrerPropositions } from "../src/server/repositories/propositions-ia";
import { appliquerPropositionsAction } from "../src/app/chantiers/[id]/informations/actions";
import { getOutil } from "../src/server/ai/tools/registre";
import type { ActionProposee } from "../src/server/ai/propositions";
import type { Ctx } from "../src/server/repositories/context";
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

async function appliquerViaPropositions(ctx: Ctx, chantierId: string, propositions: ActionProposee[]) {
  const enregistrees = await enregistrerPropositions(ctx, chantierId, propositions);
  return appliquerPropositionsAction(chantierId, enregistrees.map((r) => r.id));
}

async function main() {
  await nettoyerBase();

  const { entreprise: entA, utilisateurId: userA } = await entreprisesRepo.creerEntreprise(
    { nom: "Entreprise Remediation A" },
    { email: "remediation-a@test.local", nom: "A" }
  );
  const A = { entrepriseId: entA.id, utilisateurId: userA };
  process.env.AUTH_TEST_UTILISATEUR_ID = userA;

  // === Bug 1 : modification inter-chantier ===

  await test("Bug 1 — modifier_prestation ciblant un id d'un AUTRE chantier est rejeté", async () => {
    const chantierA = await chantiersRepo.creerChantier(A, { nom: "Chantier A bug1" });
    const chantierB = await chantiersRepo.creerChantier(A, { nom: "Chantier B bug1" });
    const prestationB = await prestationsRepo.ajouterPrestation(A, chantierB.id, "Prestation de B");

    const { resultats } = await appliquerViaPropositions(A, chantierA.id, [
      { type: "modifier_prestation", description: "x", donnees: { id: prestationB.id, libelle: "MODIFIÉ VIA A" } },
    ]);

    assert.equal(resultats[0].statut, "conflit");
    const prestationsB = await prestationsRepo.listerPrestations(A, chantierB.id);
    assert.equal(prestationsB[0].libelle, "Prestation de B", "La prestation de B ne doit jamais être modifiée via chantier A");
  });

  await test("Bug 1 — modifier_materiel ciblant un id d'un AUTRE chantier est rejeté", async () => {
    const chantierA = await chantiersRepo.creerChantier(A, { nom: "Chantier A bug1 materiel" });
    const chantierB = await chantiersRepo.creerChantier(A, { nom: "Chantier B bug1 materiel" });
    const materielB = await materielRepo.ajouterMateriel(A, chantierB.id, "Matériel de B");

    const { resultats } = await appliquerViaPropositions(A, chantierA.id, [
      { type: "modifier_materiel", description: "x", donnees: { id: materielB.id, libelle: "MODIFIÉ VIA A" } },
    ]);

    assert.equal(resultats[0].statut, "conflit");
    const materielsB = await materielRepo.listerMateriel(A, chantierB.id);
    assert.equal(materielsB[0].libelle, "Matériel de B", "Le matériel de B ne doit jamais être modifié via chantier A");
  });

  // === Bugs 2/3 : rejeu et montant falsifié ===

  await test("Bug 2 — la même confirmation rejouée séquentiellement ne produit qu'une seule écriture", async () => {
    const chantier = await chantiersRepo.creerChantier(A, { nom: "Chantier rejeu séquentiel" });
    const [enregistree] = await enregistrerPropositions(A, chantier.id, [
      { type: "ajouter_prestation", description: "x", donnees: { libelle: "Prestation rejouée" } },
    ]);

    const r1 = await appliquerPropositionsAction(chantier.id, [enregistree.id]);
    const r2 = await appliquerPropositionsAction(chantier.id, [enregistree.id]);

    assert.equal(r1.resultats[0].statut, "appliquee");
    assert.equal(r2.resultats[0].statut, "conflit");
    assert.equal(r2.resultats[0].categorie, "deja_appliquee");

    const prestations = await prestationsRepo.listerPrestations(A, chantier.id);
    assert.equal(prestations.filter((p) => p.libelle === "Prestation rejouée").length, 1, "Une seule écriture doit exister");
  });

  await test("Bug 2 — la même confirmation exécutée concurremment ne produit qu'une seule écriture", async () => {
    const chantier = await chantiersRepo.creerChantier(A, { nom: "Chantier rejeu concurrent" });
    const [enregistree] = await enregistrerPropositions(A, chantier.id, [
      { type: "ajouter_ligne_prix", description: "x", donnees: { libelle: "Ligne concurrente", montant: "100.00" } },
    ]);

    const [r1, r2] = await Promise.all([
      appliquerPropositionsAction(chantier.id, [enregistree.id]),
      appliquerPropositionsAction(chantier.id, [enregistree.id]),
    ]);

    const statuts = [r1.resultats[0].statut, r2.resultats[0].statut].sort();
    assert.deepEqual(statuts, ["appliquee", "conflit"], "Exactement une tentative doit réussir, l'autre doit échouer");

    const lignes = await lignesPrixRepo.listerLignesPrix(A, chantier.id);
    assert.equal(lignes.filter((l) => l.libelle === "Ligne concurrente").length, 1, "Une seule ligne doit exister malgré la concurrence");
  });

  await test("Bug 3 — un montant falsifié par le client est ignoré : le prix persisté est celui du tarif serveur", async () => {
    const chantier = await chantiersRepo.creerChantier(A, { nom: "Chantier montant falsifié" });
    const tarif = await tarifsRepo.creerTarif(A, { intitule: "Test Remediation Tarif", prix: "50.00" });

    const [enregistree] = await enregistrerPropositions(A, chantier.id, [
      {
        type: "ajouter_ligne_prix",
        description: "Ajouter une ligne de prix : Test Remediation Tarif (50.00 €, tarif de l'entreprise)",
        donnees: { libelle: tarif.intitule, montant: "50000.00", tarifId: tarif.id },
      },
    ]);

    const { resultats } = await appliquerPropositionsAction(chantier.id, [enregistree.id]);
    assert.equal(resultats[0].statut, "appliquee");

    const lignes = await lignesPrixRepo.listerLignesPrix(A, chantier.id);
    assert.equal(lignes.length, 1);
    assert.equal(lignes[0].montant, "50.00", "Le montant persisté doit être celui du tarif serveur, jamais celui falsifié");
  });

  await test("Bug 3 — si le tarif référencé a été supprimé entre la proposition et la confirmation, conflit explicite", async () => {
    const chantier = await chantiersRepo.creerChantier(A, { nom: "Chantier tarif supprimé" });
    const tarif = await tarifsRepo.creerTarif(A, { intitule: "Test Remediation Tarif Supprimé", prix: "80.00" });
    const [enregistree] = await enregistrerPropositions(A, chantier.id, [
      {
        type: "ajouter_ligne_prix",
        description: "x",
        donnees: { libelle: tarif.intitule, montant: "80.00", tarifId: tarif.id },
      },
    ]);
    await tarifsRepo.supprimerTarif(A, tarif.id);

    const { resultats } = await appliquerPropositionsAction(chantier.id, [enregistree.id]);
    assert.equal(resultats[0].statut, "conflit");
    const lignes = await lignesPrixRepo.listerLignesPrix(A, chantier.id);
    assert.equal(lignes.length, 0, "Aucune ligne ne doit être créée à partir d'un tarif disparu");
  });

  // === Bug 4 : transaction scindée pour ajouter_ligne_prix ===

  await test("Bug 4 — aucune ligne vide intermédiaire : la ligne apparaît directement complète", async () => {
    const chantier = await chantiersRepo.creerChantier(A, { nom: "Chantier ligne atomique" });
    const [enregistree] = await enregistrerPropositions(A, chantier.id, [
      { type: "ajouter_ligne_prix", description: "x", donnees: { libelle: "Ligne atomique", montant: "123.45" } },
    ]);
    await appliquerPropositionsAction(chantier.id, [enregistree.id]);

    const lignes = await lignesPrixRepo.listerLignesPrix(A, chantier.id);
    assert.equal(lignes.length, 1);
    assert.notEqual(lignes[0].libelle, "");
    assert.notEqual(lignes[0].montant, "0.00");
    assert.equal(lignes[0].libelle, "Ligne atomique");
    assert.equal(lignes[0].montant, "123.45");
  });

  // === Bug 5 : paramètres d'outil invalides ===

  await test("Bug 5 — le schéma d'un outil rejette bien des paramètres invalides", async () => {
    const outil = getOutil("RechercherHistoriquePrix")!;
    const validation = outil.schema.safeParse({});
    assert.equal(validation.success, false, "Le schéma doit rejeter {} (prestationId manquant)");
  });

  await test("Bug 5 — un résultat vide légitime reste structurellement identifiable", async () => {
    const outil = getOutil("RechercherHistoriquePrix")!;
    const chantier = await chantiersRepo.creerChantier(A, { nom: "Chantier historique vide legitime" });
    const prestation = await cataloguePrestationsRepo.creerPrestationCatalogue({ nomCanonique: "Test Remediation Vide" });
    const resultatValide = await outil.executer({ ctx: A, chantierId: chantier.id }, { prestationId: prestation.id });
    assert.deepEqual(resultatValide, { historique: [], dernierPrix: null });
  });

  // === Bug 6 : erreurs avalées ===

  await test("Bug 6 — une donnée invalide (montant non numérique) est catégorisée 'technique'", async () => {
    const chantier = await chantiersRepo.creerChantier(A, { nom: "Chantier montant invalide" });
    const [enregistree] = await enregistrerPropositions(A, chantier.id, [
      { type: "ajouter_ligne_prix", description: "x", donnees: { libelle: "Ligne invalide", montant: "pas-un-nombre" } },
    ]);
    const { resultats } = await appliquerPropositionsAction(chantier.id, [enregistree.id]);
    assert.equal(resultats[0].statut, "conflit");
    assert.equal(resultats[0].categorie, "technique");
  });

  await test("Bug 6 — un conflit métier légitime est catégorisé différemment d'une panne technique", async () => {
    const chantier = await chantiersRepo.creerChantier(A, { nom: "Chantier categorie conflit" });
    const [enregistree] = await enregistrerPropositions(A, chantier.id, [
      { type: "modifier_prestation", description: "x", donnees: { id: "00000000-0000-0000-0000-000000000000", libelle: "x" } },
    ]);
    const { resultats } = await appliquerPropositionsAction(chantier.id, [enregistree.id]);
    assert.equal(resultats[0].statut, "conflit");
    assert.equal(resultats[0].categorie, "conflit_metier");
  });

  // === Bug 7 : régénération du devis ===

  await test("Bug 7 — l'ajout d'une ligne de prix régénère effectivement le devis", async () => {
    const chantier = await chantiersRepo.creerChantier(A, { nom: "Chantier regen devis" });
    const [enregistree] = await enregistrerPropositions(A, chantier.id, [
      { type: "ajouter_ligne_prix", description: "x", donnees: { libelle: "Ligne regen", montant: "77.00" } },
    ]);
    const { avertissement } = await appliquerPropositionsAction(chantier.id, [enregistree.id]);
    assert.equal(avertissement, undefined, "Aucun avertissement attendu quand la régénération réussit");
    const devis = await devisRepo.getDevisPourChantier(A, chantier.id);
    assert.equal(devis?.totalHt, "77.00");
  });

  await test("Bug 7 — le type de retour distingue résultats par proposition et avertissement global", async () => {
    const chantier = await chantiersRepo.creerChantier(A, { nom: "Chantier structure retour" });
    const resultat = await appliquerPropositionsAction(chantier.id, []);
    assert.ok("resultats" in resultat && "avertissement" in resultat);
  });

  // === Bug 9 : ordre déterministe du catalogue ===

  await test("Bug 9 — la recherche catalogue renvoie un ordre stable et reproductible", async () => {
    await cataloguePrestationsRepo.creerPrestationCatalogue({ nomCanonique: "Test Remediation Zzz", synonymes: ["remediationtest9"] });
    await cataloguePrestationsRepo.creerPrestationCatalogue({ nomCanonique: "Test Remediation Aaa", synonymes: ["remediationtest9"] });
    await cataloguePrestationsRepo.creerPrestationCatalogue({ nomCanonique: "Test Remediation Mmm", synonymes: ["remediationtest9"] });

    const r1 = await cataloguePrestationsRepo.rechercherPrestationCatalogue("remediationtest9");
    const r2 = await cataloguePrestationsRepo.rechercherPrestationCatalogue("remediationtest9");
    const r3 = await cataloguePrestationsRepo.rechercherPrestationCatalogue("remediationtest9");

    assert.deepEqual(r1.map((p) => p.nomCanonique), r2.map((p) => p.nomCanonique));
    assert.deepEqual(r2.map((p) => p.nomCanonique), r3.map((p) => p.nomCanonique));
    assert.deepEqual(r1.map((p) => p.nomCanonique), ["Test Remediation Aaa", "Test Remediation Mmm", "Test Remediation Zzz"]);
  });

  console.log(`\n${passed} test(s) réussi(s), ${failed} échoué(s).`);
  await pool.end();
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
