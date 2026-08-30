// CE QUE LE PATRON LIT EST CE QUI SERA ÉCRIT.
//
// ═══════════════════════════════════════════════════════════════════════════
// **LE DÉFAUT D'INTÉGRITÉ QUE CETTE SUITE FERME** — lot de clôture,
// 29 août 2026.
//
// Une proposition de l'assistant portait deux choses composées par le modèle et
// jamais confrontées : la `description` AFFICHÉE, et les `donnees` ÉCRITES. Un
// modèle maladroit — ou dérivé par une injection dans un libellé de devis —
// pouvait annoncer « Tonte — 120 € » et faire écrire 1 200 €.
//
// Le patron cochait ce qu'il lisait ; ce qui s'écrivait était autre chose. Sur
// un devis qui part chez un client.
//
// **La correction ne DÉTECTE pas l'écart : elle le rend impossible.** La phrase
// est recomposée à partir de `donnees`, donc les deux sortent du même endroit.
//
// Cette suite éprouve la recomposition. Ni base, ni réseau : une fonction pure.

import assert from "node:assert/strict";
import { decrireProposition } from "../src/lib/decrire-proposition";

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

console.log("=== La description se recalcule ===\n");

essai("LE MONTANT ÉCRIT EST CELUI QUI S'AFFICHE — c'est tout l'objet", () => {
  // Le cas exact du défaut : le modèle annonçait 120 € et faisait écrire 1200.
  // La phrase ne peut plus mentir, puisqu'elle sort de `donnees`.
  const phrase = decrireProposition("ajouter_ligne_prix", { libelle: "Tonte", montant: "1200" });
  assert.match(phrase, /1200/, `le montant écrit n'apparaît pas : « ${phrase} »`);
  assert.doesNotMatch(phrase, /\b120\b(?!0)/, "un montant qui n'est pas celui de donnees apparaît");
});

essai("le montant porte son unité — « 1200 » et « 1200 € » ne se lisent pas pareil", () => {
  const phrase = decrireProposition("ajouter_ligne_prix", { libelle: "Tonte", montant: "1200" });
  assert.match(phrase, /1200 €/, `« ${phrase} »`);
});

essai("la phrase nomme le geste, en français", () => {
  assert.match(decrireProposition("supprimer_prestation", { libelle: "Élagage" }), /^Supprimer la prestation/);
  assert.match(decrireProposition("creer_chantier", { client: "Mme Dupont" }), /^Ouvrir un chantier/);
  assert.match(decrireProposition("modifier_client", { nom: "Martin" }), /^Corriger la fiche du client/);
});

essai("un geste SANS champ décisif se décrit quand même", () => {
  // Retirer du planning ne porte qu'un identifiant : la phrase doit rester
  // exacte plutôt que vide. Un libellé vide ferait cocher à l'aveugle.
  const phrase = decrireProposition("retirer_du_planning", { chantierId: "abc-123" });
  assert.equal(phrase, "Retirer du planning");
  assert.ok(phrase.length > 0);
});

essai("les identifiants techniques n'entrent PAS dans la phrase", () => {
  // Ils ne veulent rien dire pour lui, et ils rendraient illisible la phrase
  // qu'il doit lire entre deux chantiers. Ils restent dans `donnees`, qui fait foi.
  const phrase = decrireProposition("ajouter_ligne_prix", {
    libelle: "Tonte",
    montant: "45",
    tarifId: "7f3c9b21-0000-4000-8000-000000000000",
    chantierId: "aaaa-bbbb",
  });
  assert.doesNotMatch(phrase, /7f3c9b21|aaaa-bbbb/, `un identifiant est affiché : « ${phrase} »`);
  assert.match(phrase, /Tonte/);
});

essai("UNE VALEUR TRÈS LONGUE EST COUPÉE — la phrase doit tenir sur un téléphone", () => {
  // Et c'est aussi une défense : un libellé de deux mille caractères noierait
  // le montant, et le patron cocherait sans avoir lu ce qui compte.
  const phrase = decrireProposition("ajouter_prestation", { libelle: "x".repeat(500) });
  assert.ok(phrase.length < 200, `la phrase fait ${phrase.length} caractères`);
  assert.match(phrase, /…/, "la coupure ne se voit pas");
});

essai("une donnée absente ou vide n'invente rien", () => {
  const phrase = decrireProposition("ajouter_prestation", { libelle: "", montant: null, nom: undefined });
  assert.equal(phrase, "Ajouter la prestation", `« ${phrase} »`);
});

essai("un type inconnu ne casse pas — il se lit tel quel", () => {
  // Un type ajouté demain sans passer par ce fichier doit rendre une phrase
  // approximative, jamais une exception : une proposition qui lève ne
  // s'enregistre pas, et le patron perd le travail de l'assistant.
  const phrase = decrireProposition("geste_invente_demain", { libelle: "Quelque chose" });
  assert.match(phrase, /geste invente demain/);
  assert.match(phrase, /Quelque chose/);
});

essai("DEUX PROPOSITIONS QUI ÉCRIVENT AUTREMENT SE LISENT AUTREMENT", () => {
  // Le contrôle qui compte : si deux `donnees` différentes rendaient la même
  // phrase, l'écart redeviendrait invisible.
  const a = decrireProposition("ajouter_ligne_prix", { libelle: "Tonte", montant: "120" });
  const b = decrireProposition("ajouter_ligne_prix", { libelle: "Tonte", montant: "1200" });
  assert.notEqual(a, b, "deux montants différents rendent la même phrase");
});

console.log("");
console.log(`${echecs === 0 ? "✅" : "❌"} Description recalculée — ${echecs} échec(s).`);
process.exit(echecs > 0 ? 1 : 0);
