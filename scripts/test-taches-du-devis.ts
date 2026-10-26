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
      { libelle: "", quantite: "1", unite: null, mainDoeuvre: false },
      { libelle: "Coupe de cheveux homme", quantite: "45.00", unite: null, mainDoeuvre: false },
    ]),
    ["Coupe de cheveux homme, 45 u"]
  );
});

cas("des espaces seuls ne sont pas un texte", () => {
  assert.deepEqual(tachesDuDevis([{ libelle: "  \n ", quantite: "3", unite: null, mainDoeuvre: false }]), []);
});

// **Sa remarque du 29 septembre 2026 :** *« le 45 c'est la quantité, il faut
// que ça s'affiche comme une quantité »*. « — 45 » se lisait comme un prix ; la
// quantité s'écrit comme sur le papier du devis, avec son unité (« u » quand il
// n'en a pas tapé, `uniteDeLaLigne`), et sans tiret (`CLAUDE.md` §3).
cas("la quantité s'écrit avec son unité, comme sur le devis", () => {
  assert.deepEqual(
    tachesDuDevis([
      { libelle: "Taille de haie", quantite: "18.00", unite: "ml", mainDoeuvre: false },
      { libelle: "Engazonnement", quantite: "12.50", unite: " m² ", mainDoeuvre: false },
      { libelle: "Évacuation des déchets", quantite: "1.00", unite: null, mainDoeuvre: false },
    ]),
    ["Taille de haie, 18 ml", "Engazonnement, 12,5 m²", "Évacuation des déchets"]
  );
});

// **Sa capture du 25 octobre 2026** : « Main d'œuvre » cochable sous la haie
// et l'érigeron. *« La main d'œuvre ne doit pas apparaître »* : elle se paie,
// elle ne se fait pas. C'est le drapeau de la ligne qui la reconnaît, jamais
// son texte (`LIBELLE_LIGNE_MAIN_DOEUVRE`) : renommée, elle part quand même ;
// un travail qui la nomme sans le drapeau reste un travail.
cas("une ligne de main d'œuvre ne donne pas de case (sa capture)", () => {
  assert.deepEqual(
    tachesDuDevis([
      { libelle: "Taille de haie de laurier", quantite: "50.00", unite: "ml", mainDoeuvre: false },
      { libelle: "Erigeron", quantite: "1.00", unite: null, mainDoeuvre: false },
      { libelle: "Main d’œuvre", quantite: "1.00", unite: null, mainDoeuvre: true },
      { libelle: "Main d’œuvre plantation", quantite: "1.00", unite: null, mainDoeuvre: true },
    ]),
    ["Taille de haie de laurier, 50 ml", "Erigeron"]
  );
});

if (echecs > 0) {
  console.error(`\n${echecs} cas en échec.`);
  process.exit(1);
}
console.log("\nTâches du devis : tout est juste.");
