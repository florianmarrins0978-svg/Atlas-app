import assert from "node:assert/strict";
import { repriseDuDevis } from "../src/lib/facture-face-au-devis";

// LA FACTURE REPREND-ELLE ENCORE LE DEVIS QUI FAIT FOI ?
//
// La règle est pure : elle s'éprouve sans base, et c'est là que vivent les
// pièges — une facture arrêtée qu'on accuserait à tort, un chantier sans devis
// envoyé, un devis identique qu'on croirait différent.

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

const V1 = { id: "devis-1", numeroCommercial: "2026-0001", numeroVersion: 1 };
const V2 = { id: "devis-2", numeroCommercial: "2026-0001", numeroVersion: 2 };

console.log("=== La facture face au devis qui fait foi ===\n");

cas("une facture qui reprend le devis courant est à jour", () => {
  assert.deepEqual(repriseDuDevis({ devisId: "devis-1", statut: "brouillon" }, V1), { aJour: true });
});

cas("un devis PLUS RÉCENT envoyé depuis met la facture en retard", () => {
  const r = repriseDuDevis({ devisId: "devis-1", statut: "brouillon" }, V2);
  assert.equal(r.aJour, false);
  if (!r.aJour) {
    assert.equal(r.numeroCommercial, "2026-0001");
    assert.equal(r.numeroVersion, 2, "l'écran doit pouvoir NOMMER la version qui manque");
  }
});

cas("une facture ARRÊTÉE ne se compare à rien", () => {
  // Elle est partie chez le client et inscrite au relevé : lui reprocher de ne
  // pas suivre un devis postérieur serait un avertissement qu'aucun geste ne
  // peut lever — c'est-à-dire du bruit qu'on apprend à ignorer.
  assert.deepEqual(repriseDuDevis({ devisId: "devis-1", statut: "emise" }, V2), { aJour: true });
});

cas("un chantier sans aucun devis envoyé ne reproche rien", () => {
  assert.deepEqual(repriseDuDevis({ devisId: "devis-1", statut: "brouillon" }, null), { aJour: true });
});

cas("c'est l'IDENTIFIANT qui tranche, pas le numéro commercial", () => {
  // Les deux versions d'un devis portent le MÊME numéro commercial : comparer
  // les numéros aurait déclaré à jour une facture en retard d'une version.
  const r = repriseDuDevis({ devisId: "devis-1", statut: "brouillon" }, V2);
  assert.equal(r.aJour, false, "deux versions du même numéro ont été confondues");
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} La facture face au devis — ${echecs} échec(s).`);
if (echecs > 0) process.exit(1);
