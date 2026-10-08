import assert from "node:assert";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as clientsRepo from "../src/server/repositories/clients";
import { creerTarif } from "../src/server/repositories/tarifs";
import {
  ajouterLignePrix,
  listerLignesPrix,
  modifierLignePrix,
  proposerLaGrilleDuJour,
  reprendreLesLignesPrix,
} from "../src/server/repositories/lignes-prix";
import { appliquerLaReprise } from "../src/server/repositories/reprise-du-devis";
import { nettoyerBase } from "./_test-db";

/**
 * Le devis repris par « Dernier devis », en base, sous le rôle `atlas_app`
 * (migration 0106, ses décisions du 26 septembre 2026).
 *
 * **Ce que cette suite défend, et c'est de l'argent.** La reprise garde les
 * anciens prix et ne pose le tarif du jour que sur son oui ; la hausse se
 * recalcule toujours depuis la base de chaque ligne, sans s'empiler ; un prix
 * tapé à la main sort la ligne de la reprise ; et rien de tout cela ne traverse
 * vers une autre entreprise. La RLS borne, jamais un filtre écrit à la main.
 */

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
    { nom: "Reprise A" },
    { email: "reprise-a@test.local", nom: "A" }
  );
  const A = { entrepriseId: entA.id, utilisateurId: userA };
  const { entreprise: entB, utilisateurId: userB } = await entreprisesRepo.creerEntreprise(
    { nom: "Reprise B" },
    { email: "reprise-b@test.local", nom: "B" }
  );
  const B = { entrepriseId: entB.id, utilisateurId: userB };

  // L'an dernier : la haie à 17,50, l'évacuation à 90, un anti-mousse à la main.
  const julien = await clientsRepo.creerClient(A, { nom: "Julien", canalCommunication: "sms" });
  const ancien = await chantiersRepo.creerChantier(A, { nom: "Jardin Julien 2025", clientId: julien.id });
  await ajouterLignePrix(A, ancien.id, "Taille de haie", "700.00", { quantite: "40", prixUnitaire: "17.50", unite: "ml" });
  await ajouterLignePrix(A, ancien.id, "Évacuation des déchets verts", "90.00");
  await ajouterLignePrix(A, ancien.id, "Traitement anti-mousse", "0.00", { aChiffrer: true });
  // Aujourd'hui, sa grille dit 18,20 pour la haie, et toujours 90 pour l'évacuation.
  await creerTarif(A, { intitule: "Taille de haie", prix: "18.20", unite: "ml" });
  await creerTarif(A, { intitule: "Évacuation des déchets verts", prix: "90.00" });

  const neuf = await chantiersRepo.creerChantier(A, { nom: "Jardin Julien 2026", clientId: julien.id });
  await reprendreLesLignesPrix(A, ancien.id, neuf.id);
  const ligne = async (libelle: string) => (await listerLignesPrix(A, neuf.id)).find((l) => l.libelle === libelle)!;

  await test("la reprise garde l'ancien prix et PROPOSE le tarif du jour", async () => {
    const haie = await ligne("Taille de haie");
    assert.equal(Number(haie.prixUnitaire), 17.5);
    assert.equal(Number(haie.montant), 700);
    assert.equal(Number(haie.prixAncien), 17.5);
    assert.equal(Number(haie.prixGrille), 18.2);
    const evac = await ligne("Évacuation des déchets verts");
    assert.equal(evac.prixGrille, null, "un tarif inchangé n'est pas une proposition");
    const mousse = await ligne("Traitement anti-mousse");
    assert.equal(mousse.prixAncien, null, "une ligne à chiffrer n'a pas d'ancien prix : zéro n'en est pas un");
  });

  await test("« Mettre à jour » pose le tarif du jour, et seulement là où il diffère", async () => {
    const r = await appliquerLaReprise(A, neuf.id, { reponse: "oui" });
    assert.equal(r.reponse, "oui");
    const haie = await ligne("Taille de haie");
    assert.equal(Number(haie.prixUnitaire), 18.2);
    assert.equal(Number(haie.montant), 728);
    assert.equal(Number((await ligne("Évacuation des déchets verts")).prixUnitaire), 90);
  });

  await test("la hausse part du prix choisi, arrondie au centime, et ne s'empile pas", async () => {
    await appliquerLaReprise(A, neuf.id, { hausse: 5 });
    await appliquerLaReprise(A, neuf.id, { hausse: 10 });
    const haie = await ligne("Taille de haie");
    assert.equal(Number(haie.prixUnitaire), 20.02, "18,20 plus 10 % : 20,02, jamais 15,5 % cumulés");
    assert.equal(Number(haie.montant), 800.8);
    assert.equal(Number((await ligne("Évacuation des déchets verts")).prixUnitaire), 99);
    assert.equal(Number((await ligne("Traitement anti-mousse")).prixUnitaire), 0, "une ligne à chiffrer ne monte pas");
  });

  await test("« Garder les anciens » revient aux anciens prix, hausse comprise", async () => {
    await appliquerLaReprise(A, neuf.id, { reponse: "non" });
    assert.equal(Number((await ligne("Taille de haie")).prixUnitaire), 19.25, "17,50 plus 10 %");
  });

  await test("un prix TAPÉ sort la ligne de la reprise ; un prix renvoyé tel quel, non", async () => {
    const evac = await ligne("Évacuation des déchets verts");
    // L'écran renvoie le prix à chaque champ quitté : ce n'est pas une retouche.
    await modifierLignePrix(A, evac.id, { quantite: "2", prixUnitaire: "99" });
    assert.equal(Number((await ligne("Évacuation des déchets verts")).prixAncien), 90);
    await modifierLignePrix(A, evac.id, { quantite: "2", prixUnitaire: "110" });
    const apres = await ligne("Évacuation des déchets verts");
    assert.equal(apres.prixAncien, null);
    await appliquerLaReprise(A, neuf.id, { hausse: 30 });
    assert.equal(Number((await ligne("Évacuation des déchets verts")).prixUnitaire), 110, "la hausse a réécrit son prix");
    assert.equal(Number((await ligne("Taille de haie")).prixUnitaire), 22.75, "17,50 plus 30 %");
  });

  await test("sans hausse, les prix reviennent à leur base", async () => {
    await appliquerLaReprise(A, neuf.id, { hausse: 0 });
    assert.equal(Number((await ligne("Taille de haie")).prixUnitaire), 17.5);
  });

  await test("une autre entreprise ne touche ni au chantier ni à ses lignes", async () => {
    const r = await appliquerLaReprise(B, neuf.id, { reponse: "oui", hausse: 30 });
    assert.equal(r.lignes.length, 0);
    assert.equal(Number((await ligne("Taille de haie")).prixUnitaire), 17.5);
    const chantierVuParA = await chantiersRepo.getChantier(A, neuf.id);
    assert.equal(chantierVuParA?.repriseGrille, "non");
    assert.equal(chantierVuParA?.hausseReprise, null);
  });

  // **Un devis expiré relu à ses prix du jour** — sa demande du 7 octobre 2026 :
  // ses PROPRES lignes deviennent des reprises, la même règle que « Dernier
  // devis », et rien ne change de prix sans son oui.
  await test("relire un devis expiré propose la grille du jour sur ses propres lignes", async () => {
    await proposerLaGrilleDuJour(A, ancien.id);
    const lignesDuChantier = await listerLignesPrix(A, ancien.id);
    const haie = lignesDuChantier.find((l) => l.libelle === "Taille de haie")!;
    assert.equal(Number(haie.prixUnitaire), 17.5, "le prix ne bouge pas avant sa réponse");
    assert.equal(Number(haie.prixAncien), 17.5);
    assert.equal(Number(haie.prixGrille), 18.2);
    const mousse = lignesDuChantier.find((l) => l.libelle === "Traitement anti-mousse")!;
    assert.equal(mousse.prixAncien, null);
    await appliquerLaReprise(A, ancien.id, { reponse: "oui" });
    const apres = (await listerLignesPrix(A, ancien.id)).find((l) => l.libelle === "Taille de haie")!;
    assert.equal(Number(apres.prixUnitaire), 18.2);
  });

  await test("relire un devis expiré ne touche jamais les lignes d'une autre entreprise", async () => {
    await proposerLaGrilleDuJour(B, ancien.id);
    const haie = (await listerLignesPrix(A, ancien.id)).find((l) => l.libelle === "Taille de haie")!;
    assert.equal(Number(haie.prixAncien), 17.5, "rien n'a été réécrit depuis l'autre entreprise");
  });

  await test("la base refuse une hausse hors borne", async () => {
    await assert.rejects(appliquerLaReprise(A, neuf.id, { hausse: 150 }));
  });

  console.log(`\n${passed} test(s) réussi(s), ${failed} échec(s)`);
  await pool.end();
  if (failed > 0) process.exit(1);
}

main();
