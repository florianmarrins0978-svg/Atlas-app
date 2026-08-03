import assert from "node:assert/strict";
import { peutPreparerDevis } from "../src/lib/preparation-devis";

// « Préparer le devis → » ne doit pas mener à un devis à 0,00 €.
//
// Ce que ce contrôle ferme : l'écran Prix affichait « Aucun prix proposable »
// puis « Aucune ligne pour l'instant », et laissait le bouton actif. Le patron
// pouvait valider un prix inexistant, arriver sur un devis vide, et l'envoyer.
// Un devis accepté est immuable — le corriger demande une nouvelle version.
//
// La règle est une fonction pure, employée par l'écran ET par l'action serveur
// (`CLAUDE.md` §3). Ce fichier l'éprouve sans base ni navigateur.

let echecs = 0;
function cas(nom: string, verifier: () => void) {
  try {
    verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

console.log("=== Préparer le devis : ce qui est refusé, et ce qui passe ===");

cas("aucune ligne : refusé", () => {
  const v = peutPreparerDevis([]);
  assert.equal(v.possible, false, "Un devis sans ligne partirait à 0,00 €.");
});

cas("aucune ligne : le refus dit quoi faire, pas seulement ce qui cloche", () => {
  const v = peutPreparerDevis([]);
  assert.ok(!v.possible);
  // Un message qui constate sans orienter se lit comme une panne. Les deux
  // issues réelles doivent y figurer : ajouter une ligne, ou enregistrer un tarif.
  assert.match(v.marcheASuivre, /ligne/i, "Le message n'indique pas d'ajouter une ligne.");
  assert.match(v.marcheASuivre, /tarif/i, "Le message n'indique pas d'enregistrer un tarif.");
  assert.ok(v.probleme.length > 0, "Le problème n'est pas énoncé.");
});

cas("des lignes qui totalisent zéro : refusé aussi", () => {
  // Le piège avec un visage rassurant : l'écran paraît rempli.
  const v = peutPreparerDevis([
    { libelle: "Élagage", montant: "0" },
    { libelle: "Broyage", montant: "0.00" },
  ]);
  assert.equal(v.possible, false, "Un total nul n'a rien à facturer.");
});

cas("un montant vide compte pour zéro, il ne fait pas planter", () => {
  const v = peutPreparerDevis([{ libelle: "Élagage", montant: "" }]);
  assert.equal(v.possible, false, "Une ligne au montant vide ne rend pas le devis préparable.");
});

cas("un montant négatif ne passe pas pour un devis valable", () => {
  const v = peutPreparerDevis([{ libelle: "Remise", montant: "-100" }]);
  assert.equal(v.possible, false, "Un total négatif n'est pas un devis.");
});

cas("une remise qui ne mange pas tout : accepté", () => {
  const v = peutPreparerDevis([
    { libelle: "Élagage", montant: "800" },
    { libelle: "Remise fidélité", montant: "-100" },
  ]);
  assert.equal(v.possible, true, "Un devis avec remise reste un devis.");
});

cas("une ligne chiffrée : accepté", () => {
  const v = peutPreparerDevis([{ libelle: "Élagage d'un tilleul", montant: "1400.00" }]);
  assert.equal(v.possible, true, "Un devis chiffré doit passer.");
});

cas("un libellé vide ne bloque pas — c'est au patron de juger", () => {
  // On ne bloque que ce qui produit un document faux. Une description
  // manquante se corrige encore sur l'écran du devis ; un total nul, non.
  const v = peutPreparerDevis([{ libelle: "", montant: "500" }]);
  assert.equal(v.possible, true, "Un libellé vide ne rend pas le devis impossible.");
});

cas("les centimes ne se perdent pas dans un flottant", () => {
  // Trois lignes qui, additionnées en `number`, ne tomberaient pas juste.
  const v = peutPreparerDevis([
    { libelle: "a", montant: "0.10" },
    { libelle: "b", montant: "0.20" },
    { libelle: "c", montant: "-0.30" },
  ]);
  assert.equal(v.possible, false, "0,10 + 0,20 − 0,30 vaut zéro : le devis est vide.");
});

if (echecs > 0) {
  console.error(`\n${echecs} contrôle(s) en échec.`);
  process.exit(1);
}
console.log("Tous les contrôles de préparation du devis sont passés.");
