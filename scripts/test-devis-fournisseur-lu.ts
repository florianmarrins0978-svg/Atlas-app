import assert from "node:assert/strict";
import { lireReponseDevisFournisseur, sourceDuDevisLu } from "../src/lib/devis-fournisseur-lu";

// La relecture d'un devis reçu (`src/lib/devis-fournisseur-lu.ts`) : rien ne se
// devine, une ligne sans prix lisible n'est pas proposée.

let passed = 0;
let failed = 0;
function test(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ ${nom}`);
    passed++;
  } catch (err) {
    console.error(`❌ ${nom}\n   ${err instanceof Error ? err.message : err}`);
    failed++;
  }
}

test("les lignes lues, leur unité, et la remise de la ligne déduite", () => {
  const lu = lireReponseDevisFournisseur(
    'Voici : {"lignes":[{"designation":"Turbine 3504","reference":"RA3504","quantite":"9","unite":"U","prix_unitaire_ht":"12,40","remise_pourcent":"10"},' +
      '{"designation":"Sac de ciment 35 kg","reference":null,"quantite":"3","unite":"sac","prix_unitaire_ht":"8.00","remise_pourcent":null}]}',
    "fournisseur"
  );
  assert.deepEqual(lu, {
    lignes: [
      { designation: "Turbine 3504", reference: "RA3504", quantite: "9", unite: "pièce", prixHt: "11.16" },
      { designation: "Sac de ciment 35 kg", reference: null, quantite: "3", unite: "sac", prixHt: "8.00" },
    ],
    ecartees: 0,
  });
});

test("une ligne sans prix ou sans désignation est écartée, jamais complétée", () => {
  const lu = lireReponseDevisFournisseur(
    '{"lignes":[{"designation":"Coude","prix_unitaire_ht":null},{"designation":null,"prix_unitaire_ht":"3"},{"designation":"Té","prix_unitaire_ht":"abc"}]}',
    "fournisseur"
  );
  assert.deepEqual(lu, { lignes: [], ecartees: 3 });
});

test("une unité qui n'est pas de la rubrique prend la première de la rubrique", () => {
  const lu = lireReponseDevisFournisseur('{"lignes":[{"designation":"Pose","unite":"sac","prix_unitaire_ht":"40"}]}', "partenaire");
  assert.equal(lu?.lignes[0].unite, "heure");
});

test("une réponse illisible ne rend rien", () => {
  assert.equal(lireReponseDevisFournisseur("pas de JSON", "fournisseur"), null);
  assert.equal(lireReponseDevisFournisseur("{pas: du json}", "fournisseur"), null);
  assert.equal(lireReponseDevisFournisseur('{"autre":1}', "fournisseur"), null);
});

test("la source d'un prix lu nomme le devis et sa date", () => {
  assert.equal(sourceDuDevisLu("Haie Durand", "2026-10-12"), "Lu sur le devis « Haie Durand » du 12/10/2026");
});

console.log(`\n${passed} test(s) réussi(s), ${failed} échoué(s).`);
if (failed > 0) process.exit(1);
