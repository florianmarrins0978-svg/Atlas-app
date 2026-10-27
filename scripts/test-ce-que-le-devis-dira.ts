// « CE QUE VOTRE DEVIS DIRA » NE MENT PLUS — 26 octobre 2026.
//
// **Le défaut, vu sur sa planche des Réglages soignés**
// (`appli/soignee/reglages-documents.html`, « À trancher ») : l'écran « Ce qui
// s'imprime » annonçait « Rien ne s'ajoutera » dès que les interrupteurs du
// bloc de conditions étaient éteints. Or la validité s'imprime en tête du devis
// et les conditions générales après le bon pour accord, et l'une comme l'autre
// sont allumées sur un compte neuf. L'écran lisait `lignesConditionsDevis`, qui
// ne compose QUE le bloc de conditions : il disait vrai sur ce bloc et faux sur
// le devis.
//
// La règle vit dans `ceQueLeDevisDira`, sans base ni écran : c'est elle que
// l'écran lit, et elle compose les mêmes fonctions que le PDF.
//
// Usage : npx tsx scripts/test-ce-que-le-devis-dira.ts
import assert from "node:assert/strict";
import { ceQueLeDevisDira, lireConditions } from "../src/lib/conditions-documents";
import { TEXTE_ORIGINE_CONDITIONS_GENERALES } from "../src/lib/conditions-generales";

let echecs = 0;
function cas(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

console.log("=== Ce que votre devis dira ===\n");

cas("un compte neuf : la validité et les conditions générales s'impriment, rien n'est « rien »", () => {
  // Ce que porte une entreprise qui n'a rien réglé : trente jours, et le texte
  // d'origine des conditions générales (`conditionsDepuisEntreprise`).
  const dira = ceQueLeDevisDira(
    lireConditions({ conditionsGenerales: TEXTE_ORIGINE_CONDITIONS_GENERALES })
  );
  assert.equal(dira.validite, "30 jours", "la validité imprimée en tête n'est pas annoncée");
  assert.equal(dira.conditionsGenerales, true, "les conditions générales imprimées ne sont pas annoncées");
  assert.deepEqual(dira.lignes, []);
  assert.equal(dira.rien, false, "l'écran dirait « Rien ne s'ajoutera » sur un devis qui porte deux choses");
});

cas("la validité seule suffit à ce que quelque chose s'ajoute", () => {
  const dira = ceQueLeDevisDira(lireConditions({}));
  assert.equal(dira.validite, "30 jours");
  assert.equal(dira.conditionsGenerales, false);
  assert.equal(dira.rien, false);
});

cas("les conditions générales seules suffisent aussi", () => {
  const dira = ceQueLeDevisDira(
    lireConditions({ validiteJours: null, conditionsGenerales: "Mes conditions." })
  );
  assert.equal(dira.validite, null);
  assert.equal(dira.conditionsGenerales, true);
  assert.equal(dira.rien, false);
});

cas("tout éteint : alors, et alors seulement, rien ne s'ajoute", () => {
  const dira = ceQueLeDevisDira(lireConditions({ validiteJours: null, conditionsGenerales: "" }));
  assert.equal(dira.validite, null);
  assert.equal(dira.conditionsGenerales, false);
  assert.deepEqual(dira.lignes, []);
  assert.equal(dira.rien, true);
});

cas("des conditions générales faites de blancs n'impriment rien, comme au PDF", () => {
  // Le PDF n'imprime l'annexe que si elle a au moins un paragraphe
  // (`annexeConditionsGenerales`) : l'écran tient la même règle.
  const dira = ceQueLeDevisDira(lireConditions({ validiteJours: null, conditionsGenerales: "  \n\n  " }));
  assert.equal(dira.conditionsGenerales, false);
  assert.equal(dira.rien, true);
});

cas("le bloc de conditions garde ses phrases, mot pour mot celles du PDF", () => {
  const dira = ceQueLeDevisDira(lireConditions({ acomptePourcent: 30, delaiPaiementJours: 0 }));
  assert.deepEqual(dira.lignes, [
    "Mode de règlement : 30 % à la commande, solde à réception de la facture.",
    "Paiement comptant à la fin des travaux.",
  ]);
});

console.log(echecs === 0 ? "\n✅ Ce que votre devis dira — tout est juste." : `\n❌ ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
