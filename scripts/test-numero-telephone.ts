import assert from "node:assert/strict";
import { espacerNumero, numeroEnregistre } from "../src/lib/numero-telephone";

// **« Les dix chiffres à la suite, avec les bons espaces »** — sa demande du
// 21 août 2026. Devant le client, on ne s'arrête pas toutes les deux touches.
//
// Ce que cette suite tient, et qui n'est pas une affaire de forme : les deux
// règles qui ne se devinent pas — l'international qu'on ne découpe pas, et le
// curseur qui reste où l'on corrige.

let echecs = 0;
function cas(nom: string, verifier: () => void): void {
  try {
    verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

console.log("=== Le numéro s'espace tout seul ===\n");

cas("dix chiffres d'affilée deviennent 06 79 98 45 14", () => {
  assert.equal(espacerNumero("0679984514").valeur, "06 79 98 45 14");
});

cas("un numéro déjà espacé ne bouge pas", () => {
  assert.equal(espacerNumero("06 79 98 45 14").valeur, "06 79 98 45 14");
});

cas("les points, tirets et lettres tombent — c'est un numéro, pas une note", () => {
  assert.equal(espacerNumero("06.79-98x45y14").valeur, "06 79 98 45 14");
});

cas("on s'arrête à dix chiffres, on n'en invente pas et on n'en garde pas plus", () => {
  assert.equal(espacerNumero("06799845149999").valeur, "06 79 98 45 14");
});

cas("une case vide reste vide", () => {
  assert.equal(espacerNumero("").valeur, "");
  assert.equal(espacerNumero("   ").valeur, "");
});

cas("la frappe s'espace à mesure, sans jamais reculer", () => {
  const attendus = ["0", "06", "06 7", "06 79", "06 79 9", "06 79 98"];
  for (let i = 0; i < attendus.length; i++) {
    assert.equal(espacerNumero("0679984514".slice(0, i + 1)).valeur, attendus[i]);
  }
});

// **L'international n'est pas un cas tordu : c'est le client belge ou suisse.**
// Espacé par paires, « +33679984514 » rendrait « +33 67 99 84 51 4 » — le
// numéro de personne.
cas("un numéro international part intact", () => {
  assert.equal(espacerNumero("+33679984514").valeur, "+33679984514");
  assert.equal(espacerNumero("+32 475 12 34 56").valeur, "+32 475 12 34 56");
});

// Le geste le plus courant après la frappe : corriger un chiffre au milieu.
cas("le curseur reste où l'on corrige, il ne saute pas à la fin", () => {
  // « 06 7|9 98 45 14 » : trois chiffres à gauche, on en insère un quatrième.
  const r = espacerNumero("06 75" + "9 98 45 14".slice(0), 5);
  assert.equal(r.curseur, 5, "le curseur doit rester juste après le chiffre inséré");
});

cas("le curseur se repose après le n-ième chiffre, espaces refaits", () => {
  // Deux chiffres à gauche du curseur dans la saisie brute…
  const r = espacerNumero("0679984514", 2);
  // …et deux chiffres à gauche du curseur dans la valeur espacée.
  assert.equal((r.valeur.slice(0, r.curseur).match(/\d/g) ?? []).length, 2);
});

cas("sans curseur donné, il se pose à la fin", () => {
  const r = espacerNumero("0679984514");
  assert.equal(r.curseur, r.valeur.length);
});

// ── Ce qui part en base ────────────────────────────────────────────────────
//
// **La jolie forme est un AFFICHAGE.** En base, le numéro est comparé, composé
// et envoyé : y écrire les espaces obligerait chaque consommateur à savoir les
// retirer, et il suffirait qu'un seul l'oublie pour qu'un client cesse d'être
// reconnu — en silence.

console.log("\n— Ce qui s'enregistre —");

cas("ce qu'il voit est espacé, ce qui part en base ne l'est pas", () => {
  const affiche = espacerNumero("0679984514").valeur;
  assert.equal(affiche, "06 79 98 45 14");
  assert.equal(numeroEnregistre(affiche), "0679984514");
});

cas("un numéro déjà nu reste nu", () => {
  assert.equal(numeroEnregistre("0679984514"), "0679984514");
});

cas("une case vide reste vide, elle ne devient pas une chaîne de rien", () => {
  assert.equal(numeroEnregistre(""), "");
  assert.equal(numeroEnregistre("   "), "");
});

cas("un numéro international garde ses espaces à lui", () => {
  assert.equal(numeroEnregistre("+32 475 12 34 56"), "+32 475 12 34 56");
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
