import assert from "node:assert";
import Decimal from "decimal.js";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as lignesPrixRepo from "../src/server/repositories/lignes-prix";
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
    { nom: "Entreprise Prix A" },
    { email: "prix-a@test.local", nom: "A" }
  );
  const A = { entrepriseId: entA.id, utilisateurId: userA };
  const { entreprise: entB, utilisateurId: userB } = await entreprisesRepo.creerEntreprise(
    { nom: "Entreprise Prix B" },
    { email: "prix-b@test.local", nom: "B" }
  );
  const B = { entrepriseId: entB.id, utilisateurId: userB };

  const chantier = await chantiersRepo.creerChantier(A, { nom: "Chantier prix" });

  await test("Aucune ligne au départ, total = 0.00", async () => {
    const liste = await lignesPrixRepo.listerLignesPrix(A, chantier.id);
    assert.equal(liste.length, 0);
    const total = await lignesPrixRepo.totalLignesPrix(A, chantier.id);
    assert.equal(total, "0.00");
  });

  await test("Ajout : quantite=1 et prixUnitaire=montant maintenus par défaut", async () => {
    const ligne = await lignesPrixRepo.ajouterLignePrix(A, chantier.id, "Main d'œuvre", "1120.00");
    assert.equal(ligne.quantite, "1.00");
    assert.equal(ligne.prixUnitaire, "1120.00");
  });

  await test("Ordre d'insertion respecté", async () => {
    await lignesPrixRepo.ajouterLignePrix(A, chantier.id, "Dépose carrelage", "144.00");
    await lignesPrixRepo.ajouterLignePrix(A, chantier.id, "Pose faïence", "360.00");
    await lignesPrixRepo.ajouterLignePrix(A, chantier.id, "Forfait déplacement", "35.00");
    const liste = await lignesPrixRepo.listerLignesPrix(A, chantier.id);
    assert.deepEqual(
      liste.map((l) => l.libelle),
      ["Main d'œuvre", "Dépose carrelage", "Pose faïence", "Forfait déplacement"]
    );
  });

  await test("Précision décimale : 0.10 + 0.20 = 0.30 exactement (jamais 0.30000000000000004)", async () => {
    const c2 = await chantiersRepo.creerChantier(A, { nom: "Chantier décimales" });
    await lignesPrixRepo.ajouterLignePrix(A, c2.id, "Ligne A", "0.10");
    await lignesPrixRepo.ajouterLignePrix(A, c2.id, "Ligne B", "0.20");
    const total = await lignesPrixRepo.totalLignesPrix(A, c2.id);
    assert.equal(total, "0.30");
    // Contre-épreuve : le calcul flottant natif échouerait sur ce cas précis.
    assert.notEqual(0.1 + 0.2, 0.3, "Ce test n'a de sens que si 0.1+0.2 !== 0.3 en JS natif");
  });

  await test("Modification du montant recalcule le total exactement", async () => {
    const liste = await lignesPrixRepo.listerLignesPrix(A, chantier.id);
    const [premiere] = liste.length > 0 ? liste : [await lignesPrixRepo.ajouterLignePrix(A, chantier.id, "X", "10.00")];
    const totalAvant = new Decimal(await lignesPrixRepo.totalLignesPrix(A, chantier.id));
    const ancienMontant = new Decimal(premiere.montant);
    await lignesPrixRepo.modifierLignePrix(A, premiere.id, { montant: "999.99" });
    const totalApres = new Decimal(await lignesPrixRepo.totalLignesPrix(A, chantier.id));
    const attendu = totalAvant.minus(ancienMontant).plus("999.99");
    assert.equal(totalApres.toFixed(2), attendu.toFixed(2));
  });

  await test("Suppression d'une ligne retire son montant du total", async () => {
    const liste = await lignesPrixRepo.listerLignesPrix(A, chantier.id);
    const totalAvant = new Decimal(await lignesPrixRepo.totalLignesPrix(A, chantier.id));
    await lignesPrixRepo.supprimerLignePrix(A, liste[0].id);
    const totalApres = new Decimal(await lignesPrixRepo.totalLignesPrix(A, chantier.id));
    assert.equal(totalApres.toFixed(2), totalAvant.minus(liste[0].montant).toFixed(2));
  });

  await test("Réordonnancement des lignes de prix", async () => {
    const liste = await lignesPrixRepo.listerLignesPrix(A, chantier.id);
    const idsInverses = [...liste].reverse().map((l) => l.id);
    await lignesPrixRepo.reordonnerLignesPrix(A, chantier.id, idsInverses);
    const relue = await lignesPrixRepo.listerLignesPrix(A, chantier.id);
    assert.deepEqual(
      relue.map((l) => l.id),
      idsInverses
    );
  });

  await test("montant/quantite/prixUnitaire restent des chaînes (jamais un float JS)", async () => {
    const liste = await lignesPrixRepo.listerLignesPrix(A, chantier.id);
    for (const l of liste) {
      assert.equal(typeof l.montant, "string");
      assert.equal(typeof l.quantite, "string");
      assert.equal(typeof l.prixUnitaire, "string");
    }
  });

  await test("Isolation : B ne peut pas lire les lignes de prix ni le total du chantier de A", async () => {
    const liste = await lignesPrixRepo.listerLignesPrix(B, chantier.id);
    assert.equal(liste.length, 0);
    const total = await lignesPrixRepo.totalLignesPrix(B, chantier.id);
    assert.equal(total, "0.00");
  });

  // ═════════════════════════════════════════════════════════════════════════
  // « À chiffrer » : le drapeau s'éteint QUEL QUE SOIT LE CHAMP par lequel un
  // prix arrive. Deux écrans écrivent ici, et ils n'envoient pas la même chose.
  // ═════════════════════════════════════════════════════════════════════════

  await test("l'écran Prix éteint « à chiffrer » — il envoie un montant", async () => {
    const l = await lignesPrixRepo.ajouterLignePrix(A, chantier.id, "Dessouchage", "0.00", {
      aChiffrer: true,
    });
    await lignesPrixRepo.modifierLignePrix(A, l.id, { montant: "400.00" });
    const [relue] = (await lignesPrixRepo.listerLignesPrix(A, chantier.id)).filter((x) => x.id === l.id);
    assert.equal(relue.aChiffrer, false, "le drapeau est resté levé malgré un montant posé");
  });

  await test("l'écran DEVIS COMPLET l'éteint aussi — il n'envoie pas de montant", async () => {
    // ═══════════════════════════════════════════════════════════════════════
    // **Le défaut du 31 août 2026, et il n'avait aucune sortie.** Dans ses
    // mots : *« je suis revenu en arrière, j'ai mis les prix pour chaque ligne,
    // mais il ne veut quand même pas que j'envoie mon devis »*.
    //
    // Cet écran-là poste `{ libelle, quantite, prixUnitaire }` ; le montant est
    // CALCULÉ par le dépôt. L'extinction lisait l'entrée au lieu du résultat :
    // le total du devis devenait juste, l'étiquette « à chiffrer » disparaissait
    // de l'écran — elle ne s'affiche qu'à montant nul —, et le drapeau restait
    // levé en base. L'envoi refusait alors en nommant les lignes qu'il venait
    // de chiffrer, et le renvoyait vers un écran où tout paraissait normal.
    //
    // Aucun contrôle ne le voyait : celui du dessus passe par l'autre chemin.
    // ═══════════════════════════════════════════════════════════════════════
    const l = await lignesPrixRepo.ajouterLignePrix(A, chantier.id, "Tonte de la pelouse", "0.00", {
      aChiffrer: true,
    });
    await lignesPrixRepo.modifierLignePrix(A, l.id, {
      libelle: "Tonte de la pelouse",
      quantite: "2",
      prixUnitaire: "150.00",
    });
    const [relue] = (await lignesPrixRepo.listerLignesPrix(A, chantier.id)).filter((x) => x.id === l.id);
    assert.equal(relue.montant, "300.00", "le montant calculé n'est pas celui du détail");
    assert.equal(
      relue.aChiffrer,
      false,
      "le devis reste bloqué alors qu'il a fait exactement ce qu'on lui demandait"
    );
  });

  await test("un montant qui retombe à zéro ne RELÈVE pas le drapeau", async () => {
    // L'extinction est à sens unique, et c'est délibéré : « à chiffrer » dit
    // que le prix n'a pas été trouvé, pas que la ligne vaut zéro. Le rallumer
    // ferait d'une remise gratuite délibérée un devis impossible à envoyer.
    const l = await lignesPrixRepo.ajouterLignePrix(A, chantier.id, "Geste commercial", "80.00");
    await lignesPrixRepo.modifierLignePrix(A, l.id, { montant: "0.00" });
    const [relue] = (await lignesPrixRepo.listerLignesPrix(A, chantier.id)).filter((x) => x.id === l.id);
    assert.equal(relue.aChiffrer, false, "une ligne volontairement gratuite bloque le devis");
  });

  console.log(`\n${passed} test(s) réussi(s), ${failed} échoué(s).`);
  await pool.end();
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
