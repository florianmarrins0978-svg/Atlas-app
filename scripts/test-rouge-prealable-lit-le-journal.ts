import assert from "node:assert/strict";
import { sortDUneSuite } from "./_rouge-prealable.mjs";
import { phraseDEchec, phraseDeCompte } from "./_bilan-suites.mjs";

/**
 * LE SORT D'UNE SUITE REJOUÉE SE LIT DANS LE JOURNAL ENTIER — 21 septembre 2026.
 *
 * **Le trou :** le moteur navigateur nomme ses rouges sur stderr et compte sur
 * stdout ; la comparaison ne lisait que stdout, et une suite rouge y passait
 * pour verte — des deux côtés, donc « pareil », donc tolérée. Une régression
 * NOUVELLE serait passée par cette porte. Ces cas montrent à la fonction
 * exactement ce que l'ancienne lecture voyait, et exigent qu'elle refuse de
 * conclure plutôt que de dire vert.
 */

let echecs = 0;
function cas(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

const SUITE = "test-recherche-client-e2e.ts";
const rouge = phraseDEchec(SUITE, "code: 1");
const compteRouge = phraseDeCompte(0, 1);
const compteVert = phraseDeCompte(1, 1);

console.log("=== Le sort d'une suite rejouée, lu dans les deux flux ===\n");

cas("LE TROU : le rouge sur stderr, le compte sur stdout — c'est ROUGE, pas vert", () => {
  assert.equal(
    sortDUneSuite({ suite: SUITE, estNavigateur: true, status: 1, stdout: `=== ${SUITE} ===\n${compteRouge}\n`, stderr: `${rouge}\n` }),
    "rouge"
  );
});

cas("ce que l'ancienne lecture voyait — stdout seul — ne peut PAS valoir vert", () => {
  // Le compte annonce un échec que rien ne nomme : le bilan est incomplet, et
  // ne pas savoir n'est jamais vert.
  assert.equal(
    sortDUneSuite({ suite: SUITE, estNavigateur: true, status: 1, stdout: `${compteRouge}\n`, stderr: "" }),
    "indetermine"
  );
});

cas("une suite verte, sortie à zéro, est verte", () => {
  assert.equal(
    sortDUneSuite({ suite: SUITE, estNavigateur: true, status: 0, stdout: `=== ${SUITE} ===\n  ✓ tout\n${compteVert}\n`, stderr: "" }),
    "vert"
  );
});

cas("tué ou jamais lancé — statut absent — ne conclut pas", () => {
  assert.equal(sortDUneSuite({ suite: SUITE, estNavigateur: true, status: null, stdout: compteVert }), "indetermine");
  assert.equal(sortDUneSuite({ suite: SUITE, estNavigateur: true, status: undefined }), "indetermine");
});

cas("un moteur qui sort en erreur sans nommer la suite a cassé ailleurs — on ne conclut pas", () => {
  assert.equal(
    sortDUneSuite({ suite: SUITE, estNavigateur: true, status: 1, stdout: `${compteVert}\n`, stderr: "Variable d'environnement obligatoire manquante : DATABASE_URL\n" }),
    "indetermine"
  );
});

cas("un moteur qui n'a joué AUCUNE suite ne prouve rien", () => {
  assert.equal(sortDUneSuite({ suite: SUITE, estNavigateur: true, status: 0, stdout: "⚠ Filtre : 0 suite(s) retenue(s).\n" }), "indetermine");
});

cas("une suite de dépôt se lit à son code de sortie", () => {
  assert.equal(sortDUneSuite({ suite: "test-x.ts", estNavigateur: false, status: 0 }), "vert");
  assert.equal(sortDUneSuite({ suite: "test-x.ts", estNavigateur: false, status: 1 }), "rouge");
  assert.equal(sortDUneSuite({ suite: "test-x.ts", estNavigateur: false, status: null }), "indetermine");
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} La lecture d'une suite rejouée — ${echecs} échec(s).`);
if (echecs > 0) process.exit(1);
