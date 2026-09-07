import assert from "node:assert/strict";
import Decimal from "decimal.js";
import {
  lignesParCategorie,
  tauxDeLaLigne,
  tauxLisible,
  tauxOuverts,
  totauxAvecReduction,
} from "../src/lib/reduction-devis";

// Plusieurs TVA sur un même devis — que chaque catégorie tombe juste.
//
// **Sa demande du 1er septembre 2026 :** *« sur la page du devis, si j'ai de la
// main d'œuvre TVA à 20 et des plantes TVA à 10, je peux avoir deux TVA
// différentes ? »* — puis, sur la maquette : *« il ne faut pas la rajouter à
// chaque ligne, mais quand j'appuie sur ajouter une TVA une catégorie s'ajoute
// et là je mets toutes mes lignes qui seront en TVA à 10 »*.
//
// **CE QUE CETTE SUITE PROTÈGE, ET C'EST DE L'ARGENT QUI PART EN DÉCLARATION.**
// Un devis se rectifie ; une TVA mal ventilée se retrouve dans un relevé
// trimestriel, et c'est l'artisan qui répond de l'écart. Trois pièges vivent
// ici, et aucun ne se voit à l'œil sur le document :
//
//   1. la remise doit se répartir AU PRORATA — retirée du seul total, elle
//      laisserait chaque catégorie calculer sa TVA sur son brut, donc facturer
//      une TVA sur de l'argent que le client ne verse pas ;
//   2. le centime résiduel de cette répartition ne doit pas disparaître, sinon
//      le total ne vaut plus la soustraction imprimée juste au-dessus ;
//   3. les devis à UN SEUL taux — c'est-à-dire tous ceux déjà émis — doivent
//      sortir au centime près comme avant.

let echecs = 0;
function cas(nom: string, f: () => void) {
  try {
    f();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

/** Les lignes de sa maquette : main d'œuvre à 20 %, végétaux à 10 %. */
const MIXTE = [
  { montant: "1400.00", tauxTva: "20.00" },
  { montant: "180.00", tauxTva: "20.00" },
  { montant: "640.00", tauxTva: "20.00" },
  { montant: "990.00", tauxTva: "10.00" },
  { montant: "106.80", tauxTva: "10.00" },
];

console.log("=== Plusieurs TVA sur un devis ===\n");

// ── 1. Ce qui existait ne bouge pas ────────────────────────────────────────

cas("un devis à un seul taux sort exactement comme avant", () => {
  const lignes = [{ montant: "450.00" }, { montant: "180.00" }, { montant: "240.00" }];
  const t = totauxAvecReduction(lignes, "20");
  assert.equal(t.brutHt, "870.00");
  assert.equal(t.totalHt, "870.00");
  assert.equal(t.totalTva, "174.00");
  assert.equal(t.totalTtc, "1044.00");
});

cas("un devis à un seul taux, avec remise, sort exactement comme avant", () => {
  const lignes = [{ montant: "450.00" }, { montant: "180.00" }, { montant: "240.00" }];
  const t = totauxAvecReduction(lignes, "20", "15");
  assert.equal(t.reductionMontant, "130.50");
  assert.equal(t.totalHt, "739.50");
  assert.equal(t.totalTva, "147.90");
  assert.equal(t.totalTtc, "887.40");
});

cas("une ligne sans taux suit celui du document — les devis d'avant la migration", () => {
  // Colonne nulle en base : le document commande, et rien ne change pour eux.
  const t = totauxAvecReduction([{ montant: "100.00", tauxTva: null }], "20");
  assert.equal(t.parTaux.length, 1);
  assert.equal(t.parTaux[0]!.taux, "20.00");
  assert.equal(t.totalTva, "20.00");
});

cas("même à un seul taux, la ventilation existe — un seul chemin de calcul", () => {
  const t = totauxAvecReduction([{ montant: "100.00" }], "20");
  assert.equal(t.parTaux.length, 1);
  assert.equal(t.parTaux[0]!.tva, "20.00");
  assert.equal(t.parTaux[0]!.baseHt, "100.00");
});

cas("un devis vide garde sa catégorie plutôt que de n'en montrer aucune", () => {
  const t = totauxAvecReduction([], "20");
  assert.equal(t.parTaux.length, 1);
  assert.equal(t.parTaux[0]!.taux, "20.00");
  assert.equal(t.parTaux[0]!.brutHt, "0.00");
});

// ── 2. Les chiffres de sa maquette, au centime ─────────────────────────────

cas("deux taux : chaque catégorie porte SA base et SA TVA", () => {
  const t = totauxAvecReduction(MIXTE, "20");
  assert.equal(t.parTaux.length, 2);

  const vingt = t.parTaux.find((c) => c.taux === "20.00")!;
  assert.equal(vingt.brutHt, "2220.00");
  assert.equal(vingt.baseHt, "2220.00");
  assert.equal(vingt.tva, "444.00");

  const dix = t.parTaux.find((c) => c.taux === "10.00")!;
  assert.equal(dix.brutHt, "1096.80");
  assert.equal(dix.baseHt, "1096.80");
  assert.equal(dix.tva, "109.68");

  assert.equal(t.totalHt, "3316.80");
  assert.equal(t.totalTva, "553.68");
  assert.equal(t.totalTtc, "3870.48");
});

cas("le total TVA vaut la somme de ce qui est IMPRIMÉ, pas un calcul à part", () => {
  // Le client additionne les lignes qu'il lit. Un total qui ne retomberait pas
  // dessus ferait douter de toute la feuille.
  const t = totauxAvecReduction(MIXTE, "20");
  const somme = t.parTaux.reduce((a, c) => a.plus(new Decimal(c.tva)), new Decimal(0));
  assert.equal(somme.toFixed(2), t.totalTva);
});

cas("le total TTC vaut le HT plus la somme des TVA affichées", () => {
  const t = totauxAvecReduction(MIXTE, "20");
  assert.equal(
    new Decimal(t.totalHt).plus(new Decimal(t.totalTva)).toFixed(2),
    t.totalTtc
  );
});

cas("les bases HT des catégories redonnent le total HT", () => {
  const t = totauxAvecReduction(MIXTE, "20");
  const somme = t.parTaux.reduce((a, c) => a.plus(new Decimal(c.baseHt)), new Decimal(0));
  assert.equal(somme.toFixed(2), t.totalHt);
});

// ── 3. La remise se répartit, elle ne se pose pas sur une seule catégorie ───

cas("la remise se répartit AU PRORATA de ce que chaque catégorie porte", () => {
  const t = totauxAvecReduction(MIXTE, "20", "10");
  assert.equal(t.reductionMontant, "331.68");

  const vingt = t.parTaux.find((c) => c.taux === "20.00")!;
  const dix = t.parTaux.find((c) => c.taux === "10.00")!;

  // 2220 / 3316,80 des 331,68 € accordés.
  assert.equal(vingt.reductionMontant, "222.00");
  assert.equal(dix.reductionMontant, "109.68");

  assert.equal(vingt.baseHt, "1998.00");
  assert.equal(dix.baseHt, "987.12");

  assert.equal(vingt.tva, "399.60");
  assert.equal(dix.tva, "98.71");

  assert.equal(t.totalHt, "2985.12");
  assert.equal(t.totalTva, "498.31");
  assert.equal(t.totalTtc, "3483.43");
});

cas("LA FAUTE À NE PAS COMMETTRE : la TVA ne se calcule pas sur le brut", () => {
  // Sans répartition, la catégorie à 20 % aurait rendu 444,00 € au lieu de
  // 399,60 € — 44,40 € de TVA sur de l'argent que le client ne paie pas.
  const t = totauxAvecReduction(MIXTE, "20", "10");
  const vingt = t.parTaux.find((c) => c.taux === "20.00")!;
  assert.notEqual(vingt.tva, "444.00");
  assert.equal(vingt.tva, "399.60");
});

cas("la somme des remises réparties vaut EXACTEMENT la remise annoncée", () => {
  const t = totauxAvecReduction(MIXTE, "20", "10");
  const somme = t.parTaux.reduce(
    (a, c) => a.plus(new Decimal(c.reductionMontant ?? "0")),
    new Decimal(0)
  );
  assert.equal(somme.toFixed(2), t.reductionMontant);
});

cas("le centime résiduel ne se perd pas — il va à la plus grosse catégorie", () => {
  // **Ce cas a été construit à la main, et le premier était faux.** Trois bases
  // à 100 € et 33,33 % ne laissent aucun résidu (300,01 × 33,33 % = 99,99 €,
  // soit trois fois 33,33 exactement) : le contrôle passait au vert sans rien
  // éprouver. Il faut des centimes qui ne se divisent pas.
  //
  // 3,02 € à 33,33 % font 1,01 € ; le prorata rend 0,33 + 0,33, et il reste
  // 0,35 € — un centime de plus que l'arrondi naturel (0,34). Perdu, ce centime
  // ferait un total qui ne vaut plus la soustraction imprimée juste au-dessus.
  const lignes = [
    { montant: "1.00", tauxTva: "20.00" },
    { montant: "1.00", tauxTva: "10.00" },
    { montant: "1.02", tauxTva: "5.50" },
  ];
  const t = totauxAvecReduction(lignes, "20", "33.33");
  assert.equal(t.reductionMontant, "1.01");

  const somme = t.parTaux.reduce(
    (a, c) => a.plus(new Decimal(c.reductionMontant ?? "0")),
    new Decimal(0)
  );
  assert.equal(somme.toFixed(2), t.reductionMontant);

  // Et le résidu est allé sur la base la plus large, pas sur la dernière vue.
  const plusGrosse = t.parTaux.find((c) => c.taux === "5.50")!;
  assert.equal(plusGrosse.reductionMontant, "0.35");
});

cas("les bases restent cohérentes avec le total, remise comprise", () => {
  const lignes = [
    { montant: "333.33", tauxTva: "20.00" },
    { montant: "333.33", tauxTva: "10.00" },
    { montant: "333.34", tauxTva: "5.50" },
  ];
  for (const pourcent of ["3", "7.5", "15", "33.33", "50"]) {
    const t = totauxAvecReduction(lignes, "20", pourcent);
    const bases = t.parTaux.reduce((a, c) => a.plus(new Decimal(c.baseHt)), new Decimal(0));
    assert.equal(bases.toFixed(2), t.totalHt, `bases ≠ total HT à ${pourcent} %`);
    const tvas = t.parTaux.reduce((a, c) => a.plus(new Decimal(c.tva)), new Decimal(0));
    assert.equal(tvas.toFixed(2), t.totalTva, `TVA ≠ total TVA à ${pourcent} %`);
  }
});

// ── 4. L'ordre est celui du tableau ────────────────────────────────────────

cas("les catégories sortent dans l'ordre où ses lignes apparaissent", () => {
  const t = totauxAvecReduction(
    [
      { montant: "10.00", tauxTva: "10.00" },
      { montant: "10.00", tauxTva: "20.00" },
    ],
    "20"
  );
  // Il a commencé par le 10 % : sa première catégorie reste la première.
  assert.deepEqual(t.parTaux.map((c) => c.taux), ["10.00", "20.00"]);
});

cas("des lignes du même taux dispersées ne font qu'une catégorie", () => {
  // Sa règle : « elles doivent avoir la possibilité d'être sur plusieurs lignes
  // différentes » — une catégorie porte autant de lignes qu'il veut, où qu'elles
  // se trouvent dans le tableau.
  const t = totauxAvecReduction(
    [
      { montant: "10.00", tauxTva: "20.00" },
      { montant: "10.00", tauxTva: "10.00" },
      { montant: "10.00", tauxTva: "20.00" },
    ],
    "20"
  );
  assert.equal(t.parTaux.length, 2);
  assert.equal(t.parTaux.find((c) => c.taux === "20.00")!.brutHt, "20.00");
});

// ── 5. Les petites fonctions que l'écran et le PDF partagent ───────────────

cas("le taux d'une ligne : le sien, ou celui du document", () => {
  assert.equal(tauxDeLaLigne({ tauxTva: "10.00" }, "20"), "10.00");
  assert.equal(tauxDeLaLigne({ tauxTva: null }, "20"), "20.00");
  assert.equal(tauxDeLaLigne({ tauxTva: "" }, "20"), "20.00");
  assert.equal(tauxDeLaLigne({}, "5.5"), "5.50");
  // Une virgule saisie au doigt ne doit pas fabriquer un taux nul.
  assert.equal(tauxDeLaLigne({ tauxTva: "5,5" }, "20"), "5.50");
});

cas("les taux ouverts donnent les catégories à dessiner", () => {
  assert.deepEqual(tauxOuverts([{ tauxTva: "10.00" }, { tauxTva: "20.00" }], "20"), ["10.00", "20.00"]);
  assert.deepEqual(tauxOuverts([], "20"), ["20.00"]);
  assert.deepEqual(tauxOuverts([{ tauxTva: null }], "5.5"), ["5.50"]);
});

cas("UN DEVIS VIDE GARDE SA CATÉGORIE — sans quoi l'écran perd son bouton", () => {
  // **Défaut réel, attrapé par la suite qui entre par le bouton.** L'écran
  // dessine ses lignes ET son « + Ajouter une ligne » dans chaque catégorie :
  // une liste vide lui retirait le seul moyen d'écrire la première ligne, au
  // moment précis où il commence un devis. Le calcul, lui, restait juste — donc
  // ni le typage ni les suites base ne le voyaient.
  const groupes = lignesParCategorie([], "20");
  assert.equal(groupes.length, 1);
  assert.equal(groupes[0]!.taux, "20.00");
  assert.deepEqual(groupes[0]!.lignes, []);
  // Et les deux règles s'accordent : l'écran ne dessine pas une catégorie que
  // les totaux ignoreraient.
  assert.equal(totauxAvecReduction([], "20").parTaux.length, groupes.length);
});

cas("les lignes se rangent sous leur catégorie, dans l'ordre du tableau", () => {
  const groupes = lignesParCategorie(
    [
      { id: "a", tauxTva: null },
      { id: "b", tauxTva: "10.00" },
      { id: "c", tauxTva: null },
    ],
    "20"
  );
  assert.deepEqual(groupes.map((g) => g.taux), ["20.00", "10.00"]);
  assert.deepEqual(groupes[0]!.lignes.map((l) => l.id), ["a", "c"]);
  assert.deepEqual(groupes[1]!.lignes.map((l) => l.id), ["b"]);
});

cas("un taux rond ne traîne pas ses décimales à l'écran", () => {
  assert.equal(tauxLisible("20.00"), "20");
  assert.equal(tauxLisible("10.00"), "10");
  assert.equal(tauxLisible("5.50"), "5,5");
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
