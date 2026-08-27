import assert from "node:assert/strict";
import { prestationCorrespondante, enrichissementPossible } from "../src/lib/correspondance-prestation";

// **Reconnaître la même prestation, et ne jamais écraser ce qui y est déjà.**
//
// Le doublon mesuré le 27 août 2026 : le patron rejoue sa dictée après avoir
// répondu aux questions de l'arrêt. Ses réponses ont allongé le libellé —
// « Abattage d'un érable » est devenu « Abattage d'un érable — démontage avec
// rétention, ⌀ 45 cm » —, l'égalité exacte ne correspondait plus, et une
// SECONDE prestation était créée pour le même arbre.
//
// Ces contrôles tiennent les deux bords : reconnaître l'enrichissement, et
// refuser tout rapprochement approximatif. Une fusion sur une ressemblance
// ferait disparaître un travail que l'artisan facturerait.

let reussites = 0;
let echecs = 0;
function cas(nom: string, verifier: () => void): void {
  try {
    verifier();
    console.log(`  ✓ ${nom}`);
    reussites++;
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

const p = (id: string, libelle: string, extra: Record<string, unknown> = {}) => ({ id, libelle, ...extra });

console.log("\n=== Reconnaître la même prestation ===\n");

cas("le libellé identique", () => {
  const trouve = prestationCorrespondante("Abattage d'un érable", [p("1", "Abattage d'un érable")]);
  assert.equal(trouve?.id, "1");
});

cas("le libellé enrichi par ses réponses — LE cas du doublon", () => {
  const trouve = prestationCorrespondante("Abattage d'un érable", [
    p("1", "Abattage d'un érable — démontage avec rétention, ⌀ 45 cm"),
  ]);
  assert.equal(trouve?.id, "1", "le rejeu créerait un doublon pour le même arbre");
});

cas("la casse et les espaces ne séparent pas deux fois le même travail", () => {
  assert.equal(prestationCorrespondante("  Taille de haie  ", [p("1", "taille de haie")])?.id, "1");
});

console.log("\n=== Refuser tout rapprochement approximatif ===\n");

cas("deux travaux différents ne fusionnent pas", () => {
  assert.equal(prestationCorrespondante("Abattage d'un érable", [p("1", "Abattage d'un chêne")]), null);
});

cas("un préfixe SANS le tiret d'enrichissement n'est pas la même prestation", () => {
  // « Taille de haie » et « Taille de haie de laurier » sont deux libellés que
  // l'artisan distingue : le second n'est pas un enrichissement du premier.
  assert.equal(prestationCorrespondante("Taille de haie", [p("1", "Taille de haie de laurier")]), null);
});

cas("un libellé plus COURT ne rapproche rien", () => {
  assert.equal(prestationCorrespondante("Abattage d'un érable — ⌀ 45 cm", [p("1", "Abattage d'un érable")]), null);
});

cas("un libellé vide ne rapproche rien", () => {
  assert.equal(prestationCorrespondante("   ", [p("1", "Abattage")]), null);
});

console.log("\n=== Enrichir un champ vide, jamais remplacer ===\n");

cas("un champ vide se remplit", () => {
  const e = enrichissementPossible(p("1", "Haie", { quantite: null, unite: null, aConfirmer: null }), {
    quantite: "800.00",
    unite: "ml",
    aConfirmer: false,
  });
  assert.deepEqual(e.aPoser, { quantite: "800.00", unite: "ml", aConfirmer: false });
  assert.deepEqual(e.contradictions, []);
});

cas("une valeur déjà posée n'est JAMAIS remplacée", () => {
  // C'est ce qui protège une correction humaine sans avoir à savoir qui l'a
  // écrite — le dépôt n'a aucune colonne de provenance.
  const e = enrichissementPossible(p("1", "Haie", { quantite: "80.00", unite: "ml", aConfirmer: false }), {
    quantite: "800.00",
    unite: "ml",
    aConfirmer: true,
  });
  assert.deepEqual(e.aPoser, {}, "une valeur existante a été écrasée");
});

cas("une valeur différente est signalée, pas appliquée", () => {
  const e = enrichissementPossible(p("1", "Haie", { quantite: "80.00", unite: "ml", aConfirmer: false }), {
    quantite: "800.00",
    unite: "ml",
    aConfirmer: false,
  });
  assert.equal(e.contradictions.length, 1);
  assert.match(e.contradictions[0], /80/);
  assert.match(e.contradictions[0], /800/);
});

cas("la même valeur ne produit ni écriture ni contradiction", () => {
  const e = enrichissementPossible(p("1", "Haie", { quantite: "800.00", unite: "ml", aConfirmer: false }), {
    quantite: "800.00",
    unite: "ml",
    aConfirmer: false,
  });
  assert.deepEqual(e.aPoser, {});
  assert.deepEqual(e.contradictions, []);
});

cas("une unité différente à quantité égale est aussi une contradiction", () => {
  // 800 ml et 800 m² ne sont pas le même chantier.
  const e = enrichissementPossible(p("1", "Haie", { quantite: "800.00", unite: "m²", aConfirmer: false }), {
    quantite: "800.00",
    unite: "ml",
    aConfirmer: false,
  });
  assert.equal(e.contradictions.length, 1);
});

cas("la quantité et l'unité vont ensemble, jamais l'une sans l'autre", () => {
  // La base l'exige, et une mesure sans son unité ne veut rien dire.
  const e = enrichissementPossible(p("1", "Haie", { quantite: null, unite: null, aConfirmer: null }), {
    quantite: "800.00",
    unite: null,
    aConfirmer: false,
  });
  assert.equal(e.aPoser.quantite, undefined);
  assert.equal(e.aPoser.unite, undefined);
});

cas("rien de nouveau : rien n'est posé", () => {
  const e = enrichissementPossible(p("1", "Haie", { quantite: null, unite: null, aConfirmer: false }), {
    quantite: null,
    unite: null,
    aConfirmer: false,
  });
  assert.deepEqual(e.aPoser, {});
});

console.log(`\n${reussites} réussite(s), ${echecs} échec(s).`);
if (echecs > 0) process.exitCode = 1;
