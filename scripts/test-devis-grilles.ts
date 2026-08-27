import assert from "node:assert";
import { pool } from "../src/server/db/client";
import * as entreprisesRepo from "../src/server/repositories/entreprises";
import * as chantiersRepo from "../src/server/repositories/chantiers";
import * as prestationsRepo from "../src/server/repositories/prestations";
import * as tarifsRepo from "../src/server/repositories/tarifs";
import * as lignesPrixRepo from "../src/server/repositories/lignes-prix";
import * as brouillonsRepo from "../src/server/repositories/brouillons-informations";
import { enregistrerPrecisions } from "../src/server/repositories/precisions-chantier";
import { poserPrixGrille, lireGrillePrix, prixConnusDe } from "../src/server/repositories/grille-prix";
import { preparerPropositionPrix } from "../src/server/chiffrage/proposition-prix";
import { appliquerPropositionPrix } from "../src/server/chiffrage/appliquer-proposition";
import { apprendrePrixGrille } from "../src/server/services/apprendre-grille";
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
// (`test-lignes-vendables.ts`, `test-grille-prix.ts`). Ce que CETTE suite
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
    // **« À chiffrer », plus « 0 € » — décision du 27 août 2026 (§10 du brief).**
    // Un zéro se lit « gratuit » sur un devis : c'est un montant, donc une
    // décision, là où il n'y a qu'une case de grille vide. La règle métier n'a
    // pas bougé — aucun prix n'est inventé —, seule sa REPRÉSENTATION change.
    assert.equal(p!.lignes[1].montant, null, "un prix a été inventé pour la fente");
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
    await poserPrixGrille(A, "fendage", "h15|d40", "250", "saisi");
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
    // `null` = à chiffrer, et non plus « 0 € » : voir plus haut.
    assert.equal(p!.lignes[1].montant, null, "un prix a été deviné depuis une case voisine");
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
    await lignesPrixRepo.ajouterLignePrix(A, chantier.id, p!.lignes[0].libelle, p!.lignes[0].montant ?? "0");

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
    await apprendrePrixGrille(B, chantier.id, { libelle: "Fendage du bois", montant: "310.00" });

    const grille = await prixConnusDe(B, "fendage");
    assert.equal(grille.get("h15|d60"), "310.00", `case attendue h15|d60, grille : ${[...grille.keys()].join(", ")}`);
  });

  await test("Un zéro n'est pas une décision : il ne remplit aucune case", async () => {
    const chantier = await chantierDuChene(B, "Chêne à zéro", { diametreCm: "25" });
    await apprendrePrixGrille(B, chantier.id, { libelle: "Fendage du bois", montant: "0" });
    const grille = await prixConnusDe(B, "fendage");
    assert.equal(grille.get("h15|d20"), undefined, "« 0 € » se proposerait plus tard avec l'autorité de sa grille");
  });

  await test("Une observation n'écrase pas un prix qu'il a posé lui-même", async () => {
    await poserPrixGrille(B, "fendage", "h15|d0", "199", "saisi");
    const chantier = await chantierDuChene(B, "Chêne fin", { diametreCm: "15" });
    await apprendrePrixGrille(B, chantier.id, { libelle: "Fendage du bois", montant: "77.00" });
    const grille = await prixConnusDe(B, "fendage");
    assert.equal(grille.get("h15|d0"), "199.00", "un devis a réécrit dans son dos une décision explicite");
  });

  await test("Une ligne qui n'est pas une fente n'apprend rien", async () => {
    const chantier = await chantierDuChene(B, "Chêne abattu", { diametreCm: "35" });
    await apprendrePrixGrille(B, chantier.id, { libelle: "Abattage d'un chêne mort", montant: "900.00" });
    const grille = await prixConnusDe(B, "fendage");
    assert.equal(grille.get("h15|d30"), undefined, "un prix d'abattage s'est rangé dans la grille de fendage");
  });

  // === 5. Isolation : ses prix ne partent pas chez le voisin ===============

  await test("La grille de A reste invisible à B", async () => {
    const casesB = await lireGrillePrix(B);
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
    // `null` = à chiffrer, et non plus « 0 € » : voir plus haut.
    assert.equal(p!.lignes[1].montant, null, "le prix de fendage de A a servi à chiffrer un devis de B");
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
      await poserPrixGrille(B, "fendage", "h0|d0", saisi, "saisi");
      const grille = await prixConnusDe(B, "fendage");
      assert.equal(grille.get("h0|d0"), attendu, `« ${saisi} » n'a pas été compris`);
    }
    // Et ce qui n'est pas un prix efface bien la case.
    for (const saisi of ["", "   ", "gratuit", "-50"]) {
      await poserPrixGrille(B, "fendage", "h0|d0", "300", "saisi");
      await poserPrixGrille(B, "fendage", "h0|d0", saisi, "saisi");
      const grille = await prixConnusDe(B, "fendage");
      assert.equal(grille.get("h0|d0"), undefined, `« ${saisi} » aurait dû rendre la case à la question`);
    }
  });

  // === 6. Son devis du 5 août, tel qu'il l'a écrit lui-même ===============
  //
  // **Trois lignes, trois grilles** — haie 350 €, abattage 600 €, fendage
  // 300 €. C'est sa réponse du 8 août au soir à deux questions : la haie prend
  // sa ligne avec un prix au mètre linéaire, l'abattage a sa grille à la
  // technique × le diamètre.
  //
  // Ce que ces cas tiennent, et qu'aucune règle pure ne peut tenir : que le
  // chantier bascule du chiffrage AU TEMPS au chiffrage AU POSTE dès que la
  // grille connaît le travail principal.

  await test("Son devis du 5 août : trois lignes, chacune à SON prix de grille", async () => {
    const ctx = { ...A };
    // Ses prix, tels qu'il les a donnés le 5 août.
    await poserPrixGrille(ctx, "haie", "ml", "17.50", "saisi");
    await poserPrixGrille(ctx, "abattage", "au_pied|d60", "600", "saisi");
    await poserPrixGrille(ctx, "fendage", "h15|d60", "300", "saisi");

    const chantier = await chantiersRepo.creerChantier(ctx, { nom: "Devis du 5 août" });
    const contenu = {
      ...brouillonVide(),
      prestations: [
        { libelle: "Taille de haie de laurier", description: null, quantite: "20", unite: "ml", aConfirmer: false },
        { libelle: "Abattage d'un chêne mort", description: "20 mètres de haut", quantite: "1", unite: "u", aConfirmer: false },
        { libelle: "Coupe en 50 cm", description: null, quantite: null, unite: null, aConfirmer: false },
        { libelle: "Fendage du bois", description: null, quantite: null, unite: null, aConfirmer: false },
      ],
    };
    for (const p of contenu.prestations) await prestationsRepo.ajouterPrestation(ctx, chantier.id, p.libelle);
    await brouillonsRepo.enregistrerGeneration(ctx, chantier.id, contenu, "dictée");
    await brouillonsRepo.marquerConfirme(ctx, chantier.id);
    await chantiersRepo.mettreAJourDureeEquipe(ctx, chantier.id, { dureePrevue: "1 jour", tailleEquipe: "2 hommes" });
    await enregistrerPrecisions(ctx, chantier.id, [
      { sujet: "abattage.technique#1", libellePrestation: "Abattage d'un chêne mort", valeur: "au_pied", lisible: "abattage au pied" },
      { sujet: "abattage.diametre#1", libellePrestation: "Abattage d'un chêne mort", valeur: "65", lisible: "⌀ 65 cm" },
    ]);

    const p = await preparerPropositionPrix(ctx, chantier.id);
    assert.ok(p);
    assert.equal(p!.lignes.length, 3, `${p!.lignes.length} ligne(s) : ${p!.lignes.map((l) => l.libelle).join(" || ")}`);

    const parLibelle = new Map(p!.lignes.map((l) => [l.libelle, l.montant]));
    const haie = [...parLibelle].find(([lib]) => /haie/i.test(lib));
    const abattage = [...parLibelle].find(([lib]) => /Abattage/.test(lib));
    const fente = [...parLibelle].find(([lib]) => /Fendage/.test(lib));

    assert.equal(haie?.[1], "350.00", "20 ml × 17,50 € = 350 € — le prix au mètre n'a pas été appliqué");
    assert.equal(abattage?.[1], "600.00", "la grille d'abattage (au pied, ⌀ 65) n'a pas donné 600 €");
    assert.equal(fente?.[1], "300.00", "la grille de fendage n'a pas donné 300 €");
    assert.equal(p!.prixPropose, "1250", `total attendu 1 250 €, vu ${p!.prixPropose}`);
    assert.ok(
      p!.explication.calcul.some((c) => /poste par poste/i.test(c.libelle)),
      "le passage au chiffrage par poste n'est pas expliqué : le patron verrait le total changer sans raison"
    );
  });

  await test("Sans grille d'abattage, le tarif à la journée reprend la main — en silence", async () => {
    // Le comportement d'hier doit rester intact quand la grille est vide : ce
    // n'est pas un manque à signaler, c'est le fonctionnement normal.
    const chantier = await chantierDuChene(B, "Chêne sans grille abattage", { diametreCm: "45" });
    const p = await preparerPropositionPrix(B, chantier.id);
    assert.equal(p!.prixPropose, "1100", "le tarif au jour/homme ne s'applique plus");
    assert.ok(
      !p!.explication.donneesManquantes.some((d) => /grille de abattage/i.test(d)),
      "l'absence de grille d'abattage est présentée comme un manque, alors que c'est le cas normal"
    );
  });

  await test("Un prix d'abattage écrit sur un devis se range dans SA grille", async () => {
    const chantier = await chantiersRepo.creerChantier(B, { nom: "Abattage appris" });
    await prestationsRepo.ajouterPrestation(B, chantier.id, "Abattage d'un tilleul");
    await enregistrerPrecisions(B, chantier.id, [
      { sujet: "abattage.technique#0", libellePrestation: "Abattage d'un tilleul", valeur: "demontage", lisible: "démontage" },
      { sujet: "abattage.diametre#0", libellePrestation: "Abattage d'un tilleul", valeur: "55", lisible: "⌀ 55 cm" },
    ]);
    await apprendrePrixGrille(B, chantier.id, { libelle: "Abattage d'un tilleul", montant: "1000.00" });
    assert.equal((await prixConnusDe(B, "abattage")).get("demontage|d50"), "1000.00");
    // Et il ne s'est pas rangé dans la grille de fendage.
    assert.equal((await prixConnusDe(B, "fendage")).get("demontage|d50"), undefined);
  });

  await test("Un prix de haie se range AU MÈTRE, pas au montant de la ligne", async () => {
    // **Le piège qui aurait coûté cher.** Écrire 350 € dans sa case ferait
    // facturer 350 € la prochaine haie, quelle que soit sa longueur.
    const chantier = await chantiersRepo.creerChantier(B, { nom: "Haie apprise" });
    await prestationsRepo.ajouterPrestation(B, chantier.id, "Taille de haie de laurier, 20 ml");
    await apprendrePrixGrille(B, chantier.id, { libelle: "Taille de haie de laurier, 20 ml", montant: "350.00" });
    assert.equal((await prixConnusDe(B, "haie")).get("ml"), "17.50");
  });

  await test("Sans longueur, une haie n'apprend rien plutôt qu'un prix faux", async () => {
    const chantier = await chantiersRepo.creerChantier(A, { nom: "Haie sans longueur" });
    await prestationsRepo.ajouterPrestation(A, chantier.id, "Taille de haie");
    const avant = (await prixConnusDe(A, "haie")).get("ml");
    await apprendrePrixGrille(A, chantier.id, { libelle: "Taille de haie", montant: "480.00" });
    assert.equal((await prixConnusDe(A, "haie")).get("ml"), avant, "un prix au mètre a été inventé depuis un total");
  });

  await test("Un prix de grumes se range À LA TONNE, pas au montant de la ligne", async () => {
    // **Sa réponse du 9 août 2026 :** *« à la tonne. »* Le piège est le même que
    // celui de la haie, en plus coûteux : écrire 900 € dans la case ferait
    // facturer 900 € LA TONNE au chantier suivant.
    const chantier = await chantiersRepo.creerChantier(B, { nom: "Grumes apprises" });
    await prestationsRepo.ajouterPrestation(B, chantier.id, "Enlèvement des grumes, 6 tonnes");
    await apprendrePrixGrille(B, chantier.id, {
      libelle: "Enlèvement des grumes, 6 tonnes",
      montant: "900.00",
    });
    assert.equal((await prixConnusDe(B, "grumes")).get("tonne"), "150.00");
  });

  await test("Sans tonnage, les grumes n'apprennent rien plutôt qu'un prix faux", async () => {
    const chantier = await chantiersRepo.creerChantier(A, { nom: "Grumes sans poids" });
    await prestationsRepo.ajouterPrestation(A, chantier.id, "Enlèvement des grumes");
    const avant = (await prixConnusDe(A, "grumes")).get("tonne");
    await apprendrePrixGrille(A, chantier.id, { libelle: "Enlèvement des grumes", montant: "900.00" });
    assert.equal(
      (await prixConnusDe(A, "grumes")).get("tonne"),
      avant,
      "un prix à la tonne a été inventé depuis un total"
    );
  });

  await test("Le prix des grumes se multiplie par le tonnage du chantier", async () => {
    // Le pendant du rangement : ce qui a été appris à la tonne doit ressortir
    // multiplié. Une case remplie qui ne s'applique pas vaut une case vide.
    const chantier = await chantiersRepo.creerChantier(A, { nom: "Grumes chiffrées" });
    await poserPrixGrille(A, "grumes", "tonne", "150.00", "saisi");
    await prestationsRepo.ajouterPrestation(A, chantier.id, "Abattage d'un chêne mort");
    await prestationsRepo.ajouterPrestation(A, chantier.id, "Enlèvement des grumes, 4 tonnes");
    await brouillonsRepo.enregistrerGeneration(
      A,
      chantier.id,
      {
        ...brouillonVide(),
        prestations: [
          { libelle: "Abattage d'un chêne mort", description: null, quantite: null, unite: null, aConfirmer: false },
          // Le tonnage arrive dans la DESCRIPTION, comme la hauteur de l'arbre :
          // la table `prestations` ne garde qu'un libellé, et c'est le brouillon
          // confirmé qui porte le reste.
          { libelle: "Enlèvement des grumes", description: "4 tonnes", quantite: "4", unite: "t", aConfirmer: false },
        ],
      },
      "dictée"
    );
    await brouillonsRepo.marquerConfirme(A, chantier.id);
    await chantiersRepo.mettreAJourDureeEquipe(A, chantier.id, {
      dureePrevue: "1 jour",
      tailleEquipe: "2 hommes",
    });

    const p = await preparerPropositionPrix(A, chantier.id);
    assert.ok(p);
    const grumes = p.lignes.find((l) => /grume/i.test(l.libelle));
    assert.ok(grumes, `aucune ligne de grumes : ${p.lignes.map((l) => l.libelle).join(" | ")}`);
    assert.equal(grumes.montant, "600.00", "4 t × 150 € = 600 € — le prix à la tonne n'a pas été appliqué");
  });

  await test("Une clé de case inventée n'écrit rien", async () => {
    await poserPrixGrille(B, "fendage", "h99|d99", "500", "saisi");
    await poserPrixGrille(B, "fendage", "'; DROP TABLE grille_prix; --", "500", "saisi");
    const grille = await prixConnusDe(B, "fendage");
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
