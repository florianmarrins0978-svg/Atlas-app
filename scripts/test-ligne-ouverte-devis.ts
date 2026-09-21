import assert from "node:assert/strict";
import {
  LIGNE_OUVERTE,
  estLigneOuverte,
  ligneOuverteAEcrire,
  ligneOuverteAPoser,
} from "../src/lib/ligne-ouverte-devis";

// **« Quand j'ouvre la page du devis il doit avoir une ligne d'ouverte déjà,
// je dois pas avoir besoin de cliquer sur ajouter une ligne. »** — le patron,
// 20 septembre 2026.
//
// Cette suite tient les deux moitiés de la règle : QUAND la ligne s'ouvre, et
// à partir de QUOI elle s'écrit en base. La seconde est la plus importante —
// une ligne vide écrite à l'ouverture ferait disparaître une dictée
// (`src/lib/ligne-ouverte-devis.ts`, la panne du 7 août 2026).
//
// Elle sait échouer : retirer la garde de la dictée rougit le troisième cas,
// et écrire la ligne sans condition rougit le sixième.

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

console.log("=== La ligne ouverte d'avance sur un devis vide ===\n");

cas("SON CAS : il ouvre un devis vide, une ligne l'attend", () => {
  assert.equal(
    ligneOuverteAPoser({ statut: "brouillon", nombreDeLignes: 0, dicteeAPreparer: false }),
    true,
    "il devrait encore appuyer sur « + Ajouter une ligne » avant d'écrire"
  );
});

cas("un devis qui porte déjà des lignes n'en ouvre pas une de plus", () => {
  // La case vide s'ajouterait sous son travail : c'est « + Ajouter une ligne »
  // qui dit ce qu'on veut, et lui seul.
  assert.equal(ligneOuverteAPoser({ statut: "brouillon", nombreDeLignes: 1, dicteeAPreparer: false }), false);
});

cas("une dictée qui va être reprise retient la ligne ouverte", () => {
  // La chaîne n'écrit les prestations dictées que sur un devis VIDE
  // (`devis-depuis-dictee.ts`). Une ligne remplie pendant qu'elle tourne lui
  // ferait tout abandonner — sa panne du 7 août 2026, « gros bug ».
  assert.equal(ligneOuverteAPoser({ statut: "brouillon", nombreDeLignes: 0, dicteeAPreparer: true }), false);
});

cas("un devis PARTI montre ce que le client a reçu, pas une case de plus", () => {
  assert.equal(ligneOuverteAPoser({ statut: "envoye", nombreDeLignes: 0, dicteeAPreparer: false }), false);
});

cas("son identifiant ne peut croiser aucune ligne réelle", () => {
  // Les lignes de la base portent un UUID ; celle-ci porte un mot.
  assert.equal(estLigneOuverte(LIGNE_OUVERTE), true);
  assert.equal(estLigneOuverte("6f1f6f8e-6b4a-4a1e-9a6e-2f0b1d6c9a11"), false);
  assert.ok(!/^[0-9a-f-]{36}$/.test(LIGNE_OUVERTE), "l'identifiant ressemble à un UUID : il pourrait en croiser un");
});

cas("UN CHAMP TRAVERSÉ N'ÉCRIT RIEN — le doigt posé puis retiré", () => {
  // Le devis enregistre à la sortie de chaque case, qu'elle ait changé ou non.
  // Sans cette question, traverser la description écrirait la ligne vide que
  // tout ce fichier existe pour ne pas écrire.
  assert.equal(
    ligneOuverteAEcrire({ libelle: "", quantite: "1", prixUnitaire: "", unite: null }),
    false,
    "une ligne vide partirait en base au premier champ traversé"
  );
  assert.equal(ligneOuverteAEcrire({ libelle: "   ", quantite: "1", prixUnitaire: "0", unite: "" }), false);
});

cas("le premier mot écrit fait naître la ligne", () => {
  assert.equal(ligneOuverteAEcrire({ libelle: "Abattage d'un chêne", quantite: "1", prixUnitaire: "", unite: null }), true);
});

cas("un prix seul suffit, et une quantité seule aussi", () => {
  // Il pose parfois le montant avant le libellé — une ligne qui n'aurait que
  // son prix doit survivre au rechargement comme les autres.
  assert.equal(ligneOuverteAEcrire({ libelle: "", quantite: "1", prixUnitaire: "1250", unite: null }), true);
  assert.equal(ligneOuverteAEcrire({ libelle: "", quantite: "1", prixUnitaire: "0,50", unite: null }), true);
  assert.equal(ligneOuverteAEcrire({ libelle: "", quantite: "800", prixUnitaire: "", unite: null }), true);
  assert.equal(ligneOuverteAEcrire({ libelle: "", quantite: "1", prixUnitaire: "", unite: "ml" }), true);
});

console.log(
  echecs === 0
    ? "\n✅ La ligne ouverte d'avance — 0 échec(s).\n"
    : `\n❌ La ligne ouverte d'avance — ${echecs} échec(s).\n`
);
process.exit(echecs === 0 ? 0 : 1);
