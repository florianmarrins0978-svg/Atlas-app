import assert from "node:assert/strict";
import { nombreEnLettres } from "../src/lib/nombre-en-lettres";

// Le compte des chantiers, écrit en toutes lettres dans l'en-tête retenu le
// 10 août 2026 : « HUIT EN COURS ».
//
// **Ce qui se casse ici ne se voit pas en cliquant.** Un compte de zéro, un
// compte au-delà du seuil, un compte impossible : trois cas qu'aucun écran
// n'atteint pendant qu'on le regarde, et qui produiraient « undefined en
// cours » sur l'accueil du patron.

let echecs = 0;
function cas(nom: string, verifier: () => void) {
  try {
    verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

console.log("=== Le compteur de l'en-tête ===");

cas("les comptes courants s'écrivent en lettres, capitale en tête", () => {
  assert.equal(nombreEnLettres(1), "Un");
  assert.equal(nombreEnLettres(4), "Quatre");
  assert.equal(nombreEnLettres(8), "Huit");
  assert.equal(nombreEnLettres(16), "Seize");
});

cas("aucun chantier : « Zéro », jamais une case vide", () => {
  // L'écran affiche alors « ZÉRO EN COURS ». Un blanc à cet endroit se lit
  // comme un chargement qui n'a pas abouti.
  assert.equal(nombreEnLettres(0), "Zéro");
});

cas("au-delà de seize, le chiffre reprend la main", () => {
  // Le seuil est typographique, pas arithmétique : « dix-sept » tient encore,
  // « quatre-vingt-dix-neuf » sort de la ligne. On coupe avant que ça se voie.
  assert.equal(nombreEnLettres(17), "17");
  assert.equal(nombreEnLettres(42), "42");
});

cas("un compte impossible s'affiche tel quel, sans être maquillé en mot", () => {
  assert.equal(nombreEnLettres(-1), "-1");
  assert.equal(nombreEnLettres(2.5), "2.5");
});

cas("jamais « undefined » ni chaîne vide, quoi qu'on reçoive", () => {
  for (const valeur of [0, 3, 16, 17, -4, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    const rendu = nombreEnLettres(valeur);
    assert.equal(typeof rendu, "string");
    assert.ok(rendu.length > 0, `« ${valeur} » ne rend rien`);
    assert.ok(!rendu.includes("undefined"), `« ${valeur} » rend « ${rendu} »`);
  }
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} Compteur en lettres — ${echecs} échec(s).`);
if (echecs > 0) process.exit(1);
