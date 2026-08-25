import assert from "node:assert/strict";
import { lireReponseAllure, typographieDepuisNom } from "../src/server/ai/services/lire-allure-devis";

// Ce que le modèle répond quand il regarde la photo d'un devis, et ce qu'on en
// tire pour l'allure. **C'est ici que vivent les pièges**, pas dans l'appel
// réseau : un modèle qui rend une couleur mal écrite, une police qu'il croit
// reconnaître, un acompte à 300 %, ou qui entoure son objet d'une phrase.
//
// **L'appel au fournisseur de vision n'est PAS éprouvé ici** (aucune clé) : il
// se prouve sur le banc du patron, avec un vrai devis, comme la dictée.

let echecs = 0;
function cas(nom: string, f: () => void) {
  try {
    f();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

console.log("=== Lire l'allure d'un devis photographié ===\n");

const BON = `{"fond":"#FAF9F5","accent":"#2F3B2F","police":{"empattements":true,"nom":"EB Garamond"},"conditions":{"validite_jours":30,"acompte_pourcent":30,"delai_paiement_jours":45,"moyens_paiement":"Virement, chèque","penalites":true,"pied":"Bien à vous, Eden Nature"}}`;

cas("un objet propre se lit entièrement", () => {
  const r = lireReponseAllure(BON);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.allure.fond, "#faf9f5");
  assert.equal(r.allure.accent, "#2f3b2f");
  assert.equal(r.allure.typographie, "eb-garamond");
  assert.equal(r.allure.conditions.validiteJours, 30);
  assert.equal(r.allure.conditions.acomptePourcent, "30");
  assert.equal(r.allure.conditions.delaiPaiementJours, 45);
  assert.equal(r.allure.conditions.moyensPaiement, "Virement, chèque");
  assert.equal(r.allure.conditions.rappelerPenalites, true);
  assert.equal(r.allure.conditions.textePied, "Bien à vous, Eden Nature");
});

cas("le logo est TOUJOURS annoncé comme non repris", () => {
  const r = lireReponseAllure(BON);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.ok(r.allure.reserve && /logo/i.test(r.allure.reserve), `réserve : ${r.allure.reserve}`);
});

cas("une police non reconnue ne pose AUCUNE typographie, et se dit", () => {
  const r = lireReponseAllure(
    `{"fond":"#ffffff","accent":"#333333","police":{"empattements":false,"nom":"une linéale quelconque"},"conditions":{}}`
  );
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.allure.typographie, null);
  assert.ok(r.allure.reserve && /police/i.test(r.allure.reserve), `réserve : ${r.allure.reserve}`);
});

cas("une couleur mal écrite vaut null, pas une couleur au hasard", () => {
  const r = lireReponseAllure(`{"fond":"bleu clair","accent":"#2f3b2f","police":{"nom":null},"conditions":{}}`);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.allure.fond, null);
  assert.equal(r.allure.accent, "#2f3b2f");
});

cas("aucune couleur lisible se dit en réserve", () => {
  const r = lireReponseAllure(`{"fond":null,"accent":null,"police":{"nom":"Inter"},"conditions":{}}`);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.ok(r.allure.reserve && /couleur/i.test(r.allure.reserve), `réserve : ${r.allure.reserve}`);
});

cas("un acompte hors bornes tombe (300 % n'existe pas)", () => {
  const r = lireReponseAllure(`{"fond":"#ffffff","accent":"#000000","police":{"nom":"Inter"},"conditions":{"acompte_pourcent":300}}`);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.allure.conditions.acomptePourcent, null);
});

cas("un texte sans objet JSON est refusé proprement", () => {
  const r = lireReponseAllure("Je n'ai pas réussi à lire ce document.");
  assert.equal(r.ok, false);
});

cas("le modèle qui entoure son objet d'une phrase est quand même lu", () => {
  const r = lireReponseAllure(`Voici : {"fond":"#ffffff","accent":"#000000","police":{"nom":"Lato"},"conditions":{}} — voilà.`);
  assert.equal(r.ok, true);
  if (!r.ok) return;
  assert.equal(r.allure.typographie, "lato");
});

console.log("\n=== Rapprocher une police d'une des neuf ===\n");

cas("un nom exact est reconnu", () => {
  assert.equal(typographieDepuisNom("Playfair Display"), "playfair");
  assert.equal(typographieDepuisNom("inter"), "inter");
});

cas("un nom partiel plausible est reconnu", () => {
  assert.equal(typographieDepuisNom("Garamond"), "eb-garamond");
  assert.equal(typographieDepuisNom("Playfair"), "playfair");
});

cas("un genre seul (« serif ») n'est PAS une police : null", () => {
  assert.equal(typographieDepuisNom("serif"), null);
  assert.equal(typographieDepuisNom("une police avec empattements"), null);
  assert.equal(typographieDepuisNom(null), null);
});

if (echecs > 0) {
  console.error(`\n❌ ${echecs} échec(s).`);
  process.exit(1);
}
console.log("\n✅ Lecture d'allure — 0 échec(s).");
