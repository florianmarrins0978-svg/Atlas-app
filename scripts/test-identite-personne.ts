/**
 * L'identité d'une personne : civilité, prénom, nom — sans base ni navigateur.
 *
 * **CE QUE CETTE SUITE GARDE, ET QUI N'EST PAS ÉVIDENT : LES COMPTES D'AVANT.**
 *
 * Jusqu'à la migration 0077, `users` n'avait qu'un champ `nom`, qui portait le
 * nom COMPLET — « Anne Amiot ». Ces lignes-là n'ont pas été découpées, et elles
 * ne le seront pas : « Jean-Pierre de La Fontaine » ne se coupe pas par un
 * espace. Elles ont donc `prenom` à NULL.
 *
 * Si l'affichage ne retombait pas dessus, une simple mise à jour aurait
 * **renommé des comptes qui marchaient** — et personne ne l'aurait vu avant
 * qu'un artisan ouvre ses réglages. C'est le cas principal de cette suite, pas
 * un cas limite.
 *
 *   npx tsx scripts/test-identite-personne.ts
 */
import assert from "node:assert/strict";
import { nomAffiche, nomAvecCivilite, initialesDe } from "../src/lib/identite-personne";

let rouges = 0;
function essai(quoi: string, fn: () => void) {
  try {
    fn();
    console.log("  ok    " + quoi);
  } catch (e) {
    rouges++;
    console.log("  ROUGE " + quoi + "\n        " + (e as Error).message.split("\n")[0]);
  }
}

console.log("\n=== L'identité d'une personne ===\n");

console.log("Le nom affiché");
essai("prénom et nom se joignent", () => {
  assert.equal(nomAffiche({ prenom: "Anne", nom: "Amiot" }), "Anne Amiot");
});
essai("un compte d'AVANT la migration 0077 s'affiche comme hier", () => {
  assert.equal(nomAffiche({ prenom: null, nom: "Anne Amiot" }), "Anne Amiot");
});
essai("un prénom seul suffit", () => {
  assert.equal(nomAffiche({ prenom: "Anne", nom: null }), "Anne");
});
essai("rien de connu rend une chaîne vide, jamais un espace", () => {
  assert.equal(nomAffiche({ prenom: "  ", nom: null }), "");
});

console.log("\nLa civilité devant le nom");
essai("« Mme » précède le nom", () => {
  assert.equal(nomAvecCivilite({ civilite: "mme", prenom: "Anne", nom: "Amiot" }), "Mme Anne Amiot");
});
essai("« Mr. » aussi, et c'est le libellé de l'application", () => {
  assert.equal(nomAvecCivilite({ civilite: "mr", prenom: "Aimé", nom: "Amiot" }), "Mr. Aimé Amiot");
});
essai("sans civilité, le nom reste seul", () => {
  assert.equal(nomAvecCivilite({ civilite: null, prenom: "Anne", nom: "Amiot" }), "Anne Amiot");
});
// « Mme » tout court ne désigne personne : sur un compte dont on ignore le nom,
// l'appelant montre l'e-mail, et il ne le peut que si on lui rend du vide.
essai("une civilité SEULE ne s'affiche pas", () => {
  assert.equal(nomAvecCivilite({ civilite: "mme", prenom: null, nom: null }), "");
});

console.log("\nLes initiales");
essai("prénom et nom donnent une lettre chacun", () => {
  assert.equal(initialesDe({ prenom: "Anne", nom: "Amiot" }, "a@essai.local"), "AA");
});
essai("un compte d'avant garde son découpage par espaces", () => {
  assert.equal(initialesDe({ prenom: null, nom: "Bruno Berger" }, "b@essai.local"), "BB");
});
essai("un mot unique donne ses deux premières lettres", () => {
  assert.equal(initialesDe({ prenom: null, nom: "Anne" }, "a@essai.local"), "AN");
});
// Un compte tout neuf n'a pas encore dit son nom, et un rond vide se lit comme
// un écran cassé.
essai("sans nom, l'e-mail prend le relais — avant l'arobase", () => {
  assert.equal(initialesDe({ prenom: null, nom: null }, "florian@essai.local"), "FL");
});
essai("un e-mail d'une seule lettre ne rend pas l'arobase", () => {
  assert.equal(initialesDe({ prenom: null, nom: null }, "a@essai.local"), "A");
});
essai("plus rien du tout rend un point d'interrogation, jamais du vide", () => {
  assert.equal(initialesDe({ prenom: null, nom: null }, ""), "?");
});
// Un nom composé se coupe sur son PREMIER et son DERNIER mot : « de La » ne
// donne pas d'initiale, et « JF » vaudrait pour deux personnes différentes.
essai("un nom en plusieurs mots prend le premier et le dernier", () => {
  assert.equal(initialesDe({ prenom: null, nom: "Jean-Pierre de La Fontaine" }, "j@essai.local"), "JF");
});

console.log(rouges === 0 ? "\nTout est vert." : "\n" + rouges + " ROUGE(S).");
process.exit(rouges === 0 ? 0 : 1);
