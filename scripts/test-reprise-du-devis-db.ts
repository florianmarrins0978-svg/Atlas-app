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
  poserLesPartsDeMainDoeuvre,
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
  // Sa main d'œuvre, renommée : seul le drapeau dit encore ce qu'elle est.
  await ajouterLignePrix(A, ancien.id, "Équipe, deux jours", "800.00", {
    quantite: "4",
    prixUnitaire: "200.00",
    unite: "jour/homme",
    mainDoeuvre: true,
  });
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

  // **Trouvé le 6 novembre 2026**, en cherchant pourquoi sa main d'œuvre
  // s'affichait encore sur la fiche travaux : la reprise relisait la ligne
  // sans son drapeau, et la réécrivait sans lui. Le devis repris la montrait
  // à cocher à l'équipe, et la sortait de « dont main d'œuvre HT ».
  await test("la reprise garde le drapeau de la main d'œuvre", async () => {
    const equipe = await ligne("Équipe, deux jours");
    assert.equal(equipe.mainDoeuvre, true, "une main d'œuvre reprise reste une main d'œuvre");
    assert.equal((await ligne("Taille de haie")).mainDoeuvre, false);
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

  // ─── SA DÉCISION DU 6 NOVEMBRE 2026 : la main d'œuvre répartie suit ───
  // (« Taille de haie », plus haut, rapprocherait son propre tarif : un autre
  // travail garde la mesure lisible.) L'an dernier : 25 ml de photinias à 12 €, plus 400 € de main
  // d'œuvre de son équipe répartis dessus (2 jours d'homme à 200 €). Cette
  // année : les photinias à 13 €, le jour par homme à 210 €.
  await test("la main d'œuvre répartie : gardée, puis au tarif du jour sur son oui", async () => {
    const avant = await chantiersRepo.creerChantier(A, { nom: "Haie Julien 2025", clientId: julien.id });
    const haie = await ajouterLignePrix(A, avant.id, "Taille de photinias", "300.00", {
      quantite: "25",
      prixUnitaire: "12.00",
      unite: "ml",
    });
    const pose = await poserLesPartsDeMainDoeuvre(A, avant.id, { [haie.id]: "400.00" }, "200.00");
    assert.ok(pose.ok, "la main d'œuvre ne se pose pas");
    const posee = (await listerLignesPrix(A, avant.id))[0];
    assert.equal(Number(posee.montant), 700);
    assert.equal(Number(posee.joursMainDoeuvre), 2, "les jours d'homme de la part ne sont pas retenus");

    await creerTarif(A, { intitule: "Taille de photinias", prix: "13.00", unite: "ml" });
    await creerTarif(A, { intitule: "Main d'œuvre", prix: "210.00", unite: "jour/homme" });
    const apres = await chantiersRepo.creerChantier(A, { nom: "Haie Julien 2026", clientId: julien.id });
    await reprendreLesLignesPrix(A, avant.id, apres.id);
    const reprise = (await listerLignesPrix(A, apres.id)).find((l) => l.libelle === "Taille de photinias")!;
    assert.equal(Number(reprise.montant), 700, "le devis repris change avant sa réponse");
    assert.equal(Number(reprise.partMainDoeuvre), 400, "« dont main d'œuvre HT » se perd à la reprise");
    assert.equal(Number(reprise.prixAncien), 12, "l'ancien prix doit être celui de la taille seule");
    assert.equal(Number(reprise.prixGrille), 13);
    assert.equal(Number(reprise.partGrille), 420);

    await appliquerLaReprise(A, apres.id, { reponse: "oui" });
    const oui = (await listerLignesPrix(A, apres.id)).find((l) => l.id === reprise.id)!;
    assert.equal(Number(oui.montant), 745);
    assert.equal(Number(oui.partMainDoeuvre), 420);

    await appliquerLaReprise(A, apres.id, { reponse: "non" });
    const non = (await listerLignesPrix(A, apres.id)).find((l) => l.id === reprise.id)!;
    assert.equal(Number(non.montant), 700);
    assert.equal(Number(non.partMainDoeuvre), 400);
  });

  await test("la base refuse une hausse hors borne", async () => {
    await assert.rejects(appliquerLaReprise(A, neuf.id, { hausse: 150 }));
  });

  console.log(`\n${passed} test(s) réussi(s), ${failed} échec(s)`);
  await pool.end();
  if (failed > 0) process.exit(1);
}

main();
