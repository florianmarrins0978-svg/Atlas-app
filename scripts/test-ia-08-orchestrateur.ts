import assert from "node:assert";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as tarifsRepo from "../src/server/repositories/tarifs";
import * as prestationsRepo from "../src/server/repositories/prestations";
import * as devisRepo from "../src/server/repositories/devis";
import * as cataloguePrestationsRepo from "../src/server/repositories/catalogue-prestations";
import { executerWorkflowDemande } from "../src/server/orchestrateur/workflow";
import { appliquerPropositionsAction } from "../src/app/chantiers/[id]/informations/actions";
import { enregistrerPropositions } from "../src/server/repositories/propositions-ia";
import type { Ctx } from "../src/server/repositories/context";

async function appliquerViaPropositions(ctx: Ctx, chantierId: string, propositions: ActionProposee[]) {
  const enregistrees = await enregistrerPropositions(ctx, chantierId, propositions);
  return appliquerPropositionsAction(chantierId, enregistrees.map((r) => r.id));
}
import { poserQuestion } from "../src/server/ai/services/assistant-service";
import type { ActionProposee } from "../src/server/ai/propositions";
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
    { nom: "Entreprise Orchestrateur A" },
    { email: "orchestrateur-a@test.local", nom: "A" }
  );
  const A = { entrepriseId: entA.id, utilisateurId: userA };
  process.env.AUTH_TEST_UTILISATEUR_ID = userA;
  const { entreprise: entB, utilisateurId: userB } = await entreprisesRepo.creerEntreprise(
    { nom: "Entreprise Orchestrateur B" },
    { email: "orchestrateur-b@test.local", nom: "B" }
  );
  const B = { entrepriseId: entB.id, utilisateurId: userB };

  await cataloguePrestationsRepo.creerPrestationCatalogue({
    nomCanonique: "Test IA-08 Élagage",
    synonymes: ["abattage08"],
    variantes: ["sapin08"],
  });
  await tarifsRepo.creerTarif(A, { intitule: "Test IA-08 Élagage", prix: "450.00" });

  // --- Workflow complet ---
  await test("Workflow complet : toutes les étapes tracées, proposition finale produite", async () => {
    const chantier = await chantiersRepo.creerChantier(A, { nom: "Chantier workflow complet" });
    await chantiersRepo.mettreAJourDureeEquipe(A, chantier.id, { dureePrevue: "2 jours", tailleEquipe: "2 hommes" });

    const resultat = await executerWorkflowDemande(A, chantier.id, "Élagage d'un sapin08, deux jours, deux hommes.");
    assert.equal(resultat.statut, "termine");
    assert.equal(resultat.etapes.length, 7);
    assert.deepEqual(
      resultat.etapes.map((e) => e.nom),
      [
        "Analyse de la demande",
        "Recherche documentaire",
        "Recherche catalogue",
        "Recherche historique",
        "Recherche tarifs",
        "Calcul du chiffrage",
        "Préparation du devis et proposition finale",
      ]
    );
    assert.ok(resultat.propositionFinale);
    assert.ok(resultat.propositionFinale?.propositions.some((p) => (p as ActionProposee).type === "ajouter_ligne_prix"));
  });

  // --- Traçabilité : chaque étape a ses sources ---
  await test("Traçabilité : chaque étape enregistre l'outil utilisé", async () => {
    const chantier = await chantiersRepo.creerChantier(A, { nom: "Chantier traçabilité" });
    await chantiersRepo.mettreAJourDureeEquipe(A, chantier.id, { dureePrevue: "1 jour", tailleEquipe: "1 homme" });
    const resultat = await executerWorkflowDemande(A, chantier.id, "Élagage d'un sapin08.");
    const etapeCatalogue = resultat.etapes.find((e) => e.nom === "Recherche catalogue");
    assert.deepEqual(etapeCatalogue?.sources, ["RechercherPrestation"]);
    const etapeChiffrage = resultat.etapes.find((e) => e.nom === "Calcul du chiffrage");
    assert.deepEqual(etapeChiffrage?.sources, ["CalculerChiffrage"]);
  });

  // --- Arrêt sur données manquantes ---
  await test("Arrêt explicite : aucun tarif et durée/équipe inconnues -> arrêt propre, sans invention", async () => {
    const chantier = await chantiersRepo.creerChantier(A, { nom: "Chantier arrêt données manquantes" });
    const resultat = await executerWorkflowDemande(A, chantier.id, "Peinture des volets, rien de plus précis.");
    assert.equal(resultat.statut, "arrete");
    assert.ok(resultat.raisonArret?.includes("durée") || resultat.raisonArret?.includes("équipe"));
    assert.ok(resultat.prochaineAction);
    assert.equal(resultat.propositionFinale, undefined);
    assert.ok(resultat.etapes.some((e) => e.nom === "Analyse de la demande" && e.statut === "reussie"));
  });

  // --- Absence d'invention : aucune écriture pendant le workflow ---
  await test("Absence d'invention : le workflow ne modifie jamais les données", async () => {
    const chantier = await chantiersRepo.creerChantier(A, { nom: "Chantier aucune écriture" });
    await chantiersRepo.mettreAJourDureeEquipe(A, chantier.id, { dureePrevue: "2 jours", tailleEquipe: "2 hommes" });
    const avant = await prestationsRepo.listerPrestations(A, chantier.id);
    await executerWorkflowDemande(A, chantier.id, "Élagage d'un sapin08, deux jours, deux hommes.");
    const apres = await prestationsRepo.listerPrestations(A, chantier.id);
    assert.equal(apres.length, avant.length);
    const devis = await devisRepo.getDevisPourChantier(A, chantier.id);
    assert.equal(devis, null, "Aucun devis ne doit être créé par le seul fait d'exécuter le workflow");
  });

  // --- Confirmation IA-03 : la proposition finale suit le mécanisme existant ---
  await test("Confirmation IA-03 : la proposition du workflow s'applique via le mécanisme existant, rien d'automatique", async () => {
    const chantier = await chantiersRepo.creerChantier(A, { nom: "Chantier confirmation ia-03" });
    await chantiersRepo.mettreAJourDureeEquipe(A, chantier.id, { dureePrevue: "2 jours", tailleEquipe: "2 hommes" });
    const resultat = await executerWorkflowDemande(A, chantier.id, "Élagage d'un sapin08, deux jours, deux hommes.");
    assert.ok(resultat.propositionFinale);

    const propositions = resultat.propositionFinale!.propositions as ActionProposee[];
    const { resultats } = await appliquerViaPropositions(A, chantier.id, propositions);
    assert.ok(resultats.every((r) => r.statut === "appliquee"));
    const devis = await devisRepo.getDevisPourChantier(A, chantier.id);
    assert.ok(devis);
    assert.equal(devis?.statut, "brouillon");
  });

  // --- Réversibilité : les propositions non transmises ne sont jamais appliquées ---
  await test("Réversibilité : une proposition du workflow non transmise n'est jamais appliquée", async () => {
    const chantier = await chantiersRepo.creerChantier(A, { nom: "Chantier reversibilite" });
    await chantiersRepo.mettreAJourDureeEquipe(A, chantier.id, { dureePrevue: "2 jours", tailleEquipe: "2 hommes" });
    const resultat = await executerWorkflowDemande(A, chantier.id, "Élagage d'un sapin08, deux jours, deux hommes.");
    const propositions = (resultat.propositionFinale!.propositions as ActionProposee[]).filter(
      (p) => p.type !== "ajouter_ligne_prix"
    );
    await appliquerViaPropositions(A, chantier.id, propositions);
    const devis = await devisRepo.getDevisPourChantier(A, chantier.id);
    assert.equal(devis, null, "Sans la proposition de ligne de prix, aucun devis ne doit être créé");
  });

  // --- Multi-société ---
  await test("Isolation : le workflow de B ne voit jamais le tarif de A", async () => {
    const chantierB = await chantiersRepo.creerChantier(B, { nom: "Chantier B workflow" });
    await chantiersRepo.mettreAJourDureeEquipe(B, chantierB.id, { dureePrevue: "2 jours", tailleEquipe: "2 hommes" });
    const resultat = await executerWorkflowDemande(B, chantierB.id, "Élagage d'un sapin08, deux jours, deux hommes.");
    const etapeTarifs = resultat.etapes.find((e) => e.nom === "Recherche tarifs");
    assert.ok(
      etapeTarifs?.statut === "ignoree" || etapeTarifs?.avertissements.includes("Aucun tarif existant ne correspond."),
      "B ne doit jamais retrouver le tarif de A"
    );
  });

  // --- Tolérance aux erreurs ---
  await test("Tolérance aux erreurs : chantier introuvable -> arrêt technique explicite, jamais une explication métier fausse", async () => {
    const idInexistant = "00000000-0000-0000-0000-000000000000";
    const resultat = await executerWorkflowDemande(A, idInexistant, "Élagage d'un sapin08.");
    // Remédiation bug 11 (test tautologique) + bug 10 (erreur technique vs
    // arrêt métier) : la raison d'arrêt doit explicitement signaler une
    // erreur technique, jamais prétendre que la durée/l'équipe sont
    // "inconnues" comme s'il s'agissait d'une donnée métier normalement
    // absente.
    assert.equal(resultat.statut, "arrete");
    assert.ok(resultat.raisonArret?.includes("erreur technique"), `raisonArret devrait signaler une erreur technique, reçu : ${resultat.raisonArret}`);
    assert.ok(!resultat.raisonArret?.includes("durée ou la taille de l'équipe"), "ne doit jamais confondre une erreur technique avec une donnée métier manquante");
  });

  // --- Intégration avec l'assistant ---
  await test("Assistant : déclenche le workflow, la proposition passe par le mécanisme de confirmation habituel", async () => {
    const chantier = await chantiersRepo.creerChantier(A, { nom: "Chantier assistant workflow" });
    await chantiersRepo.mettreAJourDureeEquipe(A, chantier.id, { dureePrevue: "2 jours", tailleEquipe: "2 hommes" });

    const reponse1 = await poserQuestion(
      A,
      chantier.id,
      [],
      "Traite cette demande de bout en bout : élagage d'un sapin08, deux jours, deux hommes."
    );
    assert.equal(reponse1.succes, true);
    if (!reponse1.succes) return;
    assert.ok(reponse1.propositions && reponse1.propositions.length > 0);
    assert.ok(reponse1.sources.includes("ExecuterWorkflowDemande"));
  });

  await test("Assistant : question de suivi 'quelles sources' dans un nouvel échange, retrouvée depuis la conversation", async () => {
    const chantier = await chantiersRepo.creerChantier(A, { nom: "Chantier assistant suivi sources" });
    await chantiersRepo.mettreAJourDureeEquipe(A, chantier.id, { dureePrevue: "2 jours", tailleEquipe: "2 hommes" });
    const demandeOriginale = "Traite cette demande de bout en bout : élagage d'un sapin08, deux jours, deux hommes.";
    const reponse1 = await poserQuestion(A, chantier.id, [], demandeOriginale);
    assert.equal(reponse1.succes, true);
    if (!reponse1.succes) return;

    const historiquePourSuite = [
      { role: "user" as const, contenu: demandeOriginale },
      { role: "assistant" as const, contenu: reponse1.texte },
    ];
    const reponseSources = await poserQuestion(A, chantier.id, historiquePourSuite, "Quelles sources as-tu utilisées ?");
    assert.equal(reponseSources.succes, true);
    if (reponseSources.succes) assert.ok(reponseSources.texte.includes("RechercherPrestation"));
  });

  await test("Assistant : question de suivi 'pourquoi ce prix' explique via le chiffrage de la même conversation", async () => {
    const chantier = await chantiersRepo.creerChantier(A, { nom: "Chantier assistant suivi prix" });
    await chantiersRepo.mettreAJourDureeEquipe(A, chantier.id, { dureePrevue: "2 jours", tailleEquipe: "2 hommes" });
    const demandeOriginale = "Traite cette demande de bout en bout : élagage d'un sapin08, deux jours, deux hommes.";
    const reponse1 = await poserQuestion(A, chantier.id, [], demandeOriginale);
    assert.equal(reponse1.succes, true);
    if (!reponse1.succes) return;

    const historiquePourSuite = [
      { role: "user" as const, contenu: demandeOriginale },
      { role: "assistant" as const, contenu: reponse1.texte },
    ];
    const reponsePourquoi = await poserQuestion(A, chantier.id, historiquePourSuite, "Pourquoi proposes-tu ce prix ?");
    assert.equal(reponsePourquoi.succes, true);
    if (reponsePourquoi.succes) assert.ok(reponsePourquoi.texte.toLowerCase().includes("chiffrage"));
  });

  console.log(`\n${passed} test(s) réussi(s), ${failed} échoué(s).`);
  await pool.end();
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
