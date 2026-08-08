import assert from "node:assert";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as prestationsRepo from "../src/server/repositories/prestations";
import * as tarifsRepo from "../src/server/repositories/tarifs";
import * as lignesPrixRepo from "../src/server/repositories/lignes-prix";
import * as brouillonsRepo from "../src/server/repositories/brouillons-informations";
import { enregistrerPrecisions } from "../src/server/repositories/precisions-chantier";
import { poserPrixFendage, lireGrilleFendage, prixConnusDuFendage } from "../src/server/repositories/grille-fendage";
import { preparerPropositionPrix } from "../src/server/chiffrage/proposition-prix";
import { appliquerPropositionPrix } from "../src/server/chiffrage/appliquer-proposition";
import { apprendrePrixFendage } from "../src/server/services/apprendre-fendage";
import { brouillonVide } from "../src/server/ai/schemas/extraction";
import { nettoyerBase } from "./_test-db";

// **Le devis du 7 août 2026, tel qu'il aurait dû sortir.**
//
// Ce que le patron a lu ce jour-là : une seule ligne, tous ses travaux collés
// par des points-virgules, et 858,00 € dont il ne comprenait pas l'origine.
// Ce qu'il a demandé, en trois messages :
//
//   - *« L'abattage, le broyage et l'évacuation, c'est sur une ligne, et la
//     fente, ça doit être séparé. »*
//   - *« À chaque fois qu'il sépare les tâches, il met un point-virgule. Il faut
//     le retirer. »*
//   - *« Pour la fente, ils devraient demander la hauteur de l'arbre et son
//     diamètre, et on crée une liste de prix en fonction de la hauteur et du
//     diamètre, comme ça il n'invente rien. »*
//
// Les règles de découpage et de tranches sont éprouvées à part, sans base
// (`test-lignes-vendables.ts`, `test-grille-fendage.ts`). Ce que CETTE suite
// tient, et qu'elles ne peuvent pas tenir : **que le chemin complet les
// emprunte réellement** — depuis le tarif de l'entreprise jusqu'aux lignes
// écrites au détail, en passant par la grille, ses réponses à l'arrêt, et
// l'isolation entre deux artisans.

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

/** Sa dictée du 7 août, telle qu'un modèle la lit — la hauteur dans la description. */
function dicteeDuChene() {
  return {
    ...brouillonVide(),
    prestations: [
      {
        libelle: "Abattage d'un chêne mort",
        description: "20 mètres de haut",
        quantite: "1",
        unite: "u",
        aConfirmer: false,
      },
      { libelle: "Broyage des branches", description: null, quantite: null, unite: null, aConfirmer: false },
      { libelle: "Évacuation du gros bois", description: null, quantite: null, unite: null, aConfirmer: false },
      { libelle: "Coupe en 50 cm", description: null, quantite: null, unite: null, aConfirmer: false },
      { libelle: "Fendage du bois", description: null, quantite: null, unite: null, aConfirmer: false },
    ],
  };
}

/** Un chantier prêt à chiffrer : la dictée confirmée, la durée, l'équipe, le diamètre répondu. */
async function chantierDuChene(
  ctx: { entrepriseId: string; utilisateurId: string },
  nom: string,
  options: { diametreCm?: string } = {}
) {
  const chantier = await chantiersRepo.creerChantier(ctx, { nom });
  const contenu = dicteeDuChene();
  for (const p of contenu.prestations) {
    await prestationsRepo.ajouterPrestation(ctx, chantier.id, p.libelle);
  }
  await brouillonsRepo.enregistrerGeneration(ctx, chantier.id, contenu, "dictée");
  await brouillonsRepo.marquerConfirme(ctx, chantier.id);
  await chantiersRepo.mettreAJourDureeEquipe(ctx, chantier.id, {
    dureePrevue: "1 jour",
    tailleEquipe: "2 hommes",
  });
  if (options.diametreCm) {
    // Exactement ce que l'arrêt d'avant-chiffrage enregistre quand il répond.
    await enregistrerPrecisions(ctx, chantier.id, [
      {
        sujet: "abattage.diametre#0",
        libellePrestation: "Abattage d'un chêne mort",
        valeur: options.diametreCm,
        lisible: `⌀ ${options.diametreCm} cm`,
      },
    ]);
  }
  return chantier;
}

async function main() {
  await nettoyerBase();

  const { entreprise: entA, utilisateurId: userA } = await entreprisesRepo.creerEntreprise(
    { nom: "Élagage A" },
    { email: "fendage-a@test.local", nom: "A" }
  );
  const A = { entrepriseId: entA.id, utilisateurId: userA };
  const { entreprise: entB, utilisateurId: userB } = await entreprisesRepo.creerEntreprise(
    { nom: "Élagage B" },
    { email: "fendage-b@test.local", nom: "B" }
  );
  const B = { entrepriseId: entB.id, utilisateurId: userB };

  // Son tarif réel : la main d'œuvre au jour/homme. 1 jour × 2 hommes × 550 €
  // = 1 100 € — un montant déjà rond, pour que l'arrondi ne masque rien ici.
  await tarifsRepo.creerTarif(A, { intitule: "Main d'œuvre", prix: "550.00", unite: "jour/homme" });
  await tarifsRepo.creerTarif(B, { intitule: "Main d'œuvre", prix: "550.00", unite: "jour/homme" });

  // === 1. Le découpage, sur le chemin complet =============================

  await test("Le devis compte DEUX lignes : le chantier, et la fente à part", async () => {
    const chantier = await chantierDuChene(A, "Chêne sans grille", { diametreCm: "45" });
    const p = await preparerPropositionPrix(A, chantier.id);
    assert.ok(p);
    assert.equal(
      p!.lignes.length,
      2,
      `${p!.lignes.length} ligne(s) : ${p!.lignes.map((l) => l.libelle).join(" || ")}`
    );
    assert.match(p!.lignes[0].libelle, /Abattage/);
    assert.match(p!.lignes[0].libelle, /Broyage/);
    assert.match(p!.lignes[0].libelle, /Évacuation/);
    assert.match(p!.lignes[1].libelle, /Fendage/);
  });

  await test("Aucun point-virgule sur le devis, et le billonnage n'y figure pas", async () => {
    const chantier = await chantierDuChene(A, "Chêne ponctuation", { diametreCm: "45" });
    const p = await preparerPropositionPrix(A, chantier.id);
    const texte = p!.lignes.map((l) => l.libelle).join("\n");
    assert.ok(!texte.includes(";"), `un point-virgule subsiste : « ${texte.replace(/\n/g, " / ")} »`);
    assert.ok(!/coupe en 50/i.test(texte), "le billonnage a fait sa propre ligne : le devis en compte une de trop");
    assert.ok(
      p!.explication.calcul.some((c) => /Compris dans l'abattage/.test(c.libelle)),
      "le billonnage disparaît sans un mot : c'est ainsi qu'il a perdu « on le coupe en 50 »"
    );
  });

  // === 2. La grille : vide, elle demande ; pleine, elle chiffre ============

  await test("Grille vide : la fente est là, sans prix, et la raison est dite", async () => {
    const chantier = await chantierDuChene(A, "Chêne grille vide", { diametreCm: "45" });
    const p = await preparerPropositionPrix(A, chantier.id);
    assert.equal(p!.lignes[1].montant, "0", "un prix a été inventé pour la fente");
    assert.equal(p!.prixPropose, "1100", "1 jour × 2 hommes × 550 € — le total ne doit pas bouger");
    const manquantes = p!.explication.donneesManquantes.join(" | ");
    assert.match(
      manquantes,
      /grille de fendage n'a pas de prix pour 15 à 20 m de haut · tronc de 40 à 50 cm/,
      `la case manquante n'est pas nommée : ${manquantes}`
    );
  });

  await test("Grille remplie : le prix de la fente en sort, et le reste est allégé d'autant", async () => {
    // La case du chêne : 20 m de haut (tranche « 15 à 20 m »), ⌀ 45 (« 40 à 50 »).
    await poserPrixFendage(A, "h15|d40", "250", "saisi");
    const chantier = await chantierDuChene(A, "Chêne grille pleine", { diametreCm: "45" });
    const p = await preparerPropositionPrix(A, chantier.id);

    assert.equal(p!.lignes[1].montant, "250.00", "la fente n'a pas pris le prix de la grille");
    assert.equal(
      p!.lignes[0].montant,
      "850",
      "sa règle : 850 + 250, pas 1 000 + 100 — la ligne détachable porte son propre déplacement"
    );
    assert.equal(p!.prixPropose, "1100", "le total a bougé : ce n'est pas une répartition, c'est un autre prix");
    assert.ok(
      p!.explication.calcul.some((c) => /votre grille, case/.test(c.detail)),
      "d'où vient ce 250 € n'est pas dit"
    );
  });

  await test("Le prix ne sort JAMAIS d'une case voisine", async () => {
    // Sa grille connaît « 15 à 20 m × 40 à 50 cm ». Un arbre de 8 m et 25 cm
    // n'a rien à voir : deviner son prix depuis la case connue le présenterait
    // avec l'autorité d'une décision qu'il n'a jamais prise.
    const chantier = await chantiersRepo.creerChantier(A, { nom: "Petit arbre" });
    const contenu = {
      ...brouillonVide(),
      prestations: [
        { libelle: "Abattage d'un bouleau", description: "8 mètres de haut", quantite: "1", unite: "u", aConfirmer: false },
        { libelle: "Fendage du bois", description: null, quantite: null, unite: null, aConfirmer: false },
      ],
    };
    for (const p of contenu.prestations) await prestationsRepo.ajouterPrestation(A, chantier.id, p.libelle);
    await brouillonsRepo.enregistrerGeneration(A, chantier.id, contenu, "dictée");
    await brouillonsRepo.marquerConfirme(A, chantier.id);
    await chantiersRepo.mettreAJourDureeEquipe(A, chantier.id, { dureePrevue: "1 jour", tailleEquipe: "2 hommes" });
    await enregistrerPrecisions(A, chantier.id, [
      { sujet: "abattage.diametre#0", libellePrestation: "Abattage d'un bouleau", valeur: "25", lisible: "⌀ 25 cm" },
    ]);

    const p = await preparerPropositionPrix(A, chantier.id);
    assert.equal(p!.lignes[1].montant, "0", "un prix a été deviné depuis une case voisine");
  });

  await test("Sans hauteur ni diamètre, on dit ce qui manque — on ne devine pas", async () => {
    const chantier = await chantiersRepo.creerChantier(A, { nom: "Fente sans mesures" });
    const contenu = {
      ...brouillonVide(),
      prestations: [
        { libelle: "Abattage d'un frêne", description: null, quantite: null, unite: null, aConfirmer: false },
        { libelle: "Fendage du bois", description: null, quantite: null, unite: null, aConfirmer: false },
      ],
    };
    for (const p of contenu.prestations) await prestationsRepo.ajouterPrestation(A, chantier.id, p.libelle);
    await brouillonsRepo.enregistrerGeneration(A, chantier.id, contenu, "dictée");
    await brouillonsRepo.marquerConfirme(A, chantier.id);
    await chantiersRepo.mettreAJourDureeEquipe(A, chantier.id, { dureePrevue: "1 jour", tailleEquipe: "2 hommes" });

    const p = await preparerPropositionPrix(A, chantier.id);
    const manquantes = p!.explication.donneesManquantes.join(" | ");
    assert.match(manquantes, /la hauteur de l'arbre et le diamètre du tronc/, manquantes);
  });

  // === 3. Les lignes sont réellement écrites au détail =====================

  await test("Les deux lignes arrivent au détail, avec leurs montants", async () => {
    const chantier = await chantierDuChene(A, "Chêne appliqué", { diametreCm: "45" });
    const r = await appliquerPropositionPrix(A, chantier.id);
    assert.ok(r.succes, `l'application a échoué : ${!r.succes ? r.erreur : ""}`);
    assert.equal(r.lignes.length, 2, "une seule ligne écrite : la fente s'est perdue en route");

    const detail = await lignesPrixRepo.listerLignesPrix(A, chantier.id);
    assert.equal(detail.length, 2);
    const total = detail.reduce((s, l) => s + Number(l.montant), 0);
    assert.equal(total, 1100, `total au détail : ${total} €`);
  });

  await test("Rejouer l'enchaînement ne double pas le devis", async () => {
    // Le défaut du 3 août, sur un chemin qui compte désormais deux lignes.
    const chantier = await chantierDuChene(A, "Chêne rejoué", { diametreCm: "45" });
    await appliquerPropositionPrix(A, chantier.id);
    await appliquerPropositionPrix(A, chantier.id);
    const detail = await lignesPrixRepo.listerLignesPrix(A, chantier.id);
    assert.equal(detail.length, 2, `${detail.length} lignes au détail : le devis a doublé`);
  });

  await test("Une ligne manquante se rattrape sans que l'autre se duplique", async () => {
    // Le cas mixte, invisible avec un contrôle de doublon global : la ligne
    // principale est déjà au détail, la fente pas encore.
    const chantier = await chantierDuChene(A, "Chêne mixte", { diametreCm: "45" });
    const p = await preparerPropositionPrix(A, chantier.id);
    await lignesPrixRepo.ajouterLignePrix(A, chantier.id, p!.lignes[0].libelle, p!.lignes[0].montant);

    const r = await appliquerPropositionPrix(A, chantier.id);
    assert.ok(r.succes, "la fente n'a pas pu être rattrapée");
    assert.equal(r.lignes.length, 1, "la ligne principale a été réécrite");
    const detail = await lignesPrixRepo.listerLignesPrix(A, chantier.id);
    assert.equal(detail.length, 2);
  });

  // === 4. La grille se remplit toute seule =================================

  await test("Un prix de fente écrit sur un devis se range dans la bonne case", async () => {
    // *« Le mieux, c'est que je fasse plein de devis et que tu enregistres
    // toutes mes modifications, et dans un mois tu sauras les remplir tout
    // seul. »* — le 7 août 2026.
    const chantier = await chantierDuChene(B, "Chêne apprenant", { diametreCm: "65" });
    await apprendrePrixFendage(B, chantier.id, { libelle: "Fendage du bois", montant: "310.00" });

    const grille = await prixConnusDuFendage(B);
    assert.equal(grille.get("h15|d60"), "310.00", `case attendue h15|d60, grille : ${[...grille.keys()].join(", ")}`);
  });

  await test("Un zéro n'est pas une décision : il ne remplit aucune case", async () => {
    const chantier = await chantierDuChene(B, "Chêne à zéro", { diametreCm: "25" });
    await apprendrePrixFendage(B, chantier.id, { libelle: "Fendage du bois", montant: "0" });
    const grille = await prixConnusDuFendage(B);
    assert.equal(grille.get("h15|d20"), undefined, "« 0 € » se proposerait plus tard avec l'autorité de sa grille");
  });

  await test("Une observation n'écrase pas un prix qu'il a posé lui-même", async () => {
    await poserPrixFendage(B, "h15|d0", "199", "saisi");
    const chantier = await chantierDuChene(B, "Chêne fin", { diametreCm: "15" });
    await apprendrePrixFendage(B, chantier.id, { libelle: "Fendage du bois", montant: "77.00" });
    const grille = await prixConnusDuFendage(B);
    assert.equal(grille.get("h15|d0"), "199.00", "un devis a réécrit dans son dos une décision explicite");
  });

  await test("Une ligne qui n'est pas une fente n'apprend rien", async () => {
    const chantier = await chantierDuChene(B, "Chêne abattu", { diametreCm: "35" });
    await apprendrePrixFendage(B, chantier.id, { libelle: "Abattage d'un chêne mort", montant: "900.00" });
    const grille = await prixConnusDuFendage(B);
    assert.equal(grille.get("h15|d30"), undefined, "un prix d'abattage s'est rangé dans la grille de fendage");
  });

  // === 5. Isolation : ses prix ne partent pas chez le voisin ===============

  await test("La grille de A reste invisible à B", async () => {
    const casesB = await lireGrilleFendage(B);
    assert.ok(
      casesB.every((c) => c.cellule.cle !== "h15|d40"),
      "la case posée par A se lit depuis B : ses prix de vente fuiteraient chez ses concurrents"
    );
  });

  await test("Sans le prix de A, le chantier de B chiffre la fente à zéro", async () => {
    // Le contrôle qui prouve que l'isolation n'est pas seulement une lecture
    // filtrée : elle change réellement le devis produit.
    const chantier = await chantierDuChene(B, "Chêne isolé", { diametreCm: "45" });
    const p = await preparerPropositionPrix(B, chantier.id);
    assert.equal(p!.lignes[1].montant, "0", "le prix de fendage de A a servi à chiffrer un devis de B");
  });

  await test("« 1 200 », « 250 € », « 250,50 » : un prix écrit comme on l'écrit", async () => {
    // **Le piège, et il n'aurait fait aucun bruit.** Un montant illisible EFFACE
    // la case — c'est ainsi qu'on revient sur un prix faux. Sans tolérance sur
    // l'espace des milliers, taper « 1 200 » aurait donc supprimé la case au
    // moment même où le patron la remplissait, sans un mot.
    for (const [saisi, attendu] of [
      ["1 200", "1200.00"],
      ["250 €", "250.00"],
      ["250,50", "250.50"],
      ["1 200", "1200.00"],
    ] as const) {
      await poserPrixFendage(B, "h0|d0", saisi, "saisi");
      const grille = await prixConnusDuFendage(B);
      assert.equal(grille.get("h0|d0"), attendu, `« ${saisi} » n'a pas été compris`);
    }
    // Et ce qui n'est pas un prix efface bien la case.
    for (const saisi of ["", "   ", "gratuit", "-50"]) {
      await poserPrixFendage(B, "h0|d0", "300", "saisi");
      await poserPrixFendage(B, "h0|d0", saisi, "saisi");
      const grille = await prixConnusDuFendage(B);
      assert.equal(grille.get("h0|d0"), undefined, `« ${saisi} » aurait dû rendre la case à la question`);
    }
  });

  await test("Une clé de case inventée n'écrit rien", async () => {
    await poserPrixFendage(B, "h99|d99", "500", "saisi");
    await poserPrixFendage(B, "'; DROP TABLE grille_fendage; --", "500", "saisi");
    const grille = await prixConnusDuFendage(B);
    assert.equal(grille.get("h99|d99"), undefined);
    assert.ok(grille.size >= 1, "la table a disparu ou s'est vidée");
  });

  console.log(`\n${failed === 0 ? "✅" : "❌"} ${passed} réussi(s), ${failed} échec(s).`);
  await pool.end();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
