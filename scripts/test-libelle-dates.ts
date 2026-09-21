import assert from "node:assert/strict";
import {
  libelleAutreDate,
  libelleRetenir,
  phraseDureeDesTravaux,
  refusDesJoursRetenus,
} from "../src/lib/libelle-dates";

// Les phrases du « je propose », sur la page du client.
//
// **Sa formulation, le 20 septembre 2026 :** « quand il y a une date c'est :
// cette date ne me convient pas ? Je propose », et « quand il y a plusieurs
// dates de proposées, mets la phrase au pluriel ».
//
// **Le pluriel se décide sur les JOURS, pas sur le nombre de propositions.**
// Sa capture du même jour le montre : une seule proposition listait « le jeudi
// 8 octobre, le vendredi 9, le lundi 12 et le mardi 13 octobre » — quatre dates
// — et la ligne d'en dessous disait « cette date », au singulier. Compter les
// propositions redonne exactement ce singulier-là.
//
// **Ce contrôle ne réclame plus « Aucune des deux »**, la formule d'avant : le
// patron l'a fait remplacer, et une suite qui exige ce qu'il a fait enlever
// rend son écran impossible à changer (`CLAUDE.md` §5 bis).
//
// C'est la seule page que le client voit, et elle porte le sérieux du patron.

let echecs = 0;
function cas(nom: string, verifier: () => void) {
  try {
    verifier();
    console.log(`  ok  ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  RATÉ  ${nom}`);
    console.error(`        ${(e as Error).message}`);
  }
}

console.log("=== Le libellé s'accorde au nombre de JOURS proposés ===");

cas("un seul jour : la question reste au singulier", () => {
  const l = libelleAutreDate(1);
  assert.match(l, /^Cette date ne me convient pas \? Je propose$/, `« ${l} » n'est pas sa formulation.`);
});

cas("plusieurs jours : tout passe au pluriel, verbe compris", () => {
  const l = libelleAutreDate(4);
  assert.match(l, /^Ces dates ne me conviennent pas \? Je propose$/, `« ${l} » n'est pas sa formulation.`);
  assert.ok(!l.includes("Cette date"), "Le singulier a survécu au pluriel.");
});

cas("deux jours suffisent à faire le pluriel", () => {
  assert.equal(libelleAutreDate(2), libelleAutreDate(7));
});

cas("aucun jour proposé : le client peut quand même en donner un", () => {
  const l = libelleAutreDate(0);
  assert.ok(!l.includes("Aucune des"), `« ${l} » renvoie à des dates qui n'existent pas.`);
  assert.match(l, /propose/, "Sans date proposée, le client doit pouvoir en suggérer une.");
});

cas("aucun cas ne rend un libellé vide", () => {
  for (const n of [0, 1, 2, 3, 7]) {
    assert.ok(libelleAutreDate(n).trim().length > 0, `Libellé vide pour ${n} jour(s).`);
  }
});

cas("aucune flèche décorative, nulle part", () => {
  // Sa consigne du 25 août 2026, tenue par `test-aucune-fleche.ts` pour les
  // écrans. Ces phrases-ci se composent hors d'un fichier `.tsx`.
  for (const l of [libelleAutreDate(1), libelleAutreDate(4), libelleRetenir(1), libelleRetenir(4)]) {
    assert.ok(!/[→›»]$/.test(l.trim()), `« ${l} » finit par une flèche.`);
  }
});

console.log("=== Le nombre de jours du chantier ===");

cas("plusieurs jours : la phrase les compte", () => {
  assert.equal(phraseDureeDesTravaux(4), "Les travaux sont prévus sur 4 jours.");
});

cas("un seul jour : aucune phrase — il n'y a rien à annoncer", () => {
  assert.equal(phraseDureeDesTravaux(1), null, "Une phrase « sur 1 jour » est du bruit.");
  assert.equal(phraseDureeDesTravaux(0), null);
});

console.log("=== Le bouton qui retient, et ce qu'il refuse ===");

cas("le bouton s'accorde lui aussi", () => {
  assert.equal(libelleRetenir(1), "Retenir cette date");
  assert.equal(libelleRetenir(4), "Retenir ces jours");
});

cas("aucun jour touché : on dit quoi faire, pas ce qui manque", () => {
  assert.match(refusDesJoursRetenus(0, 4) ?? "", /Touchez/);
});

cas("trois jours sur quatre : le refus DIT combien il en manque", () => {
  // Trois jours retenus pour un chantier de quatre partaient sans un mot :
  // l'artisan n'aurait pas eu de quoi faire le travail.
  assert.equal(refusDesJoursRetenus(3, 4), "Il manque 1 jour.");
  assert.equal(refusDesJoursRetenus(2, 4), "Il manque 2 jours.");
});

cas("le compte est bon : plus rien à dire", () => {
  assert.equal(refusDesJoursRetenus(4, 4), null);
  assert.equal(refusDesJoursRetenus(1, 1), null);
});

if (echecs > 0) {
  console.error(`\n${echecs} contrôle(s) en échec.`);
  process.exit(1);
}
console.log("Tous les contrôles des phrases du client sont passés.");
