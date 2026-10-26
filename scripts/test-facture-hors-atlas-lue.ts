import assert from "node:assert/strict";
import { lireReponseFactureHorsAtlas } from "../src/lib/facture-hors-atlas-lue";

// LA FACTURE FAITE HORS D'ATLAS, LUE — ce que le modèle rend se relit ici, sans
// clé (`src/server/ai/services/lire-facture-hors-atlas.ts` fait l'appel).
//
// Ce qu'elle défend : un total ne se devine jamais. Une réponse bavarde, un
// total illisible ou absent rendent `null`, et l'écran le fait taper.

let passed = 0;
let failed = 0;
function test(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ ${nom}`);
    passed++;
  } catch (err) {
    console.error(`❌ ${nom}`);
    console.error(`   ${err instanceof Error ? err.message : err}`);
    failed++;
  }
}

test("le total imprimé se relit, à la française ou non", () => {
  assert.deepEqual(lireReponseFactureHorsAtlas('{"total_ttc": "1 728,00 €", "numero": "F-12"}'), { totalTtc: "1728.00", numero: "F-12" });
  assert.deepEqual(lireReponseFactureHorsAtlas('{"total_ttc": "864.5", "numero": null}'), { totalTtc: "864.50", numero: null });
});

test("une phrase autour du JSON ne gêne pas", () => {
  assert.equal(lireReponseFactureHorsAtlas('Voici : {"total_ttc": "120,00"} fin')?.totalTtc, "120.00");
});

test("un total absent ou illisible reste vide, jamais deviné", () => {
  assert.deepEqual(lireReponseFactureHorsAtlas('{"total_ttc": null}'), { totalTtc: null, numero: null });
  assert.deepEqual(lireReponseFactureHorsAtlas('{"total_ttc": "environ mille"}'), { totalTtc: null, numero: null });
  assert.equal(lireReponseFactureHorsAtlas("pas de JSON"), null);
  assert.equal(lireReponseFactureHorsAtlas("{cassé"), null);
});

test("un total négatif ou nul n'est pas un total de facture", () => {
  assert.equal(lireReponseFactureHorsAtlas('{"total_ttc": "0,00"}')?.totalTtc, null);
  assert.equal(lireReponseFactureHorsAtlas('{"total_ttc": "-50,00"}')?.totalTtc, null);
});

console.log(`\n${passed} réussi(s), ${failed} échoué(s)`);
if (failed > 0) process.exit(1);
