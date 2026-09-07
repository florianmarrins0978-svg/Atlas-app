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
console.log("\n=== Une ligne « à chiffrer » n'est pas un devis prêt ===\n");

// Sa demande du 27 août 2026 : *« le devis ne doit pas pouvoir être considéré
// comme prêt à envoyer tant qu'une ligne nécessitant un prix n'est pas
// chiffrée. »* Avant, ces lignes-là valaient 0 € : le total paraissait correct,
// le devis partait, et le client lisait un travail à zéro euro.

cas("un travail qui attend son prix arrête le devis", () => {
  const v = peutPreparerDevis([
    { libelle: "Abattage d'un chêne", montant: "840" },
    { libelle: "Tonte de la pelouse", montant: "0", aChiffrer: true },
  ]);
  assert.equal(v.possible, false, "un devis est parti avec une ligne non chiffrée");
  if (v.possible) return;
  assert.match(v.probleme, /Tonte/, `la ligne en cause n'est pas nommée : ${v.probleme}`);
  assert.match(v.probleme, /gratuit/i, "rien ne dit que ce n'est pas un prix");
});

cas("plusieurs lignes en attente sont toutes nommées", () => {
  const v = peutPreparerDevis([
    { libelle: "Abattage d'un chêne", montant: "840" },
    { libelle: "Tonte", montant: "0", aChiffrer: true },
    { libelle: "Haie", montant: "0", aChiffrer: true },
  ]);
  assert.equal(v.possible, false);
  if (v.possible) return;
  assert.match(v.probleme, /Tonte/);
  assert.match(v.probleme, /Haie/);
});

cas("une ligne qui a REÇU son prix ne bloque plus rien", () => {
  // L'autre sens : le garde-fou ne doit pas se refermer sur un devis complet.
  const v = peutPreparerDevis([
    { libelle: "Abattage d'un chêne", montant: "840", aChiffrer: false },
    { libelle: "Tonte de la pelouse", montant: "200", aChiffrer: false },
  ]);
  assert.equal(v.possible, true);
});

cas("les lignes d'AVANT, qui ne portent pas l'état, passent comme avant", () => {
  // Aucune ligne écrite avant le 27 août ne porte ce drapeau. Le traiter comme
  // « à chiffrer » bloquerait d'un coup tous ses devis en cours.
  const v = peutPreparerDevis([{ libelle: "Élagage d'un tilleul", montant: "1400.00" }]);
  assert.equal(v.possible, true);
});

cas("le message ne nomme qu'un travail par ligne empilée", () => {
  // Une ligne réunit « Abattage / Broyage / Évacuation » : les trois dans le
  // message rendraient la phrase illisible sur un téléphone.
  const v = peutPreparerDevis([
    { libelle: "Abattage d'un chêne\nBroyage des branches", montant: "0", aChiffrer: true },
    { libelle: "Haie", montant: "500" },
  ]);
  assert.equal(v.possible, false);
  if (v.possible) return;
  assert.doesNotMatch(v.probleme, /Broyage/, `le message empile tout : ${v.probleme}`);
});

cas("un drapeau resté levé sur une ligne CHIFFRÉE ne bloque plus", () => {
  // ═════════════════════════════════════════════════════════════════════════
  // **Le cas exact de sa capture du 31 août 2026.** Deux lignes marquées « à
  // chiffrer » portaient 1 720 € posés de sa main ; le devis restait bloqué,
  // et le PDF affichait « à chiffrer » en face de montants que le total
  // comptait pourtant.
  //
  // L'invariant : un montant posé RÉPOND à la question. C'est sûr parce que
  // les deux seuls chemins qui lèvent le drapeau écrivent « 0 » avec lui —
  // aucun prix deviné ne peut donc passer par cette porte.
  //
  // **Effet de bord voulu :** les devis déjà bloqués dans sa base se rouvrent
  // sans qu'il ait à retaper quoi que ce soit.
  // ═════════════════════════════════════════════════════════════════════════
  const v = peutPreparerDevis([
    { libelle: "Dessouchage", montant: "1720.00", aChiffrer: true },
    { libelle: "Démontage en rétention d'un érable", montant: "560.00" },
  ]);
  assert.equal(v.possible, true, v.possible ? "" : `bloqué à tort : ${v.probleme}`);
});

cas("un montant à ZÉRO sous le drapeau bloque toujours", () => {
  // L'assouplissement ci-dessus ne doit pas emporter la règle du 27 août : une
  // ligne sans prix n'est pas une ligne gratuite.
  const v = peutPreparerDevis([
    { libelle: "Abattage", montant: "840" },
    { libelle: "Tonte de la pelouse", montant: "0.00", aChiffrer: true },
  ]);
  assert.equal(v.possible, false, "une ligne réellement non chiffrée est passée");
});

cas("un montant NÉGATIF ne compte pas pour un prix posé", () => {
  // Une remise saisie en négatif ne répond pas à « combien vaut ce travail ».
  // Le contrôle lit « strictement positif », jamais « différent de zéro ».
  const v = peutPreparerDevis([
    { libelle: "Abattage", montant: "840" },
    { libelle: "Tonte", montant: "-50.00", aChiffrer: true },
  ]);
  assert.equal(v.possible, false, "un montant négatif a été pris pour un prix");
});

console.log("Tous les contrôles de préparation du devis sont passés.");
