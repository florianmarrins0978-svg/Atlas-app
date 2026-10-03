import assert from "node:assert/strict";
import { tachesDuDevis } from "../src/lib/taches-du-devis";

// « Travaux à faire », sur la fiche d'intervention : une case ronde par ligne
// du devis. **Sa capture du 29 septembre 2026** montrait une case sans rien à
// côté, au-dessus de « Coupe de cheveux homme » : le devis portait une ligne
// ouverte par « + Ajouter une ligne » et jamais écrite. Une case qui ne dit pas
// quoi faire ne se coche pas, et l'équipe se demande ce qu'on a oublié de lui dire.

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

cas("une ligne sans texte ne donne pas de case (sa capture)", () => {
  assert.deepEqual(
    tachesDuDevis([
      { libelle: "", quantite: "1", unite: null },
      { libelle: "Coupe de cheveux homme", quantite: "45.00", unite: null },
    ]),
    ["Coupe de cheveux homme, 45 u"]
  );
});

cas("des espaces seuls ne sont pas un texte", () => {
  assert.deepEqual(tachesDuDevis([{ libelle: "  \n ", quantite: "3", unite: null }]), []);
});

// **Sa remarque du 29 septembre 2026 :** *« le 45 c'est la quantité, il faut
// que ça s'affiche comme une quantité »*. « — 45 » se lisait comme un prix ; la
// quantité s'écrit comme sur le papier du devis, avec son unité (« u » quand il
// n'en a pas tapé, `uniteDeLaLigne`), et sans tiret (`CLAUDE.md` §3).
cas("la quantité s'écrit avec son unité, comme sur le devis", () => {
  assert.deepEqual(
    tachesDuDevis([
      { libelle: "Taille de haie", quantite: "18.00", unite: "ml" },
      { libelle: "Engazonnement", quantite: "12.50", unite: " m² " },
      { libelle: "Évacuation des déchets", quantite: "1.00", unite: null },
    ]),
    ["Taille de haie, 18 ml", "Engazonnement, 12,5 m²", "Évacuation des déchets"]
  );
});

if (echecs > 0) {
  console.error(`\n${echecs} cas en échec.`);
  process.exit(1);
}
console.log("\nTâches du devis : tout est juste.");
