import assert from "node:assert/strict";
import { jourEnTitre } from "../src/lib/jour";

// **Le jour du passage, écrit comme le titre « Septembre 2026 », le jour en plus.**
//
// Sa demande du 22 septembre 2026 : *« pour le jour du passage met la même
// typographie que septembre 2026 mais rajoute le jour »*. Donc la majuscule en
// tête et l'année toujours là, comme le titre du mois ; et le nom du jour, que
// le mois n'a pas.

assert.equal(jourEnTitre("2026-09-22"), "Mardi 22 septembre 2026");
assert.equal(jourEnTitre("2026-08-01"), "Samedi 1er août 2026");
assert.equal(jourEnTitre("2027-02-08"), "Lundi 8 février 2027");
// Le jour ne passe jamais par un instant : aucun fuseau ne le décale.
assert.equal(jourEnTitre("2026-12-31"), "Jeudi 31 décembre 2026");

console.log("Jour en titre : vert.");
