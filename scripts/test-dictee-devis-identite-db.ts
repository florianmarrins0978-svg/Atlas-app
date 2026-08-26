import assert from "node:assert/strict";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as prestationsRepo from "../src/server/repositories/prestations";
import * as tarifsRepo from "../src/server/repositories/tarifs";
import * as brouillonsRepo from "../src/server/repositories/brouillons-informations";
import { listerLignesPrix } from "../src/server/repositories/lignes-prix";
import { poserPrixGrille, prixConnusDe } from "../src/server/repositories/grille-prix";
import { preparerPropositionPrix } from "../src/server/chiffrage/proposition-prix";
import { appliquerPropositionPrix } from "../src/server/chiffrage/appliquer-proposition";
import { apprendrePrixGrille } from "../src/server/services/apprendre-grille";
import { brouillonVide, type PropositionExtraction } from "../src/server/ai/schemas/extraction";
import { enregistrerPrecisions } from "../src/server/repositories/precisions-chantier";
import { nettoyerBase } from "./_test-db";

// **Le devis du 26 août 2026, tel qu'il aurait dû sortir.**
//
// Ce que le patron a lu ce jour-là, après avoir dicté depuis son iPhone :
//
//   « Tonte de la pelouse (1200 m²) »          Qté 1   840 € HT
//   « Érable — démontage en rétention »        (même ligne)
//   « Haie (tout genre) (800 ml) »             Qté 1     0 € HT
//
// Trois choses fausses, et aucune n'est un défaut d'affichage : la quantité
// dictée n'existe plus comme donnée, deux travaux sans rapport partagent une
// identité, et une ligne qu'on ne sait pas chiffrer s'écrit « 0 € » — un
// montant, donc une décision, là où il n'y a qu'une ignorance.
//
// Cette suite est écrite AVANT la correction et elle est ROUGE. Elle ne doit
// pas atteindre `main` avant P0–P3 : une batterie rouge cesse d'être lue.
//
// Ce qui est éprouvé sans base vit dans `test-dictee-devis-identite.ts`. Ce que
// CETTE suite tient, et que l'autre ne peut pas tenir : que le chemin complet
// — prestations, grille, tarif, découpage, écriture au détail — porte bien ces
// règles jusqu'à la ligne que le client lira.

let reussites = 0;
let echecs = 0;
async function test(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`✅ ${nom}`);
    reussites++;
  } catch (err) {
    console.error(`❌ ${nom}`);
    console.error(`   ${err instanceof Error ? err.message : err}`);
    echecs++;
  }
}

/** Sa dictée du 26 août, telle qu'un modèle la lit RÉELLEMENT — et il la lit bien. */
function dicteeDu26Aout(): PropositionExtraction {
  return {
    ...brouillonVide(),
    prestations: [
      { libelle: "Tonte de la pelouse", description: null, quantite: "1200", unite: "m²", aConfirmer: false },
      { libelle: "Haie (tout genre)", description: null, quantite: "800", unite: "ml", aConfirmer: false },
      { libelle: "Abattage d'un érable", description: null, quantite: null, unite: null, aConfirmer: false },
    ],
    dureePrevue: "1 jour",
    tailleEquipe: "2 hommes",
  };
}

/**
 * Le chantier tel que la chaîne le laisse — libellés compris.
 *
 * Les libellés passés à `prestations` sont **exactement** ceux que
 * `confirmerBrouillon` écrit (quantité recollée) et que
 * `ecrirePrecisionsSurLesPrestations` enrichit ensuite. On les pose à la main
 * plutôt que d'appeler la chaîne : elle exige une note vocale transcrite, donc
 * une clé, et `CLAUDE.md` §1 ter interdit qu'une suite en dépende.
 */
async function chantierDu26Aout(ctx: { entrepriseId: string; utilisateurId: string }, nom: string) {
  const chantier = await chantiersRepo.creerChantier(ctx, { nom });
  for (const libelle of [
    "Tonte de la pelouse (1200 m²)",
    "Haie (tout genre) (800 ml)",
    "Érable — démontage en rétention",
  ]) {
    await prestationsRepo.ajouterPrestation(ctx, chantier.id, libelle);
  }
  await brouillonsRepo.enregistrerGeneration(ctx, chantier.id, dicteeDu26Aout(), "dictée du 26 août");
  await brouillonsRepo.marquerConfirme(ctx, chantier.id);
  await chantiersRepo.mettreAJourDureeEquipe(ctx, chantier.id, {
    dureePrevue: "1 jour",
    tailleEquipe: "2 hommes",
  });
  return chantier;
}

async function main() {
  await nettoyerBase();

  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise(
    { nom: "Arborea" },
    { email: "dictee-devis@test.local", nom: "Le patron" }
  );
  const A = { entrepriseId: entreprise.id, utilisateurId };

  // Son tarif au jour/homme : c'est lui qui produit les 840 € (2 × 1 × 420).
  await tarifsRepo.creerTarif(A, { intitule: "Main d'œuvre (jour/homme)", prix: "420", unite: "jour/homme" });
  // Et son prix de haie au mètre linéaire.
  await poserPrixGrille(A, "haie", "ml", "17.50", "saisi");

  console.log("\n=== A — la quantité dictée survit jusqu'à la ligne du devis ===\n");

  await test("800 ml de haie donnent une ligne à 800 × 17,50 €, pas 1 × 14 000 €", async () => {
    const chantier = await chantiersRepo.creerChantier(A, { nom: "Haie seule" });
    await prestationsRepo.ajouterPrestation(A, chantier.id, "Haie (tout genre) (800 ml)");
    await brouillonsRepo.enregistrerGeneration(
      A,
      chantier.id,
      {
        ...brouillonVide(),
        prestations: [
          { libelle: "Haie (tout genre)", description: null, quantite: "800", unite: "ml", aConfirmer: false },
        ],
        dureePrevue: "1 jour",
        tailleEquipe: "2 hommes",
      },
      "dictée"
    );
    await brouillonsRepo.marquerConfirme(A, chantier.id);
    await chantiersRepo.mettreAJourDureeEquipe(A, chantier.id, { dureePrevue: "1 jour", tailleEquipe: "2 hommes" });

    await appliquerPropositionPrix(A, chantier.id);
    const [ligne] = await listerLignesPrix(A, chantier.id);
    assert.ok(ligne, "aucune ligne n'a été écrite");

    // Le TOTAL est juste aujourd'hui — c'est sa décomposition qui ment. Le
    // client lit « 1 × 14 000 € » là où l'artisan a dit « 800 mètres à 17,50 ».
    assert.equal(Number(ligne.quantite), 800, `quantité écrite : ${ligne.quantite} — la mesure dictée a disparu`);
    assert.equal(Number(ligne.prixUnitaire), 17.5, `prix unitaire écrit : ${ligne.prixUnitaire}`);
    assert.equal(ligne.unite, "ml", `unité écrite : ${ligne.unite}`);
  });

  console.log("\n=== B — deux travaux dictés ne partagent pas une identité ===\n");

  await test("la tonte et le démontage n'arrivent pas sur la même ligne de devis", async () => {
    const chantier = await chantierDu26Aout(A, "Le chantier du 26 août");
    await appliquerPropositionPrix(A, chantier.id);
    const lignes = await listerLignesPrix(A, chantier.id);

    const melangees = lignes.filter((l) => /tonte/i.test(l.libelle) && /(abatt|démont|demont)/i.test(l.libelle));
    assert.equal(
      melangees.length,
      0,
      "une ligne porte une tonte ET un démontage : " + melangees.map((l) => JSON.stringify(l.libelle)).join(" · ")
    );
  });

  console.log("\n=== C — inconnu n'est ni 0 ni 1 ===\n");

  await test("une ligne qu'on ne sait pas chiffrer ne s'écrit pas « 0 € »", async () => {
    const chantier = await chantierDu26Aout(A, "Prix impossible à répartir");
    // 800 ml × 17,50 = 14 000 €, soit bien plus que les 840 € du chantier :
    // la répartition ne tient pas debout, et aujourd'hui la haie tombe à zéro.
    const proposition = await preparerPropositionPrix(A, chantier.id);
    assert.ok(proposition, "aucune proposition");
    const haie = proposition.lignes.find((l) => /haie/i.test(l.libelle));
    assert.ok(haie, "la ligne de haie a disparu de la proposition");
    assert.notEqual(
      haie.montant,
      "0",
      "la haie est proposée à 0 € : une ignorance présentée comme un montant. " +
        "Sur le devis, un zéro se lit « gratuit », et la raison n'est visible que sur l'écran Prix."
    );
  });

  await test("aucune ligne du détail ne porte une quantité de 1 posée par défaut", async () => {
    const chantier = await chantierDu26Aout(A, "Quantités par défaut");
    await appliquerPropositionPrix(A, chantier.id);
    const lignes = await listerLignesPrix(A, chantier.id);
    const haie = lignes.find((l) => /haie/i.test(l.libelle));
    assert.ok(haie, "la ligne de haie n'a pas été écrite");
    assert.notEqual(
      Number(haie.quantite),
      1,
      "la haie porte Qté 1 alors que la dictée disait 800 ml : le « 1 » n'est pas un forfait, " +
        "c'est une colonne que ce chemin ne renseigne jamais"
    );
  });

  console.log("\n=== D et F — un lot de plusieurs natures n'enseigne rien ===\n");

  await test("un prix posé sur « tonte + démontage » n'entre pas dans la grille d'abattage", async () => {
    const chantier = await chantierDu26Aout(A, "Apprentissage contaminé");

    // **La case doit être CALCULABLE, sinon ce contrôle passe pour une mauvaise
    // raison.** Sans technique ni diamètre, `celluleAbattage` rend `null` et
    // rien n'est écrit — le test serait vert alors que la règle n'est pas
    // tenue. C'est le piège du 15 août 2026 : un contrôle qui mesure zéro ne
    // mesure rien (`CLAUDE.md` §5).
    await enregistrerPrecisions(A, chantier.id, [
      {
        sujet: "abattage.technique#2",
        libellePrestation: "Érable — démontage en rétention",
        valeur: "demontage_retention",
        lisible: "démontage avec rétention",
      },
      {
        sujet: "abattage.diametre#2",
        libellePrestation: "Érable — démontage en rétention",
        valeur: "45",
        lisible: "⌀ 45 cm",
      },
    ]);

    // La preuve que la case EST calculable : la même prestation, seule, enseigne.
    const temoin = await chantiersRepo.creerChantier(A, { nom: "Témoin : la case existe" });
    await prestationsRepo.ajouterPrestation(A, temoin.id, "Érable — démontage en rétention, ⌀ 45 cm");
    await enregistrerPrecisions(A, temoin.id, [
      {
        sujet: "abattage.technique#0",
        libellePrestation: "Érable — démontage en rétention, ⌀ 45 cm",
        valeur: "demontage_retention",
        lisible: "démontage avec rétention",
      },
    ]);
    await apprendrePrixGrille(A, temoin.id, {
      libelle: "Érable — démontage en rétention, ⌀ 45 cm",
      montant: "800.00",
    });
    const temoinGrille = await prixConnusDe(A, "abattage");
    assert.ok(
      temoinGrille.size > 0,
      "la case d'abattage n'est pas calculable dans ce montage : le contrôle qui suit ne prouverait rien"
    );

    // **On compare les VALEURS, pas le nombre de cases.** La première version
    // comparait `.size` : la case existant déjà grâce au témoin, un écrasement
    // de 800 € par 1 500 € laissait la taille inchangée et le contrôle passait
    // au vert sur le défaut exact qu'il devait attraper.
    const avant = [...(await prixConnusDe(A, "abattage")).entries()].sort();

    // Exactement ce que fait l'écran quand il tape un prix sur cette ligne-là.
    await apprendrePrixGrille(A, chantier.id, {
      libelle: "Tonte de la pelouse (1200 m²)\nÉrable — démontage en rétention",
      montant: "1500.00",
    });

    const apres = [...(await prixConnusDe(A, "abattage")).entries()].sort();
    assert.deepEqual(
      apres,
      avant,
      "le prix du lot entier — tonte comprise — a été rangé dans la grille d'abattage : " +
        apres.map(([c, p]) => `${c} = ${p} €`).join(", ") +
        ". Il reviendra seul sur chaque démontage, avec l'autorité de l'expérience."
    );
  });

  await test("un prix posé sur une SEULE prestation continue, lui, d'enseigner", async () => {
    // L'autre sens du contrôle : refuser les lots ne doit pas éteindre
    // l'apprentissage. Sa phrase du 7 août — « dans un mois tu sauras les
    // remplir tout seul » — dépend de ce chemin-là.
    const chantier = await chantiersRepo.creerChantier(A, { nom: "Apprentissage légitime" });
    await prestationsRepo.ajouterPrestation(A, chantier.id, "Taille de haie de laurier (20 ml)");
    await apprendrePrixGrille(A, chantier.id, {
      libelle: "Taille de haie de laurier (20 ml)",
      montant: "350.00",
    });
    assert.equal(
      (await prixConnusDe(A, "haie")).get("ml"),
      "17.50",
      "350 € / 20 ml = 17,50 €/ml : l'apprentissage d'une prestation seule doit rester intact"
    );
  });

  console.log(`\n${reussites} réussite(s), ${echecs} échec(s).`);
  if (echecs > 0) process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    const { pool } = await import("../src/server/db/client");
    await pool.end();
  });
