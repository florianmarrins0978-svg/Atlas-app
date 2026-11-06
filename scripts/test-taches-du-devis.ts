import assert from "node:assert/strict";
import { enDeuxParts, tachesDuDevis } from "../src/lib/taches-du-devis";

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
// elle ne se fait pas. Le drapeau la reconnaît renommée ; le premier mot,
// quand elle ne le porte pas (cas suivant) ; et un travail qui la nomme plus
// loin reste un travail.
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

// **Sa demande du 6 novembre 2026 :** *« il ne faut jamais que la main-d'œuvre
// qu'il y a dans le devis s'affiche ; il faut qu'il n'y ait que les travaux,
// plantation, terrassement ; le camion d'évacuation ne doit pas non plus
// apparaître »*. Puis, à la question : le déplacement et la location partent
// aussi ; l'évacuation des déchets et une fourniture seule restent.
//
// Le drapeau ne suffisait pas : une main d'œuvre écrite avant lui (migration
// 0130), tapée sur une ligne ordinaire, ou reprise par « Dernier devis » ne le
// porte pas. Et le camion n'en a aucun : c'est le NOM de la ligne qui dit
// qu'elle se paie sans se faire, par son premier mot.
cas("une main d'œuvre sans drapeau ne donne pas de case", () => {
  assert.deepEqual(
    tachesDuDevis([
      { libelle: "Plantation de 6 photinias", quantite: "1.00", unite: null, mainDoeuvre: false },
      { libelle: "Main d'œuvre", quantite: "2.00", unite: "jour/homme", mainDoeuvre: false },
      { libelle: "Main d’oeuvre : Jardins Martin", quantite: "1.00", unite: null, mainDoeuvre: false },
      { libelle: "MAIN D'OEUVRE terrassement", quantite: "1.00", unite: null, mainDoeuvre: false },
    ]),
    ["Plantation de 6 photinias"]
  );
});

cas("le camion, le broyeur et les engins ne donnent pas de case (son devis)", () => {
  assert.deepEqual(
    tachesDuDevis([
      { libelle: "Taille de haie de laurier", quantite: "25.00", unite: "ml", mainDoeuvre: false },
      { libelle: "Camion d'évacuation", quantite: "1.00", unite: "forfait", mainDoeuvre: false },
      { libelle: "Broyeur", quantite: "1.00", unite: "forfait", mainDoeuvre: false },
      { libelle: "Mini-pelle avec chauffeur", quantite: "1.00", unite: null, mainDoeuvre: false },
      { libelle: "Nacelle 18 m", quantite: "1.00", unite: null, mainDoeuvre: false },
      { libelle: "Camionnette benne", quantite: "1.00", unite: null, mainDoeuvre: false },
      { libelle: "Benne 10 m³", quantite: "1.00", unite: null, mainDoeuvre: false },
      { libelle: "Rogneuse de souche", quantite: "1.00", unite: null, mainDoeuvre: false },
      { libelle: "Élagage d'un frêne", quantite: "1.00", unite: "u", mainDoeuvre: false },
    ]),
    ["Taille de haie de laurier, 25 ml", "Élagage d'un frêne"]
  );
});

cas("le déplacement et la location ne donnent pas de case (sa réponse)", () => {
  assert.deepEqual(
    tachesDuDevis([
      { libelle: "Forfait déplacement", quantite: "1.00", unite: null, mainDoeuvre: false },
      { libelle: "Frais de déplacement", quantite: "1.00", unite: null, mainDoeuvre: false },
      { libelle: "Déplacement", quantite: "2.00", unite: null, mainDoeuvre: false },
      { libelle: "Location d'une mini-pelle", quantite: "1.00", unite: "jour", mainDoeuvre: false },
      { libelle: "Location nacelle", quantite: "1.00", unite: null, mainDoeuvre: false },
      { libelle: "Terrassement", quantite: "30.00", unite: "m²", mainDoeuvre: false },
    ]),
    ["Terrassement, 30 m²"]
  );
});

// L'autre sens compte autant : une case qui disparaît à tort, c'est un travail
// que l'équipe ne fera pas. Un engin NOMMÉ dans un travail ne retire pas le
// travail, ni la main d'œuvre qui y est comprise ; et ce qu'il a voulu garder
// reste.
cas("un travail qui nomme un engin ou la main d'œuvre reste un travail", () => {
  assert.deepEqual(
    tachesDuDevis([
      { libelle: "Dessouchage à la rogneuse", quantite: "1.00", unite: "u", mainDoeuvre: false },
      { libelle: "Taille de haie, main d'œuvre comprise", quantite: "1.00", unite: null, mainDoeuvre: false },
      { libelle: "Terrassement à la mini-pelle et évacuation", quantite: "1.00", unite: null, mainDoeuvre: false },
      { libelle: "Évacuation des déchets verts", quantite: "1.00", unite: null, mainDoeuvre: false },
      { libelle: "Fourniture de terre végétale", quantite: "3.00", unite: "m³", mainDoeuvre: false },
      { libelle: "Camélia en pot", quantite: "2.00", unite: null, mainDoeuvre: false },
      { libelle: "Pelouse à créer", quantite: "1.00", unite: null, mainDoeuvre: false },
    ]),
    [
      "Dessouchage à la rogneuse",
      "Taille de haie, main d'œuvre comprise",
      "Terrassement à la mini-pelle et évacuation",
      "Évacuation des déchets verts",
      "Fourniture de terre végétale, 3 m³",
      "Camélia en pot, 2 u",
      "Pelouse à créer",
    ]
  );
});

// **Sa planche A du 6 novembre 2026** (`appli/soignee/fiche-travaux.html`) :
// le nom du travail en grand, sa quantité à droite. La case garde le texte
// entier, celui que le retour enregistre et que Terminés relit ; l'écran le
// coupe en deux avec l'inverse exact de ce qui l'a écrit. Le cas qui compte :
// rien ne se perd, et rien ne se coupe là où le devis n'a pas mis de quantité.
cas("une case se coupe en nom et quantité, sans rien perdre", () => {
  const lignes = [
    { libelle: "Taille de haie de laurier", quantite: "25.00", unite: "ml", mainDoeuvre: false },
    { libelle: "Engazonnement", quantite: "12.50", unite: "m²", mainDoeuvre: false },
    { libelle: "Abattage, broyage et évacuation", quantite: "1.00", unite: null, mainDoeuvre: false },
    { libelle: "Plantation, 3 variétés", quantite: "6.00", unite: null, mainDoeuvre: false },
    { libelle: "Tonte", quantite: "1.00", unite: "forfait", mainDoeuvre: false },
  ];
  const cases = tachesDuDevis(lignes);
  assert.deepEqual(cases.map(enDeuxParts), [
    { quoi: "Taille de haie de laurier", combien: "25 ml" },
    { quoi: "Engazonnement", combien: "12,5 m²" },
    { quoi: "Abattage, broyage et évacuation", combien: null },
    { quoi: "Plantation, 3 variétés", combien: "6 u" },
    { quoi: "Tonte", combien: null },
  ]);
  for (const c of cases) {
    const { quoi, combien } = enDeuxParts(c);
    assert.equal(combien === null ? quoi : `${quoi}, ${combien}`, c, "la case a perdu du texte");
  }
});

if (echecs > 0) {
  console.error(`\n${echecs} cas en échec.`);
  process.exit(1);
}
console.log("\nTâches du devis : tout est juste.");
