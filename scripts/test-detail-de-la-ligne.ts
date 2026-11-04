import assert from "node:assert/strict";
import { apresEffacement, libelleAvecDetail } from "../src/lib/detail-de-la-ligne";

// LE DÉTAIL SOUS LA LIGNE DU DEVIS — sa planche du 4 novembre 2026
// (`appli/soignee/devis-detail-ligne.html`), tous ses choix du même jour : le
// nom et le détail forment UN texte, le détail sous le nom ; effacer devant le
// détail le remonte sur la ligne du nom, avec un espace.

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

console.log("Le détail dicté, sous le nom de la ligne");

cas("le frêne : le nom du tarif, puis sa phrase dessous", () => {
  assert.equal(
    libelleAvecDetail("Élagage d'un frêne", ["Suppression du bois mort, allègement, rétention des grosses charpentières qui partent vers le voisin."]),
    "Élagage d'un frêne\nSuppression du bois mort, allègement, rétention des grosses charpentières qui partent vers le voisin."
  );
});

cas("sans détail, la ligne garde son nom, rien de plus", () => {
  assert.equal(libelleAvecDetail("Broyeur", []), "Broyeur");
  assert.equal(libelleAvecDetail("Broyeur", [null, "  ", undefined]), "Broyeur");
});

cas("une ligne qui vend deux travaux réunit leurs deux détails, une fois chacun", () => {
  assert.equal(
    libelleAvecDetail("Abattage et évacuation", ["Démontage par rétention.", "Démontage par rétention.", "Bois laissé sur place."]),
    "Abattage et évacuation\nDémontage par rétention. Bois laissé sur place."
  );
});

cas("rejouer la dictée ne recolle pas un détail déjà là", () => {
  const une = libelleAvecDetail("Élagage d'un frêne", ["Suppression du bois mort."]);
  assert.equal(libelleAvecDetail(une, ["Suppression du bois mort."]), une);
});

console.log("\nEffacer devant le détail le remonte sur la ligne du nom, avec un espace");

cas("un retour à la ligne vient de partir : l'espace se remet à sa place", () => {
  const avant = "Élagage d'un frêne\nSuppression du bois mort.";
  const apres = "Élagage d'un frêneSuppression du bois mort.";
  assert.deepEqual(apresEffacement(avant, apres), {
    valeur: "Élagage d'un frêne Suppression du bois mort.",
    curseur: "Élagage d'un frêne ".length,
  });
});

cas("une lettre effacée, une lettre tapée, un retour ajouté : rien ne change", () => {
  assert.equal(apresEffacement("Élagage d'un frêne\nSuppression", "Élagage d'un frên\nSuppression"), null);
  assert.equal(apresEffacement("Élagage", "Élagages"), null);
  assert.equal(apresEffacement("Élagage d'un frêne Suppression", "Élagage d'un frêne\nSuppression"), null);
});

cas("un retour effacé contre un espace ne double pas l'espace", () => {
  assert.equal(apresEffacement("frêne \nSuppression", "frêne Suppression"), null);
});

if (echecs > 0) {
  console.log(`\n✗ ${echecs} échec(s)`);
  process.exit(1);
}
console.log("\n✅ Le détail se pose sous la ligne, et remonte d'un effacement.");
