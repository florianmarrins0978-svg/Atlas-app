import assert from "node:assert/strict";
import { detailDeLaLigne } from "../src/lib/detail-de-ligne";

/**
 * CE QU'UNE LIGNE LUE PORTE SOUS SON NOM — « 120 m² à 6,50 € ».
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **Le défaut du 2 novembre 2026**, vu en ouvrant les travaux en plus pour sa
 * planche (`appli/soignee/aujourdhui/chantier-travaux-supplementaires.jpg`) :
 * le gazon, 6,50 € en base, s'affichait « 0,00 € ». L'écran mettait la ligne
 * du devis au format de la case (« 6,5 »), puis le formateur des montants ne
 * relisait plus ce qu'on lui donnait et rendait zéro, sans un mot.
 *
 * Vu ROUGE contre l'affichage d'avant (la conversion de
 * `TravauxSupplementairesClient.tsx`, puis `enEuros` sur le résultat) :
 * « 120 m² à 0,00 € ». Ni base, ni réseau, ni navigateur.
 */

let echecs = 0;
function cas(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}`);
    console.log(`    ${(e as Error).message}`);
  }
}

/** L'espace insécable que le formateur pose avant « € » et entre les milliers. */
const lisible = (texte: string) => texte.replace(/[  ]/g, " ");

console.log("=== Ce qu'une ligne lue porte sous son nom ===\n");

cas("le gazon, 6,50 € en base, se lit « 120 m² à 6,50 € », jamais à 0,00 €", () => {
  const dit = lisible(detailDeLaLigne({ quantite: "120.00", unite: "m²", prixUnitaire: "6.50" }, { prixToujours: true }));
  assert.equal(dit, "120 m² à 6,50 €");
});

cas("la même ligne, passée au format de la case (« 6,5 »), se lit pareil", () => {
  // C'est le chiffre que l'écran tenait : la lecture unique du dépôt le lit.
  const dit = lisible(detailDeLaLigne({ quantite: "120", unite: "m²", prixUnitaire: "6,5" }, { prixToujours: true }));
  assert.equal(dit, "120 m² à 6,50 €");
});

cas("sur la facture, une quantité de 1 tait son prix : il est le montant écrit à droite", () => {
  assert.equal(detailDeLaLigne({ quantite: "1.00", unite: "forfait", prixUnitaire: "380.00" }), "1 forfait");
  assert.equal(lisible(detailDeLaLigne({ quantite: "24.00", unite: "ml", prixUnitaire: "18.00" })), "24 ml à 18,00 €");
});

cas("sur les travaux en plus, le prix s'écrit toujours, même pour 1", () => {
  const dit = lisible(detailDeLaLigne({ quantite: "1.00", unite: "forfait", prixUnitaire: "380.00" }, { prixToujours: true }));
  assert.equal(dit, "1 forfait à 380,00 €");
});

cas("sans unité, la ligne se compte en « u », comme sur le papier", () => {
  assert.equal(lisible(detailDeLaLigne({ quantite: "2.00", unite: null, prixUnitaire: "18.00" })), "2 u à 18,00 €");
});

cas("une quantité à décimales garde sa virgule, sans zéro de trop", () => {
  assert.equal(lisible(detailDeLaLigne({ quantite: "1.50", unite: "h", prixUnitaire: "45.00" })), "1,5 h à 45,00 €");
});

cas("les milliers ont leur espace, et c'est l'insécable que le PDF connaît", () => {
  const dit = detailDeLaLigne({ quantite: "2.00", unite: "u", prixUnitaire: "1800.00" });
  assert.equal(lisible(dit), "2 u à 1 800,00 €");
  assert.ok(!dit.includes(" "), "l'espace fine d'Intl est revenue : un PDF ne l'imprime pas");
});

cas("un prix qu'on ne sait pas lire n'est pas écrit, plutôt qu'écrit 0,00 €", () => {
  assert.equal(detailDeLaLigne({ quantite: "3.00", unite: "u", prixUnitaire: "douze" }), "3 u");
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} Ce qu'une ligne lue porte sous son nom — ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
