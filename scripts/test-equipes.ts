// La règle de nommage des salariés, et la charge qu'ils mettent sur une
// demi-journée — sans base de données.
//
// **Sa demande du 2026-08-10 :** *« soit équipe A équipe B, soit des noms et
// prénoms. Mais s'il n'a pas d'équipe et qu'il ne met rien, il ne faut pas
// qu'il y ait quand même écrit équipe A équipe B. »*
//
// **Sa demande du 2026-08-26** (planche 97, réponse **A**) : les noms
// remplacent « les équipes A ou B » sur les chantiers, *« néanmoins les équipes
// doivent toujours servir à définir le niveau de remplissage du planning :
// 2 équipes = 2 chantiers par jour, comme avant, ça ne bouge pas »*.
//
// Le principe qui tient tous les cas : **on n'invente jamais un nom, on ne
// laisse jamais deux lignes indiscernables, et on ne ferme jamais une journée
// qui reste ouverte.**

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { MOT_ETAT } from "../src/lib/planning-jour";
import {
  libelleSalarie,
  salariesAffiches,
  equipesMobilisees,
  phraseDuCompteur,
  phraseDesSalaries,
  MAX_SALARIES,
  MAX_EQUIPES,
} from "../src/lib/equipes";

let echecs = 0;
function essai(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}`);
    console.log(`    ${(e as Error).message}`);
  }
}

console.log("=== Nommer les salariés — et se taire quand il n'y a personne ===");

essai("seul, on n'écrit RIEN", () => {
  assert.equal(libelleSalarie({ rang: 1, nom: null }, 0), null);
  // Et même si un nom traîne en base : à zéro salarié il n'y a personne à
  // distinguer, et le planning n'a rien à écrire.
  assert.equal(libelleSalarie({ rang: 1, nom: "Théo" }, 0), null);
});

essai("sans nom écrit, le repli est le RANG — jamais « Équipe A »", () => {
  assert.equal(libelleSalarie({ rang: 1, nom: null }, 2), "Salarié 1");
  assert.equal(libelleSalarie({ rang: 2, nom: null }, 2), "Salarié 2");
  // Sa demande du 26 août : « plus les équipes A ou B ». Le mot doit avoir
  // disparu de ce que l'écran peut écrire, pas seulement du cas courant.
  for (let rang = 1; rang <= MAX_SALARIES; rang++) {
    const dit = libelleSalarie({ rang, nom: null }, MAX_SALARIES) ?? "";
    assert.ok(!/[ÉE]quipe/i.test(dit), `rang ${rang} écrit encore « ${dit} »`);
  }
});

essai("un nom écrit l'emporte sur le repli", () => {
  assert.equal(libelleSalarie({ rang: 1, nom: "Théo" }, 2), "Théo");
  assert.equal(libelleSalarie({ rang: 2, nom: null }, 2), "Salarié 2");
});

essai("un champ d'espaces n'est pas un nom", () => {
  assert.equal(libelleSalarie({ rang: 2, nom: "   " }, 2), "Salarié 2");
  assert.equal(libelleSalarie({ rang: 1, nom: "" }, 3), "Salarié 1");
});

essai("les espaces autour d'un nom sont retirés", () => {
  assert.equal(libelleSalarie({ rang: 1, nom: "  Jean Dupont  " }, 2), "Jean Dupont");
});

essai("hors des bornes de la base, on n'écrit rien", () => {
  // Le `rang` est contraint entre 1 et 20 en base (migration 0034). Un rang
  // au-delà ne peut pas exister : lui fabriquer un libellé donnerait à l'écran
  // une ligne que l'écriture refuserait ensuite, sans rien expliquer.
  assert.equal(MAX_SALARIES, 20);
  assert.equal(MAX_EQUIPES, 20);
  assert.equal(libelleSalarie({ rang: 21, nom: null }, 20), null);
  assert.equal(libelleSalarie({ rang: 0, nom: null }, 20), null);
});

essai("les rangs manquants sont complétés, dans l'ordre", () => {
  const lignes = salariesAffiches([{ rang: 3, nom: "Nadia" }], 3);
  assert.deepEqual(
    lignes.map((e) => libelleSalarie(e, 3)),
    ["Salarié 1", "Salarié 2", "Nadia"]
  );
});

essai("redescendre puis remonter le compteur ne perd aucun nom", () => {
  const enBase = [
    { rang: 1, nom: "Marc" },
    { rang: 2, nom: "Léo" },
    { rang: 3, nom: "Sofia" },
  ];
  assert.deepEqual(
    salariesAffiches(enBase, 2).map((e) => libelleSalarie(e, 2)),
    ["Marc", "Léo"]
  );
  assert.deepEqual(
    salariesAffiches(enBase, 3).map((e) => libelleSalarie(e, 3)),
    ["Marc", "Léo", "Sofia"]
  );
});

essai("ZÉRO salarié ne montre AUCUNE ligne — le plancher n'est pas un", () => {
  // C'est ce qui distingue ce compteur de celui des équipes. Une ligne
  // « Salarié 1 » offerte à un artisan seul l'inviterait à se nommer lui-même,
  // et ferait apparaître une case à cocher sur chacune de ses demi-journées.
  assert.equal(salariesAffiches([], 0).length, 0);
  assert.equal(salariesAffiches([], -3).length, 0);
  assert.equal(salariesAffiches([], Number.NaN).length, 0);
  assert.equal(salariesAffiches([], 99).length, MAX_SALARIES);
});

essai("aucun salarié transmis : on n'écrit rien plutôt que d'inventer", () => {
  assert.equal(libelleSalarie(null, 3), null);
  assert.equal(libelleSalarie(undefined, 3), null);
  assert.equal(libelleSalarie({ rang: 1, nom: null }, Number.NaN), null);
});

console.log("\n=== La charge d'une demi-journée : sa règle qui NE BOUGE PAS ===");

essai("à effectif égal, la charge est celle d'avant la coupure", () => {
  // C'est la propriété qui garantit qu'il ne verra aucune différence : son
  // compteur de salariés a été repris du nombre d'équipes (migration 0067).
  // Avant, cocher deux équipes mobilisait deux équipes.
  assert.equal(equipesMobilisees(2, 2), 2);
  assert.equal(equipesMobilisees(1, 2), 1);
  // Sa correction du 22 août 2026 — Julien ET Antoine chez Mr Eric ferment
  // bien la demi-journée.
  assert.equal(equipesMobilisees(2, 2) / 2, 1);
});

essai("plus de gars que d'équipes ne ferme pas une journée ouverte", () => {
  // Sans le plafond, trois gars sur un chantier rempliraient à eux seuls une
  // journée qui en accepte deux — et le planning refuserait au client des jours
  // réellement libres.
  assert.equal(equipesMobilisees(3, 2), 2);
  assert.equal(equipesMobilisees(9, 2), 2);
  assert.equal(equipesMobilisees(20, 1), 1);
});

essai("un chantier sans personne coché occupe quand même sa place", () => {
  // Le compter zéro afficherait libre une journée déjà prise.
  assert.equal(equipesMobilisees(0, 2), 1);
  assert.equal(equipesMobilisees(-4, 3), 1);
});

essai("une capacité aberrante ne rend jamais zéro ni l'infini", () => {
  assert.equal(equipesMobilisees(2, 0), 1);
  assert.equal(equipesMobilisees(2, Number.NaN), 1);
});

console.log("\n=== Les deux phrases, et ce qu'elles ne disent pas ===");

essai("la phrase du compteur d'équipes ne contient aucun mot de métier", () => {
  // « chantiers de front » a été soumis au patron et rejeté : « pour moi rien ».
  // **Sa dictée du 26 août 2026 :** *« en dessous en gris marque 2 chantiers par
  // jour, c'est ce qui remplit votre planning — le chiffre bouge en fonction du
  // nombre d'équipes »*. C'est le CHIFFRE qui doit suivre, pas seulement le mot.
  //
  // **Elle rend DEUX morceaux depuis le 31 août 2026** (planche 99, réponse A) :
  // entre les deux se glissent le carré du planning et son mot, qui ne sont pas
  // du texte. Sa demande : *« écrit deux chantiers par jour, planning complet,
  // et met le petit carré vert foncé avec écrit "complet" du planning »*.
  assert.deepEqual(phraseDuCompteur(1), { avant: "Un chantier par jour. Planning", apres: "." });
  assert.deepEqual(phraseDuCompteur(2), { avant: "2 chantiers par jour. Planning", apres: "." });
  assert.deepEqual(phraseDuCompteur(5), { avant: "5 chantiers par jour. Planning", apres: "." });
  for (const n of [2, 7, 20]) {
    assert.ok(
      phraseDuCompteur(n).avant.startsWith(`${n} chantiers`),
      `phrase(${n}) ne porte pas le chiffre du compteur : « ${phraseDuCompteur(n).avant} »`
    );
  }
  for (const n of [1, 2, 7, 20]) {
    const entier = phraseDuCompteur(n).avant + phraseDuCompteur(n).apres;
    assert.ok(!/de front|effectif|ressource/i.test(entier), `phrase(${n}) emploie un mot de métier`);
    // **Le mot ne s'écrit PAS ici.** Il vient de `MOT_ETAT` : recopié dans la
    // phrase, il cesserait de suivre la légende du calendrier le jour où elle
    // change, et les deux écrans diraient deux mots pour la même couleur.
    assert.ok(!/complet/i.test(entier), `phrase(${n}) écrit « complet » au lieu de le prendre dans MOT_ETAT`);
  }
  // Une valeur aberrante ne doit pas écrire « 0 chantiers par jour » : le
  // compteur est borné à 1 partout ailleurs, et la phrase le suit.
  assert.deepEqual(phraseDuCompteur(0), { avant: "Un chantier par jour. Planning", apres: "." });
});

essai("le mot du planning est celui de la légende, et il n'existe qu'une fois", () => {
  // Sa demande du 31 août 2026 : le carré vert foncé et le mot « complet » « du
  // planning » — donc CELUI de la légende, pas un synonyme.
  assert.equal(MOT_ETAT.plein, "complet");
  assert.equal(MOT_ETAT.dispo, "incomplet");
  // « rien » et non « libre » : c'est le mot que porte la légende du calendrier.
  assert.equal(MOT_ETAT.libre, "rien");
  // La légende du calendrier ne les écrit plus en clair : elle les lit ici. Un
  // mot recopié dans l'écran rouvrirait la divergence que cette table ferme.
  const legende = readFileSync(path.join(__dirname, "..", "src/components/atlas/MoisCharge.tsx"), "utf8");
  for (const mot of ["\"incomplet\"", "\"complet\"", "\"au-delà\""]) {
    assert.ok(!legende.includes(mot), `MoisCharge.tsx écrit ${mot} en clair au lieu de lire MOT_ETAT`);
  }
});

essai("la phrase des salariés ne parle jamais d'équipes", () => {
  // Les deux compteurs sont côte à côte : les mélanger dans une phrase
  // remettrait dans sa tête la confusion qu'on vient de retirer du code.
  for (const n of [0, 1, 3, 20]) {
    assert.ok(!/[ÉE]quipe/i.test(phraseDesSalaries(n)), `phrase(${n}) parle d'équipes`);
  }
  assert.equal(phraseDesSalaries(0), "Seul : rien à cocher sur un chantier.");
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} Salariés, noms et charge — ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
