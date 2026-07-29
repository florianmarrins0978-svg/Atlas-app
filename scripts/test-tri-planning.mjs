// Test unitaire pur de trierParDatePlanifiee — aucune dépendance à mock-data.ts,
// aucun navigateur nécessaire. Les chantiers utilisés ici sont des fixtures
// locales au test, jamais ajoutées aux données de démonstration partagées.

import assert from "node:assert";
import { trierParDatePlanifiee } from "../src/lib/chantier-etat.ts";

const a = { id: "a", datePlanifiee: "2026-08-20" };
const b = { id: "b", datePlanifiee: "2026-08-05" };
const c = { id: "c", datePlanifiee: "2026-08-12" };
const sansDate = { id: "d" };

// --- Test 1 : ordre chronologique croissant ---
const resultat = trierParDatePlanifiee([a, b, c]);
assert.deepEqual(
  resultat.map((x) => x.id),
  ["b", "c", "a"],
  "Les chantiers doivent être triés du plus proche au plus lointain"
);

// --- Test 2 : un chantier sans date connue passe en dernier ---
const resultatAvecInconnu = trierParDatePlanifiee([a, sansDate, b]);
assert.deepEqual(
  resultatAvecInconnu.map((x) => x.id),
  ["b", "a", "d"],
  "Un chantier sans date doit être relégué en fin de liste, jamais en tête"
);

// --- Test 3 : ne mute pas le tableau d'origine ---
const original = [a, b, c];
trierParDatePlanifiee(original);
assert.deepEqual(
  original.map((x) => x.id),
  ["a", "b", "c"],
  "La fonction ne doit pas modifier le tableau reçu en entrée"
);

console.log("Tous les tests unitaires de tri sont passés (fixtures locales, aucune donnée partagée modifiée).");
