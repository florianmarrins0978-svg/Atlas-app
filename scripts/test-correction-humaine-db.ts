import assert from "node:assert/strict";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as prestationsRepo from "../src/server/repositories/prestations";
import * as tarifsRepo from "../src/server/repositories/tarifs";
import * as brouillonsRepo from "../src/server/repositories/brouillons-informations";
import { poserPrixGrille } from "../src/server/repositories/grille-prix";
import { preparerPropositionPrix } from "../src/server/chiffrage/proposition-prix";
import { confirmerBrouillon } from "../src/server/ai/services/brouillon-service";
import { brouillonVide } from "../src/server/ai/schemas/extraction";
import { nettoyerBase } from "./_test-db";

// **Sa correction doit CHANGER LE PRIX. Sinon elle ne sert à rien.**
//
// Sa plainte du 27 août 2026 : *« il ne doit plus être obligé de transformer
// "Haie (800 ml)" en "Haie (80 ml)" pour corriger sa quantité. »*
//
// Le défaut était pire que la plainte. Quand il le FAISAIT, rien ne changeait :
// le chiffrage lisait la colonne — restée à 800 — et le contrat du lot C,
// devant deux sources qui divergent, refusait de calculer quoi que ce soit. Sa
// correction était donc invisible **et** bloquante, et rien à l'écran ne le lui
// disait.
//
// Ce que cette suite tient : sa valeur gagne, elle survit à un rejeu de la
// dictée, et elle produit le bon montant sur la ligne du devis.

let reussites = 0;
let echecs = 0;
async function test(nom: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`✅ ${nom}`);
    reussites++;
  } catch (err) {
    console.error(`❌ ${nom}\n   ${err instanceof Error ? err.message : err}`);
    echecs++;
  }
}

type Ctx = { entrepriseId: string; utilisateurId: string };

/** Le chantier de sa dictée : une haie de 800 ml, à 17,50 € le mètre. */
async function chantierDeLaHaie(ctx: Ctx, nom: string) {
  const chantier = await chantiersRepo.creerChantier(ctx, { nom });
  const prestation = await prestationsRepo.ajouterPrestation(ctx, chantier.id, "Taille de haie (800 ml)", {
    nature: "haie",
    quantite: "800.00",
    unite: "ml",
  });
  await chantiersRepo.mettreAJourDureeEquipe(ctx, chantier.id, {
    dureePrevue: "1 jour",
    tailleEquipe: "2 hommes",
  });
  return { chantier, prestation };
}

async function main() {
  await nettoyerBase();
  const { entreprise, utilisateurId } = await entreprisesRepo.creerEntreprise(
    { nom: "Correction" },
    { email: "correction@test.local", nom: "Le patron" }
  );
  const A: Ctx = { entrepriseId: entreprise.id, utilisateurId };
  await tarifsRepo.creerTarif(A, { intitule: "Main d'œuvre", prix: "420", unite: "jour/homme" });
  await poserPrixGrille(A, "haie", "ml", "17.50", "saisi");

  console.log("\n=== Le prix suit sa correction ===\n");

  await test("800 ml donnent 14 000 € — la mesure dictée fait le prix", async () => {
    const { chantier } = await chantierDeLaHaie(A, "Haie dictée");
    const p = await preparerPropositionPrix(A, chantier.id);
    const haie = p!.lignes.find((l) => /haie/i.test(l.libelle))!;
    assert.equal(haie.montant, "14000.00", `montant : ${haie.montant}`);
    assert.equal(haie.quantite, "800");
  });

  await test("corrigé à 80 ml, le devis dit 1 400 € — et non plus rien du tout", async () => {
    // **Le cœur de sa plainte.** Avant : le libellé disait 80, la colonne 800,
    // et le contrat de contradiction annulait le chiffrage. Le prix ne changeait
    // pas, et aucun message ne disait pourquoi.
    const { chantier, prestation } = await chantierDeLaHaie(A, "Haie corrigée");
    await prestationsRepo.modifierPrestation(A, prestation.id, "Taille de haie (80 ml)");

    const p = await preparerPropositionPrix(A, chantier.id);
    const haie = p!.lignes.find((l) => /haie/i.test(l.libelle))!;
    assert.equal(haie.montant, "1400.00", `montant : ${haie.montant} — sa correction n'a pas été prise`);
    assert.equal(haie.quantite, "80");
  });

  await test("la correction directe fait foi, sans toucher au texte", async () => {
    // Le chemin explicite du §8 : la colonne se corrige seule, et le libellé
    // reste ce qu'il est — un texte pour l'humain.
    const { chantier, prestation } = await chantierDeLaHaie(A, "Haie corrigée en colonne");
    await prestationsRepo.corrigerMesurePrestation(A, prestation.id, { quantite: "50", unite: "ml" });

    const p = await preparerPropositionPrix(A, chantier.id);
    const haie = p!.lignes.find((l) => /haie/i.test(l.libelle))!;
    assert.equal(haie.montant, "875.00", `montant : ${haie.montant}`);
    assert.equal(
      (await prestationsRepo.listerPrestations(A, chantier.id))[0].libelle,
      "Taille de haie (800 ml)",
      "le libellé a été réécrit alors qu'il est un texte pour l'humain"
    );
  });

  await test("une contradiction que PERSONNE n'a validée bloque toujours", async () => {
    // L'autre bord, et il ne bouge pas : le contrat du lot C tient dès que la
    // divergence ne vient pas de lui. Ici la colonne dit 800, le libellé 80, et
    // aucune main n'est passée.
    const chantier = await chantiersRepo.creerChantier(A, { nom: "Haie contradictoire" });
    // Un abattage à côté : sans lui, la haie serait la ligne PRINCIPALE et
    // absorberait légitimement le tarif à la journée — le contrôle passerait
    // pour une raison qui n'a rien à voir avec la contradiction.
    await prestationsRepo.ajouterPrestation(A, chantier.id, "Abattage d'un chêne", { nature: "abattage" });
    await prestationsRepo.ajouterPrestation(A, chantier.id, "Taille de haie (80 ml)", {
      nature: "haie",
      quantite: "800.00",
      unite: "ml",
    });
    await chantiersRepo.mettreAJourDureeEquipe(A, chantier.id, {
      dureePrevue: "1 jour",
      tailleEquipe: "2 hommes",
    });

    const p = await preparerPropositionPrix(A, chantier.id);
    const haie = p!.lignes.find((l) => /haie/i.test(l.libelle))!;
    assert.equal(haie.montant, null, "un prix a été calculé sur une mesure incertaine");
    assert.match(
      p!.explication.donneesManquantes.join(" | "),
      /longueur de haie/i,
      "la contradiction n'est pas dite au patron"
    );
  });

  console.log("\n=== Une extraction ne repasse jamais dessus ===\n");

  await test("rejouer la dictée n'efface pas sa correction", async () => {
    const { chantier, prestation } = await chantierDeLaHaie(A, "Haie rejouée");
    await prestationsRepo.corrigerMesurePrestation(A, prestation.id, { quantite: "80", unite: "ml" });

    // Exactement ce que fait le rejeu : le brouillon redit 800 ml.
    await brouillonsRepo.enregistrerGeneration(
      A,
      chantier.id,
      {
        ...brouillonVide(),
        prestations: [
          {
            libelle: "Taille de haie",
            description: null,
            quantite: "800",
            unite: "ml",
            nature: "haie",
            espece: null,
            aConfirmer: false,
          },
        ],
      },
      "dictée rejouée"
    );
    const r = await confirmerBrouillon(A, chantier.id);
    assert.ok(r.succes, `la confirmation a échoué : ${r.succes ? "" : r.erreur}`);

    const apres = (await prestationsRepo.listerPrestations(A, chantier.id))[0];
    assert.equal(Number(apres.quantite), 80, "l'extraction a écrasé sa correction");
    assert.equal(
      (await prestationsRepo.listerPrestations(A, chantier.id)).length,
      1,
      "le rejeu a créé une seconde prestation pour la même haie"
    );
  });

  console.log("\n=== La nature et l'espèce arrivent de la dictée ===\n");

  await test("« démontage d'un érable » enregistre l'espèce et la nature", async () => {
    const chantier = await chantiersRepo.creerChantier(A, { nom: "Érable" });
    await brouillonsRepo.enregistrerGeneration(
      A,
      chantier.id,
      {
        ...brouillonVide(),
        prestations: [
          {
            libelle: "Démontage d'un érable",
            description: null,
            quantite: null,
            unite: null,
            nature: "abattage",
            espece: "érable",
            aConfirmer: false,
          },
        ],
      },
      "dictée"
    );
    await confirmerBrouillon(A, chantier.id);
    const [p] = await prestationsRepo.listerPrestations(A, chantier.id);
    assert.equal(p.nature, "abattage");
    assert.equal(p.espece, "érable");
  });

  await test("une nature INVENTÉE par le modèle n'entre pas en base", async () => {
    // Le référentiel est une liste fermée : une taxonomie qui dérive à chaque
    // dictée contaminerait le regroupement des lignes du devis.
    const chantier = await chantiersRepo.creerChantier(A, { nom: "Nature inventée" });
    await brouillonsRepo.enregistrerGeneration(
      A,
      chantier.id,
      {
        ...brouillonVide(),
        prestations: [
          {
            libelle: "Pose d'un bassin",
            description: null,
            quantite: null,
            unite: null,
            nature: "amenagement_aquatique",
            espece: null,
            aConfirmer: false,
          },
        ],
      },
      "dictée"
    );
    await confirmerBrouillon(A, chantier.id);
    const [p] = await prestationsRepo.listerPrestations(A, chantier.id);
    assert.equal(p.nature, null, `une nature inventée est entrée en base : ${p.nature}`);
    assert.equal(p.libelle, "Pose d'un bassin", "le travail a disparu");
  });

  console.log("\n=== Deux fois le même travail dicté, deux prestations ===\n");

  await test("« je démonte un érable, puis un autre érable » ne fond pas les deux", async () => {
    // **§5 du brief du 27 août 2026** : deux travaux différents peuvent
    // légitimement porter exactement le même texte. Le dédoublonnage protège du
    // REJEU d'une dictée, pas de ce qu'elle énonce deux fois — sinon l'un des
    // deux arbres ne se facture jamais.
    const chantier = await chantiersRepo.creerChantier(A, { nom: "Deux érables" });
    const ligne = {
      libelle: "Démontage d'un érable",
      description: null,
      quantite: null,
      unite: null,
      nature: "abattage",
      espece: "érable",
      aConfirmer: false,
    };
    await brouillonsRepo.enregistrerGeneration(
      A,
      chantier.id,
      { ...brouillonVide(), prestations: [ligne, { ...ligne }] },
      "dictée"
    );
    await confirmerBrouillon(A, chantier.id);
    assert.equal(
      (await prestationsRepo.listerPrestations(A, chantier.id)).length,
      2,
      "un des deux érables a disparu : il ne sera jamais facturé"
    );
  });

  await test("mais REJOUER la même dictée n'en crée toujours pas un troisième", async () => {
    // L'autre bord, et c'est le défaut du 3 août : un second appui, un retour
    // arrière, et le devis comptait le travail deux fois.
    const chantier = await chantiersRepo.creerChantier(A, { nom: "Érable rejoué" });
    const ligne = {
      libelle: "Démontage d'un érable",
      description: null,
      quantite: null,
      unite: null,
      nature: "abattage",
      espece: "érable",
      aConfirmer: false,
    };
    await brouillonsRepo.enregistrerGeneration(A, chantier.id, { ...brouillonVide(), prestations: [ligne] }, "1");
    await confirmerBrouillon(A, chantier.id);
    await brouillonsRepo.enregistrerGeneration(A, chantier.id, { ...brouillonVide(), prestations: [ligne] }, "2");
    await confirmerBrouillon(A, chantier.id);
    assert.equal(
      (await prestationsRepo.listerPrestations(A, chantier.id)).length,
      1,
      "le rejeu a doublé la prestation"
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
    await pool.end();
  });
