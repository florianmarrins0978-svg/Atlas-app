import assert from "node:assert/strict";
import { ligneDejaAuDetail } from "../src/lib/proposition-au-detail";

// Le devis qui doublait tout seul.
//
// Le patron : « lorsque je clique sur la touche retour de mon navigateur et que
// je reviens sur la page, ça me compte deux prestations, donc le prix du devis
// a fait ×2 tout seul ». Reproduit à l'identique : 1 674 € HT devenus 3 348 €,
// soit les 4 017,60 € TTC de sa capture.
//
// La cause n'était pas un calcul faux — c'était un bouton sans mémoire.
// « Ajouté au détail » vivait dans le navigateur ; un retour arrière le
// réinitialisait, l'écran reproposait la même ligne, et un seul appui la
// dédoublait. L'application avait invité l'erreur, puis l'avait exécutée
// sans un mot.
//
// La règle est ici, pure, et sert à la fois l'écran et le serveur
// (`CLAUDE.md` §3).

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

console.log("=== Une proposition déjà au détail ne s'ajoute pas deux fois ===");

cas("le cas du patron : la ligne est retrouvée, donc refusée", () => {
  const detail = [{ libelle: "Élagage", montant: "1674.00" }];
  const deja = ligneDejaAuDetail("Élagage", detail);
  assert.ok(deja, "La ligne déjà présente n'a pas été reconnue : le devis doublerait.");
  assert.equal(deja.montant, "1674.00");
});

cas("le montant ne compte pas — un tarif révisé reste un doublon", () => {
  // Comparer les montants laisserait passer le doublon au centime près
  // différent : précisément le cas où le patron ne verrait rien.
  const detail = [{ libelle: "Élagage", montant: "1674.00" }];
  assert.ok(ligneDejaAuDetail("Élagage", detail), "Un tarif révisé doit rester un doublon.");
});

cas("la casse, les accents d'espacement et les espaces en trop ne trompent pas", () => {
  const detail = [{ libelle: "  élagage   d'un tilleul ", montant: "800.00" }];
  assert.ok(
    ligneDejaAuDetail("Élagage d'un tilleul", detail),
    "Un même libellé écrit différemment a échappé au rapprochement."
  );
});

cas("une prestation réellement différente passe", () => {
  const detail = [{ libelle: "Élagage", montant: "1674.00" }];
  assert.equal(ligneDejaAuDetail("Abattage", detail), null, "Une autre prestation a été bloquée à tort.");
});

cas("une ligne encore anonyme ne bloque rien", () => {
  // L'écran crée une ligne vide qu'on nomme ensuite. Si le vide rapprochait le
  // vide, la proposition serait bloquée par une ligne que le patron vient
  // d'ouvrir — un blocage incompréhensible.
  const detail = [{ libelle: "", montant: "0.00" }];
  assert.equal(ligneDejaAuDetail("Élagage", detail), null);
  assert.equal(ligneDejaAuDetail("", detail), null, "Deux libellés vides ne sont pas un doublon.");
  assert.equal(ligneDejaAuDetail(null, detail), null, "Une proposition sans libellé ne bloque rien.");
});

cas("un détail vide n'empêche jamais le premier ajout", () => {
  assert.equal(ligneDejaAuDetail("Élagage", []), null, "Le premier ajout a été refusé.");
});

cas("le doublon est retrouvé où qu'il soit dans le détail", () => {
  const detail = [
    { libelle: "Déplacement", montant: "60.00" },
    { libelle: "Broyage", montant: "200.00" },
    { libelle: "Élagage", montant: "1674.00" },
  ];
  assert.ok(ligneDejaAuDetail("élagage", detail), "Un doublon en fin de liste est passé au travers.");
});

if (echecs > 0) {
  console.error(`\n${echecs} contrôle(s) en échec.`);
  process.exit(1);
}
console.log("Tous les contrôles du doublon de proposition sont passés.");
