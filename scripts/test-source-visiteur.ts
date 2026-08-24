// D'où vient une requête — et le contournement que ce contrôle ferme.
//
// **CE QUE CETTE SUITE PROTÈGE.** Avant le 23 août 2026, la limitation des
// tentatives de connexion prenait la PREMIÈRE valeur de `x-forwarded-for` —
// un en-tête que celui qui frappe écrit lui-même. Il suffisait donc de le
// changer à chaque essai pour repartir d'un compteur neuf : le seuil « cinq
// tentatives par quart d'heure » n'existait pas.
//
// **Le premier cas ci-dessous rougirait sur l'ancien code**, et c'est ce qui
// fait de cette suite autre chose qu'une décoration : elle est écrite contre le
// défaut réel, pas contre l'idée qu'on s'en fait (`AGENTS.md`).
//
// Éprouvée SANS requête HTTP : ce sont des règles pures.

import assert from "node:assert/strict";
import { SOURCE_NON_ETABLIE, sourceDepuisEntetes } from "../src/lib/source-visiteur";

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

console.log("=== La source d'une requête : ce qu'on croit, et ce qu'on sait ===\n");

// ─── L'attaque, telle que l'audit la décrit ────────────────────────────────

essai("SANS mandataire déclaré, une adresse inventée ne change RIEN au seau", () => {
  const seaux = new Set<string>();
  // Ce que ferait l'attaquant : une adresse différente à chaque essai.
  for (let i = 0; i < 50; i++) {
    seaux.add(sourceDepuisEntetes({ xff: `10.0.0.${i}`, sauts: 0 }));
  }
  assert.equal(seaux.size, 1, "cinquante adresses inventées ont donné plusieurs seaux");
  assert.equal([...seaux][0], SOURCE_NON_ETABLIE);
});

essai("…et il ne peut pas non plus se fabriquer un seau en allongeant la liste", () => {
  const seaux = new Set<string>();
  for (let i = 0; i < 20; i++) {
    // Chaînes de longueurs variables, valeurs variables : rien n'y fait.
    seaux.add(sourceDepuisEntetes({ xff: Array.from({ length: i + 1 }, (_, j) => `1.2.3.${j}`).join(", "), sauts: 0 }));
  }
  assert.equal(seaux.size, 1);
});

// ─── Avec un mandataire déclaré, on lit la BONNE valeur ─────────────────────

essai("un mandataire de confiance : c'est la DERNIÈRE valeur qui fait foi", () => {
  // Ce que l'attaquant a écrit est à gauche ; ce que notre mandataire a
  // constaté est à droite. Prendre la première, c'était le croire lui.
  assert.equal(
    sourceDepuisEntetes({ xff: "203.0.113.9, 198.51.100.4", sauts: 1 }),
    "ip:198.51.100.4"
  );
});

essai("deux mandataires chaînés : c'est l'avant-dernière", () => {
  assert.equal(
    sourceDepuisEntetes({ xff: "203.0.113.9, 198.51.100.4, 192.0.2.7", sauts: 2 }),
    "ip:198.51.100.4"
  );
});

essai("l'attaquant a beau allonger la liste, la position lue reste la sienne", () => {
  // Il ajoute dix adresses à gauche : notre mandataire ajoutera toujours la
  // sienne à droite, et c'est celle-là qu'on lit.
  const bruit = Array.from({ length: 10 }, (_, i) => `10.0.0.${i}`).join(", ");
  assert.equal(
    sourceDepuisEntetes({ xff: `${bruit}, 198.51.100.4`, sauts: 1 }),
    "ip:198.51.100.4"
  );
});

// ─── Les cas où l'on refuse de conclure ─────────────────────────────────────

essai("une chaîne plus courte que les mandataires annoncés ne rend RIEN", () => {
  // C'est par là qu'on entrerait : annoncer deux mandataires et n'envoyer
  // qu'une valeur ferait lire celle de l'attaquant si l'on comptait mal.
  assert.equal(sourceDepuisEntetes({ xff: "203.0.113.9", sauts: 2 }), SOURCE_NON_ETABLIE);
});

essai("aucun en-tête du tout : un seau commun, jamais une erreur", () => {
  assert.equal(sourceDepuisEntetes({ xff: null, sauts: 1 }), SOURCE_NON_ETABLIE);
  assert.equal(sourceDepuisEntetes({ xff: undefined, sauts: 0 }), SOURCE_NON_ETABLIE);
  assert.equal(sourceDepuisEntetes({ xff: "", sauts: 1 }), SOURCE_NON_ETABLIE);
  assert.equal(sourceDepuisEntetes({ xff: "   ,  , ", sauts: 1 }), SOURCE_NON_ETABLIE);
});

essai("un réglage absurde ne devient jamais une confiance", () => {
  assert.equal(sourceDepuisEntetes({ xff: "203.0.113.9", sauts: -1 }), SOURCE_NON_ETABLIE);
  assert.equal(sourceDepuisEntetes({ xff: "203.0.113.9", sauts: Number.NaN }), SOURCE_NON_ETABLIE);
});

// ─── La moitié qui protège le BANC — la panne du 6 août 2026 ────────────────
//
// Ce jour-là, les parents du patron ont lu « mot de passe incorrect » avec le
// bon mot de passe : le compteur était tenu par e-mail seul, le banc partage un
// compte unique, et les essais des uns bloquaient les autres. La correction
// d'alors distinguait les visiteurs par leur adresse.
//
// **Sans ces cas, ce lot défaisait cette correction** : hors production, tout
// le monde serait retombé dans le même seau. Le remède aurait recréé la panne.

essai("HORS PRODUCTION, les visiteurs se distinguent encore", () => {
  const a = sourceDepuisEntetes({ xff: "203.0.113.9", sauts: 0, horsProduction: true });
  const b = sourceDepuisEntetes({ xff: "203.0.113.10", sauts: 0, horsProduction: true });
  assert.notEqual(a, b, "deux visiteurs du banc partagent le même seau");
  assert.notEqual(a, SOURCE_NON_ETABLIE);
});

essai("…mais la valeur DIT qu'elle n'est pas vérifiée", () => {
  // Pour qu'on ne la prenne jamais pour une adresse établie en lisant un
  // journal — c'est la même exigence que « nommer le bon coupable ».
  assert.match(sourceDepuisEntetes({ xff: "203.0.113.9", sauts: 0, horsProduction: true }), /^essai:/);
  assert.match(sourceDepuisEntetes({ xff: "203.0.113.9, 198.51.100.4", sauts: 1 }), /^ip:/);
});

essai("EN PRODUCTION, la tolérance n'existe pas", () => {
  const seaux = new Set<string>();
  for (let i = 0; i < 20; i++) {
    seaux.add(sourceDepuisEntetes({ xff: `10.0.0.${i}`, sauts: 0, horsProduction: false }));
  }
  assert.equal(seaux.size, 1, "la tolérance du banc s'applique en production");
  assert.equal([...seaux][0], SOURCE_NON_ETABLIE);
});

essai("un mandataire déclaré l'emporte sur la tolérance, même hors production", () => {
  assert.equal(
    sourceDepuisEntetes({ xff: "203.0.113.9, 198.51.100.4", sauts: 1, horsProduction: true }),
    "ip:198.51.100.4"
  );
});

console.log("");
console.log(`La source d'une requête — ${echecs} échec(s).`);
process.exit(echecs > 0 ? 1 : 0);
