import assert from "node:assert";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as parametresRepo from "../src/server/repositories/parametres-chiffrage";
import * as historiquePrixRepo from "../src/server/repositories/historique-prix";
import * as cataloguePrestationsRepo from "../src/server/repositories/catalogue-prestations";
import { calculerChiffrage, calculerVariantes } from "../src/server/chiffrage/moteur";
import { chiffrerChantier } from "../src/server/chiffrage/service";
import { poserQuestion } from "../src/server/ai/services/assistant-service";
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
    { nom: "Entreprise Chiffrage A" },
    { email: "chiffrage-a@test.local", nom: "A" }
  );
  const A = { entrepriseId: entA.id, utilisateurId: userA };
  const { entreprise: entB, utilisateurId: userB } = await entreprisesRepo.creerEntreprise(
    { nom: "Entreprise Chiffrage B" },
    { email: "chiffrage-b@test.local", nom: "B" }
  );
  const B = { entrepriseId: entB.id, utilisateurId: userB };

  // --- Calcul simple ---
  await test("Calcul simple : coût main-d'œuvre + déplacement, marge, TVA, prix TTC", async () => {
    const resultat = calculerChiffrage({
      joursEstimes: 2,
      nombreOuvriers: 2,
      aUnChefEquipe: false,
      parametres: {
        coutJournalierOuvrier: "200.00",
        coutJournalierChefEquipe: "280.00",
        coutDeplacement: "35.00",
        margeCiblePourcent: "20.00",
        tauxTvaDefaut: "20.00",
      },
    });
    assert.equal(resultat.coutMainOeuvre, "800.00");
    assert.equal(resultat.sousTotal, "835.00");
    assert.equal(resultat.marge, "167.00");
    assert.equal(resultat.prixConseille, "1002.00");
    assert.equal(resultat.tva, "200.40");
    assert.equal(resultat.prixTtc, "1202.40");
  });

  // --- Explications (traçabilité) ---
  await test("Chaque montant est expliqué : main-d'œuvre, déplacement, marge", async () => {
    const resultat = calculerChiffrage({
      joursEstimes: 1,
      nombreOuvriers: 1,
      aUnChefEquipe: false,
      parametres: {
        coutJournalierOuvrier: "200.00",
        coutJournalierChefEquipe: "280.00",
        coutDeplacement: "35.00",
        margeCiblePourcent: "20.00",
        tauxTvaDefaut: "20.00",
      },
    });
    assert.ok(resultat.explications.some((e) => e.libelle === "Main-d'œuvre"));
    assert.ok(resultat.explications.some((e) => e.libelle === "Déplacement"));
    assert.ok(resultat.explications.some((e) => e.libelle === "Marge"));
  });

  // --- Absence d'invention de coûts ---
  await test("Durée/équipe inconnues : coût de main-d'œuvre à 0, avertissement explicite, jamais une valeur inventée", async () => {
    const resultat = calculerChiffrage({
      joursEstimes: null,
      nombreOuvriers: null,
      aUnChefEquipe: false,
      parametres: {
        coutJournalierOuvrier: "200.00",
        coutJournalierChefEquipe: "280.00",
        coutDeplacement: "35.00",
        margeCiblePourcent: "20.00",
        tauxTvaDefaut: "20.00",
      },
    });
    assert.equal(resultat.coutMainOeuvre, "0.00");
    assert.ok(resultat.avertissements.some((a) => a.includes("non connue")));
    assert.ok(resultat.avertissements.some((a) => a.includes("matériel")));
  });

  // --- Variantes ---
  await test("Variantes prudent/standard/premium : même sous-total, marges différentes, prix croissants", async () => {
    const entrees = {
      joursEstimes: 2,
      nombreOuvriers: 2,
      aUnChefEquipe: true,
      parametres: {
        coutJournalierOuvrier: "200.00",
        coutJournalierChefEquipe: "280.00",
        coutDeplacement: "35.00",
        margeCiblePourcent: "20.00",
        tauxTvaDefaut: "20.00",
      },
    };
    const { variantes } = calculerVariantes(entrees);
    assert.equal(variantes.prudent.sousTotal, variantes.standard.sousTotal);
    assert.equal(variantes.standard.sousTotal, variantes.premium.sousTotal);
    assert.equal(variantes.prudent.margePourcent, "15.00");
    assert.equal(variantes.standard.margePourcent, "20.00");
    assert.equal(variantes.premium.margePourcent, "30.00");
    assert.ok(Number(variantes.prudent.prixConseille) < Number(variantes.standard.prixConseille));
    assert.ok(Number(variantes.standard.prixConseille) < Number(variantes.premium.prixConseille));
  });

  // --- Paramètres entreprise (multi-société) ---
  await test("Paramètres par défaut créés à la première consultation, jamais mélangés entre sociétés", async () => {
    const paramsA = await parametresRepo.getOuCreerParametresChiffrage(A);
    assert.equal(paramsA.margeCiblePourcent, "20.00");
    await parametresRepo.mettreAJourParametresChiffrage(A, { margeCiblePourcent: "35.00" });
    const paramsAApres = await parametresRepo.getOuCreerParametresChiffrage(A);
    assert.equal(paramsAApres.margeCiblePourcent, "35.00");

    const paramsB = await parametresRepo.getOuCreerParametresChiffrage(B);
    assert.equal(paramsB.margeCiblePourcent, "20.00", "B ne doit jamais hériter du réglage de A");
  });

  // --- Historique ---
  await test("Chiffrage complet via le service : intègre l'historique de prix sans le remplacer", async () => {
    const prestation = await cataloguePrestationsRepo.creerPrestationCatalogue({
      nomCanonique: "Test IA-06 Menuiserie Unique",
      synonymes: ["menuiserietest06unique"],
    });
    await historiquePrixRepo.enregistrerPrixHistorique(A, { prestationId: prestation.id, prix: "400.00" });
    await historiquePrixRepo.enregistrerPrixHistorique(A, { prestationId: prestation.id, prix: "500.00" });

    const chantier = await chantiersRepo.creerChantier(A, { nom: "Chantier chiffrage historique" });
    await chantiersRepo.mettreAJourDureeEquipe(A, chantier.id, { dureePrevue: "2 jours", tailleEquipe: "2 hommes" });

    const resultat = await chiffrerChantier(A, chantier.id, "menuiserietest06unique");
    assert.ok(resultat);
    assert.equal(resultat?.historique?.nombreDevis, 2);
    assert.equal(resultat?.historique?.dernierPrix, "500.00");
    assert.equal(resultat?.historique?.moyenne, "450.00");
    assert.notEqual(resultat?.variantes.standard.prixConseille, resultat?.historique?.moyenne);
  });

  // --- Isolation multi-société sur l'historique (catalogue partagé) ---
  await test("Isolation : B ne voit jamais l'historique de prix de A dans son chiffrage", async () => {
    const correspondances = await cataloguePrestationsRepo.rechercherPrestationCatalogue("menuiserietest06unique");
    const chantierB = await chantiersRepo.creerChantier(B, { nom: "Chantier B chiffrage" });
    const resultatB = await chiffrerChantier(B, chantierB.id, "menuiserietest06unique");
    assert.equal(resultatB?.historique, null);
    assert.ok(correspondances.length > 0, "Le catalogue reste consultable par B (partagé)");
  });

  // --- Intégration IA-04 : le moteur propose un prix calculé si aucun tarif n'existe ---
  await test("Intégration IA-04 : aucun tarif existant -> prix calculé par le moteur, clairement distingué", async () => {
    const chantier = await chantiersRepo.creerChantier(A, { nom: "Chantier devis chiffrage" });
    await chantiersRepo.mettreAJourDureeEquipe(A, chantier.id, { dureePrevue: "2 jours", tailleEquipe: "2 hommes" });
    const reponse = await poserQuestion(
      A,
      chantier.id,
      [],
      "Prépare le devis : plomberie de la salle de bain, deux jours, deux hommes."
    );
    assert.equal(reponse.succes, true);
    if (reponse.succes) {
      const ligne = reponse.propositions?.find((p) => p.type === "ajouter_ligne_prix");
      assert.ok(ligne, "Une ligne de prix calculée doit être proposée");
      assert.ok(reponse.texte.includes("calculé"), "Le texte doit préciser qu'il s'agit d'un prix calculé, pas d'un tarif");
    }
  });

  // --- Question directe de chiffrage ---
  await test("Question directe : 'Quel prix conseiller ?' déclenche le moteur et explique le résultat", async () => {
    const chantier = await chantiersRepo.creerChantier(A, { nom: "Chantier question prix" });
    await chantiersRepo.mettreAJourDureeEquipe(A, chantier.id, { dureePrevue: "3 jours", tailleEquipe: "1 homme" });
    const reponse = await poserQuestion(A, chantier.id, [], "Quel prix conseilles-tu pour ce chantier ?");
    assert.equal(reponse.succes, true);
    if (reponse.succes) {
      assert.ok(reponse.sources.includes("CalculerChiffrage"));
      assert.ok(reponse.texte.includes("Prix conseillé"));
      assert.ok(reponse.texte.includes("Main-d'œuvre"), "L'explication doit tracer la provenance du coût");
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
