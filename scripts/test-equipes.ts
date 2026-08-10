// La règle de nommage des équipes, sans base de données.
//
// **Ce que le patron a demandé, le 2026-08-10 :** *« soit équipe A équipe B,
// soit des noms et prénoms. Mais s'il n'a pas d'équipe et qu'il ne met rien, il
// ne faut pas qu'il y ait quand même écrit équipe A équipe B. »*
//
// Le principe qui tient les deux cas : **on n'invente jamais un nom, et on ne
// laisse jamais deux lignes indiscernables.**

import assert from "node:assert/strict";
import {
  libelleEquipe,
  lettreDeRepli,
  equipesAffichees,
  phraseDuCompteur,
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

console.log("=== Nommer les équipes — et se taire quand il n'y a personne ===");

essai("seul, on n'écrit RIEN — pas même la lettre", () => {
  assert.equal(libelleEquipe({ rang: 1, nom: null }, 1), null);
  // Et même si un nom traîne en base : à une équipe il n'y a personne à
  // distinguer. Le cas arrive dès qu'on redescend le compteur après avoir
  // nommé — la ligne survit exprès, elle ne doit pas se mettre à parler.
  assert.equal(libelleEquipe({ rang: 1, nom: "Théo" }, 1), null);
});

essai("à deux et sans nom, on lit « Équipe A » et « Équipe B »", () => {
  assert.equal(libelleEquipe({ rang: 1, nom: null }, 2), "Équipe A");
  assert.equal(libelleEquipe({ rang: 2, nom: null }, 2), "Équipe B");
});

essai("nommer l'une n'oblige pas l'autre", () => {
  assert.equal(libelleEquipe({ rang: 1, nom: "Théo" }, 2), "Théo");
  assert.equal(libelleEquipe({ rang: 2, nom: null }, 2), "Équipe B");
});

essai("un champ blanc n'est pas un nom", () => {
  // Sinon la ligne s'affiche vide, indiscernable de sa voisine — exactement ce
  // que le repli existe pour empêcher.
  assert.equal(libelleEquipe({ rang: 2, nom: "   " }, 2), "Équipe B");
  assert.equal(libelleEquipe({ rang: 1, nom: "" }, 3), "Équipe A");
});

essai("un nom écrit garde ses espaces intérieurs, perd celles des bords", () => {
  assert.equal(libelleEquipe({ rang: 1, nom: "  Jean Dupont  " }, 2), "Jean Dupont");
});

essai("vingt équipes, vingt lettres — et rien au-delà", () => {
  assert.equal(MAX_EQUIPES, 20);
  assert.equal(lettreDeRepli(1), "A");
  assert.equal(lettreDeRepli(20), "T");
  assert.equal(lettreDeRepli(21), null);
  assert.equal(libelleEquipe({ rang: 21, nom: null }, 20), null);
});

essai("une équipe absente de la base existe quand même à l'écran", () => {
  // Le patron peut avoir nommé la troisième sans toucher la deuxième.
  const lignes = equipesAffichees([{ rang: 3, nom: "Nadia" }], 3);
  assert.deepEqual(
    lignes.map((e) => libelleEquipe(e, 3)),
    ["Équipe A", "Équipe B", "Nadia"]
  );
});

essai("une ligne au-delà du compteur ne se montre pas — mais elle survit", () => {
  // `entreprises.nombre_equipes` fait autorité sur le NOMBRE ; la table ne
  // porte que des noms. Redescendre puis remonter ne doit pas perdre un nom
  // saisi à la main.
  const enBase = [
    { rang: 1, nom: "Théo" },
    { rang: 2, nom: null },
    { rang: 3, nom: "Nadia" },
  ];
  assert.deepEqual(
    equipesAffichees(enBase, 2).map((e) => libelleEquipe(e, 2)),
    ["Théo", "Équipe B"]
  );
  // Remontée : le nom de la troisième est toujours là.
  assert.deepEqual(
    equipesAffichees(enBase, 3).map((e) => libelleEquipe(e, 3)),
    ["Théo", "Équipe B", "Nadia"]
  );
});

essai("un compteur aberrant ne fabrique pas de nom", () => {
  assert.equal(libelleEquipe({ rang: 1, nom: null }, 0), null);
  assert.equal(libelleEquipe({ rang: 1, nom: null }, Number.NaN), null);
  assert.equal(equipesAffichees([], 0).length, 1);
  assert.equal(equipesAffichees([], 99).length, MAX_EQUIPES);
});

essai("la phrase du compteur ne contient aucun mot de métier", () => {
  // « chantiers de front » a été soumis au patron et rejeté : « pour moi rien ».
  assert.equal(phraseDuCompteur(1), "Un chantier à la fois : un jour pris n'est plus proposé.");
  assert.equal(phraseDuCompteur(2), "Un jour reste proposé tant qu'une équipe est libre.");
  for (const n of [1, 2, 7, 20]) {
    assert.ok(!/de front|effectif|ressource/i.test(phraseDuCompteur(n)), `phrase(${n}) emploie un mot de métier`);
  }
});

essai("aucune équipe transmise : on n'écrit rien plutôt que d'inventer", () => {
  assert.equal(libelleEquipe(null, 3), null);
  assert.equal(libelleEquipe(undefined, 3), null);
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} Nommage des équipes — ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
