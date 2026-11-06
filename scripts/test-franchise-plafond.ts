/* =======================================================================
   Le plafond de la franchise de TVA : le compte de l'année, aux bornes.

   Sa planche du 5 novembre 2026, A ET B le 6 novembre. La règle pure
   (`src/lib/franchise-plafond.ts`) sert la ligne de Terminés, le compteur
   de Votre TVA, la feuille du compte ET l'arrêt de la facture : c'est ici
   qu'elle s'éprouve, sans base, en centimes, là où un arrondi ment.
   ======================================================================= */
import assert from "node:assert/strict";
import {
  arretDeLaFacture,
  centimesDe,
  compterLaFranchise,
  etatDuPlafond,
  eurosEntiers,
  ligneSurTermines,
  phraseDuCompte,
  PLAFOND_CENTIMES,
  PLAFOND_MAJORE_CENTIMES,
  tonDuCompte,
  type ChiffresDeLAnnee,
} from "../src/lib/franchise-plafond";

let echecs = 0;
function essai(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

const NBSP = " ";
function annee(factures: string, importees = "0", avoirs = "0"): ChiffresDeLAnnee {
  return {
    annee: 2026,
    factures: { nombre: 3, totalHt: factures },
    importees: { nombre: importees === "0" ? 0 : 1, total: importees },
    avoirs: { nombre: avoirs === "0" ? 0 : 1, totalHt: avoirs },
  };
}

console.log("\n=== Les plafonds lus le 6 novembre 2026 ===\n");

essai("37 500 € et 41 250 €, en centimes", () => {
  assert.equal(PLAFOND_CENTIMES, 3_750_000);
  assert.equal(PLAFOND_MAJORE_CENTIMES, 4_125_000);
});

console.log("\n=== Le compte : envoyées, plus importées, moins avoirs ===\n");

essai("le compte de la planche : 31 980 + 1 520 − 300 = 33 200 €", () => {
  const c = compterLaFranchise(annee("31980.00", "1520.00", "300.00"));
  assert.equal(c.totalCentimes, 3_320_000);
  assert.equal(c.factures.centimes, 3_198_000);
  assert.equal(c.importees.centimes, 152_000);
  assert.equal(c.avoirs.centimes, 30_000);
  assert.equal(c.pourcent, 88, "33 200 sur 37 500 font 88,5 % : la jauge arrondit vers le bas");
});

essai("au centime près, sans flottant : 0,10 + 0,20 font 0,30", () => {
  const c = compterLaFranchise(annee("0.10", "0.20"));
  assert.equal(c.totalCentimes, 30);
});

essai("un montant au-delà du centime arrête le compte au lieu de l'arrondir", () => {
  assert.throws(() => centimesDe("1.005"));
});

console.log("\n=== Les bornes ===\n");

essai("79,99 % se tait, 80 % parle", () => {
  // 80 % de 37 500 € = 30 000 €.
  assert.equal(etatDuPlafond(2_999_999), "loin");
  assert.equal(etatDuPlafond(3_000_000), "proche");
  assert.equal(ligneSurTermines(compterLaFranchise(annee("29999.99"))), false);
  assert.equal(ligneSurTermines(compterLaFranchise(annee("30000.00"))), true);
});

essai("le plafond tout juste n'est pas passé, un centime de plus l'est", () => {
  assert.equal(etatDuPlafond(3_750_000), "proche");
  assert.equal(etatDuPlafond(3_750_001), "passe");
});

essai("le plafond majoré tout juste n'est pas passé, un centime de plus l'est", () => {
  assert.equal(etatDuPlafond(4_125_000), "passe");
  assert.equal(etatDuPlafond(4_125_001), "majore_passe");
});

essai("la jauge ne dépasse jamais 100, ni ne descend sous 0 avec plus d'avoirs que de factures", () => {
  assert.equal(compterLaFranchise(annee("50000.00")).pourcent, 100);
  assert.equal(compterLaFranchise(annee("100.00", "0", "300.00")).pourcent, 0);
});

console.log("\n=== Le ton et la phrase ===\n");

essai("l'or loin, l'ambre tout près, le rouge passé", () => {
  assert.equal(tonDuCompte(compterLaFranchise(annee("12400.00"))), "or");
  assert.equal(tonDuCompte(compterLaFranchise(annee("33200.00"))), "ambre");
  assert.equal(tonDuCompte(compterLaFranchise(annee("38900.00"))), "rouge");
  assert.equal(tonDuCompte(compterLaFranchise(annee("42000.00"))), "rouge");
});

essai("sous le plafond : « Encore 4 300 € avant 37 500 €. »", () => {
  const p = phraseDuCompte(compterLaFranchise(annee("33200.00")));
  assert.equal(p.texte, `Encore 4${NBSP}300${NBSP}€ avant 37${NBSP}500${NBSP}€.`);
});

essai("le reste s'arrondit vers le bas : à 37 499,60 €, il reste 0 €, jamais 1", () => {
  const p = phraseDuCompte(compterLaFranchise(annee("37499.60")));
  assert.equal(p.texte, `Encore 0${NBSP}€ avant 37${NBSP}500${NBSP}€.`);
});

essai("passé le plafond : le majoré, et l'année d'après renvoyée au comptable", () => {
  const p = phraseDuCompte(compterLaFranchise(annee("38900.00")));
  assert.equal(p.ton, "rouge");
  assert.equal(p.texte, `Encore 2${NBSP}350${NBSP}€ avant 41${NBSP}250${NBSP}€. Votre comptable vous dit ce que ça change pour 2027.`);
});

essai("passé le majoré : de combien, et la TVA renvoyée au comptable", () => {
  const p = phraseDuCompte(compterLaFranchise(annee("41600.00")));
  assert.equal(p.texte, `Plafond majoré passé de 350${NBSP}€. Votre comptable vous dit si la TVA est due.`);
});

essai("les euros entiers ne montent jamais : 33 200,99 € s'écrit 33 200 €", () => {
  assert.equal(eurosEntiers(3_320_099), `33${NBSP}200${NBSP}€`);
});

console.log("\n=== L'arrêt de la facture ===\n");

essai("la facture de Mr. Lambert : 33 200 + 8 400 = 41 600, l'envoi s'arrête", () => {
  const a = arretDeLaFacture(compterLaFranchise(annee("33200.00")), "8400.00");
  assert.ok(a, "la facture qui passe le majoré est partie sans un mot");
  assert.equal(a.avecElleCentimes, 4_160_000);
  assert.equal(a.factureCentimes, 840_000);
  assert.equal(a.dejaPasse, false);
});

essai("une facture qui arrive tout juste au majoré part comme aujourd'hui", () => {
  assert.equal(arretDeLaFacture(compterLaFranchise(annee("33200.00")), "8050.00"), null);
  assert.ok(arretDeLaFacture(compterLaFranchise(annee("33200.00")), "8050.01"));
});

essai("passer le plafond de base seul n'arrête pas : la franchise tient jusqu'au 31 décembre", () => {
  assert.equal(arretDeLaFacture(compterLaFranchise(annee("36000.00")), "3000.00"), null);
});

essai("le majoré déjà passé : chaque facture s'arrête encore, et le dit autrement", () => {
  const a = arretDeLaFacture(compterLaFranchise(annee("42000.00")), "100.00");
  assert.ok(a);
  assert.equal(a.dejaPasse, true);
});

console.log(echecs ? `\n❌ ${echecs} échec(s).` : "\n✅ Le plafond de la franchise se compte au centime, aux bornes comprises.");
if (echecs) process.exit(1);
