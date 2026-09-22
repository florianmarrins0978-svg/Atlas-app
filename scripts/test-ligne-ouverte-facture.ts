import assert from "node:assert/strict";
import { ligneOuverteAPoserSurLaFacture } from "../src/lib/ligne-ouverte-devis";

// **« Quand je crée une facture il devrait déjà avoir une ligne d'ouverte ! Je
// ne dois pas avoir besoin d'ajouter une ligne au début ! »** — le patron,
// 22 septembre 2026, capture à l'appui.
//
// Cette suite tient la seule chose qui sépare la facture du devis : QUI ouvre
// une ligne d'avance. Ce qui la fait naître en base est commun aux deux, et
// c'est `test-ligne-ouverte-devis.ts` qui le tient.
//
// Elle sait échouer : ouvrir la ligne sans regarder le devis rougit le
// deuxième cas, et sans regarder le statut rougit le quatrième.

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

console.log("=== La ligne ouverte d'avance sur une facture ===\n");

cas("SON CAS : il crée une facture sans devis, une ligne l'attend", () => {
  assert.equal(
    ligneOuverteAPoserSurLaFacture({ statut: "brouillon", sansDevis: true, nombreDeLignes: 0 }),
    true,
    "il devrait encore appuyer sur « + Ajouter une ligne » avant d'écrire"
  );
});

cas("une facture NÉE D'UN DEVIS n'ouvre pas de case d'avance", () => {
  // Ce qu'on y saisit est un travail SUPPLÉMENTAIRE : une case vide d'office
  // ferait apparaître le bandeau « Travaux supplémentaires » sur une facture
  // qui n'en porte aucun, juste avant qu'il vérifie ce qui part chez le client.
  assert.equal(
    ligneOuverteAPoserSurLaFacture({ statut: "brouillon", sansDevis: false, nombreDeLignes: 0 }),
    false
  );
});

cas("une facture qui porte déjà des lignes n'en ouvre pas une de plus", () => {
  assert.equal(
    ligneOuverteAPoserSurLaFacture({ statut: "brouillon", sansDevis: true, nombreDeLignes: 1 }),
    false
  );
});

cas("une facture ARRÊTÉE montre ce que le client a reçu, pas une case de plus", () => {
  // Elle est partie et inscrite au relevé de TVA : elle ne se complète plus.
  assert.equal(
    ligneOuverteAPoserSurLaFacture({ statut: "emise", sansDevis: true, nombreDeLignes: 0 }),
    false
  );
});

console.log(
  echecs === 0
    ? "\n✅ La ligne ouverte de la facture — 0 échec(s).\n"
    : `\n❌ La ligne ouverte de la facture — ${echecs} échec(s).\n`
);
process.exit(echecs === 0 ? 0 : 1);
