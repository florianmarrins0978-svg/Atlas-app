import assert from "node:assert/strict";
import { quantiteCommerciale, prevenirQuantiteNonMultipliee } from "../src/lib/quantite-commerciale";

// **La quantité PHYSIQUE et la quantité COMMERCIALE ne se synchronisent pas.**
//
// Le devis du 26 août 2026 portait « Haie (tout genre) (800 ml) — Qté 1 —
// 14 000 € ». Le total était juste, sa décomposition mentait : le « 1 » n'était
// pas un forfait décidé, c'était une colonne que ce chemin ne renseignait
// jamais.
//
// L'excès inverse serait pire : faire descendre la quantité d'une prestation
// sur une ligne qui en réunit trois donnerait un « 800 × 750 € » que personne
// n'a décidé.

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

console.log("\n=== Une prestation mesurée : sa quantité devient celle de la ligne ===\n");

cas("800 ml de haie donnent une ligne de 800 ml", () => {
  const q = quantiteCommerciale([{ quantite: "800.00", unite: "ml" }]);
  assert.deepEqual(q, { quantite: "800", unite: "ml", origine: "prestation" });
});

cas("2 souches donnent une ligne de 2 souches", () => {
  assert.deepEqual(quantiteCommerciale([{ quantite: "2.00", unite: "souche" }]), {
    quantite: "2",
    unite: "souche",
    origine: "prestation",
  });
});

console.log("\n=== Une ligne qui réunit plusieurs travaux se vend au FORFAIT ===\n");

cas("abattage + broyage + évacuation : un forfait, pas une somme", () => {
  // Additionner serait le pire des cas : 800 ml de haie plus 2 souches ne font
  // pas 802 de quoi que ce soit.
  const q = quantiteCommerciale([
    { quantite: null, unite: null },
    { quantite: "3.00", unite: "arbre" },
    { quantite: null, unite: null },
  ]);
  assert.deepEqual(q, { quantite: "1", unite: null, origine: "forfait" });
});

cas("une prestation sans mesure se vend au forfait", () => {
  assert.equal(quantiteCommerciale([{ quantite: null, unite: null }]).origine, "forfait");
});

cas("une quantité sans son unité ne devient jamais une quantité de ligne", () => {
  // « 800 » tout seul se lit 800 mètres, 800 m² ou 800 heures selon qui regarde.
  assert.equal(quantiteCommerciale([{ quantite: "800", unite: null }]).origine, "forfait");
  assert.equal(quantiteCommerciale([{ quantite: "800", unite: "   " }]).origine, "forfait");
});

cas("une quantité aberrante se vend au forfait plutôt que d'être écrite", () => {
  assert.equal(quantiteCommerciale([{ quantite: "0", unite: "ml" }]).origine, "forfait");
  assert.equal(quantiteCommerciale([{ quantite: "-5", unite: "ml" }]).origine, "forfait");
});

cas("aucune prestation : forfait", () => {
  assert.deepEqual(quantiteCommerciale([]), { quantite: "1", unite: null, origine: "forfait" });
});

console.log("\n=== Ce qu'on ne décide pas à sa place, on le lui DIT ===\n");

cas("deux souches à un prix de grille : la question est posée", () => {
  const avis = prevenirQuantiteNonMultipliee([
    { quantite: "2", unite: "souche", libelle: "Dessouchage de deux souches" },
  ]);
  assert.ok(avis, "rien n'a été signalé : le devis facturerait une souche pour deux");
  assert.match(avis, /multipli/i);
});

cas("une longueur ne pose pas la question — elle est déjà multipliée", () => {
  assert.equal(prevenirQuantiteNonMultipliee([{ quantite: "800", unite: "ml" }]), null);
  assert.equal(prevenirQuantiteNonMultipliee([{ quantite: "6", unite: "tonne" }]), null);
});

cas("un seul exemplaire ne pose aucune question", () => {
  assert.equal(prevenirQuantiteNonMultipliee([{ quantite: "1", unite: "souche" }]), null);
});

console.log(`\n${reussites} réussite(s), ${echecs} échec(s).`);
if (echecs > 0) process.exitCode = 1;
