// LE SOMMAIRE DE « DEVIS & FACTURES » DIT CE QUE CHAQUE LIGNE PORTE — 26 octobre 2026.
//
// Sa planche des Réglages soignés (`appli/soignee/reglages-documents.html`) :
// « Validité 30 jours, acompte 30 % », « Trois messages », « Année et 6
// chiffres », « Votre logo, le doré ». Ce que cette suite tient : chaque phrase
// se CALCULE sur ses réglages, et aucune ne promet ce que le devis ne porte pas.
//
// Usage : npx tsx scripts/test-resume-devis-et-factures.ts
import assert from "node:assert/strict";
import { lireConditions } from "../src/lib/conditions-documents";
import { ALLURE_PAR_DEFAUT, TEINTES_ACCENT, TEINTES_FOND, teinteProposee } from "../src/lib/allure-documents";
import { FORMAT_PAR_DEFAUT } from "../src/lib/numero-documents";
import {
  resumeAllure,
  resumeConditions,
  resumeMessages,
  resumeNumero,
} from "../src/lib/resume-devis-et-factures";

let echecs = 0;
function cas(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

console.log("=== Le sommaire de Devis & factures ===\n");

cas("tout réglé : « Validité 30 jours, acompte 30 % », la ligne de sa planche", () => {
  const r = resumeConditions(lireConditions({ acomptePourcent: 30, delaiPaiementJours: 30 }), 0);
  assert.deepEqual(r, { texte: "Validité 30 jours, acompte 30 %", aFaire: false });
});

cas("la ligne suit SON réglage : quinze jours se disent quinze", () => {
  const r = resumeConditions(lireConditions({ validiteJours: 15 }), 0);
  assert.equal(r.texte, "Validité 15 jours");
});

cas("un crochet à remplir passe devant tout, en chose à faire", () => {
  assert.deepEqual(resumeConditions(lireConditions({ acomptePourcent: 30 }), 1), {
    texte: "1 crochet à remplir",
    aFaire: true,
  });
  assert.equal(resumeConditions(lireConditions({}), 2).texte, "2 crochets à remplir");
});

cas("validité éteinte, les conditions générales seules : la ligne ne dit pas « seulement »", () => {
  // C'est le mensonge que « Ce que votre devis dira » ne fait plus : le
  // sommaire ne doit pas le refaire un cran plus haut.
  const r = resumeConditions(lireConditions({ validiteJours: null, conditionsGenerales: "Mes conditions." }), 0);
  assert.equal(r.texte, "Conditions générales");
});

cas("tout éteint : les lignes et les totaux seulement", () => {
  const r = resumeConditions(lireConditions({ validiteJours: null, conditionsGenerales: "" }), 0);
  assert.equal(r.texte, "Les lignes et les totaux seulement");
});

cas("comptant se dit comptant", () => {
  const r = resumeConditions(lireConditions({ validiteJours: null, delaiPaiementJours: 0 }), 0);
  assert.equal(r.texte, "Comptant");
});

cas("trois messages, un par document", () => {
  assert.equal(resumeMessages(), "Trois messages");
});

cas("le numéro dit le nom du format, et le défaut sans réglage", () => {
  assert.equal(resumeNumero(null), "Année et 6 chiffres");
  assert.equal(resumeNumero(FORMAT_PAR_DEFAUT), "Année et 6 chiffres");
  assert.equal(resumeNumero("court"), "Année courte");
});

cas("l'allure : le logo, puis l'accent par son nom", () => {
  assert.equal(resumeAllure(true, ALLURE_PAR_DEFAUT.accent), "Votre logo, le doré");
  assert.equal(resumeAllure(false, ALLURE_PAR_DEFAUT.accent), "Sans logo, le doré");
  assert.equal(resumeAllure(true, "#6E2433"), "Votre logo, bordeaux");
  assert.equal(resumeAllure(true, "#123456"), "Votre logo, une autre couleur");
});

cas("le premier raccourci de chaque nuancier est le défaut de ses documents", () => {
  // Un raccourci « aujourd'hui » retapé finirait par désigner une teinte que
  // ses documents ne portent plus.
  assert.equal(TEINTES_FOND[0].teinte, ALLURE_PAR_DEFAUT.fond);
  assert.equal(TEINTES_ACCENT[0].teinte, ALLURE_PAR_DEFAUT.accent);
  assert.equal(teinteProposee(TEINTES_FOND, ALLURE_PAR_DEFAUT.fond.toUpperCase())?.nom, "Celui d'aujourd'hui");
  assert.equal(teinteProposee(TEINTES_FOND, "#010203"), null);
});

console.log(echecs === 0 ? "\n✅ Le sommaire dit ce que chaque ligne porte." : `\n❌ ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
