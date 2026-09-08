// Reprendre un chantier aux tarifs d'aujourd'hui — la règle, sans base.
//
// **Ce que cette suite protège, et c'est de l'argent.** Reprendre un chantier
// au prix de l'an dernier, c'est facturer une hausse de tarif qu'on ne voit
// pas — sur chaque chantier repris, sans que rien ne le signale. C'est
// exactement ce que le patron a tranché le 8 septembre 2026 en choisissant
// « la 1 ».
//
// **Et le défaut d'en face compte autant** : marquer « à chiffrer » toute ligne
// sans tarif correspondant obligerait à ressaisir presque tout le devis. Ce
// serait le retapage dont il se plaint, réintroduit par la porte du zèle.

import assert from "node:assert/strict";
import {
  reprendreLaLigne,
  reprendreLesLignes,
  resumeDeLaReprise,
  montantDeLaLigne,
  type LigneAReprendre,
  type TarifDuJour,
} from "../src/lib/reprise-des-prix";

let echecs = 0;
function essai(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}`);
    console.log(`    ${(e as Error).message}`);
  }
}

/** Une ligne du chantier repris, avec des valeurs qui ne gênent pas le cas. */
function ligne(p: Partial<LigneAReprendre> & { libelle: string }): LigneAReprendre {
  return {
    quantite: "1",
    prixUnitaire: "100.00",
    unite: null,
    aChiffrer: false,
    tauxTva: null,
    ordre: 0,
    ...p,
  };
}

const GRILLE: TarifDuJour[] = [
  { intitule: "Taille de haie", prix: "18.20", unite: "ml" },
  { intitule: "Évacuation des déchets verts", prix: "90.00", unite: null },
];

console.log("=== Reprendre un chantier aux tarifs d'aujourd'hui ===\n");

essai("le tarif a monté : on prend le neuf, et l'ancien reste lisible", () => {
  const r = reprendreLaLigne(
    ligne({ libelle: "Taille de haie", quantite: "40", prixUnitaire: "17.50" }),
    GRILLE
  );
  assert.equal(r.sort, "retarife");
  assert.equal(r.prixUnitaire, "18.20");
  assert.equal(r.montant, "728.00");
  assert.equal(r.sort === "retarife" ? r.ancienPrixUnitaire : null, "17.50");
});

essai("le tarif n'a pas bougé : rien à signaler", () => {
  const r = reprendreLaLigne(
    ligne({ libelle: "Évacuation des déchets verts", prixUnitaire: "90.00" }),
    GRILLE
  );
  assert.equal(r.sort, "inchange");
  assert.equal(r.prixUnitaire, "90.00");
});

// **LE PIÈGE DES `numeric`.** PostgreSQL rend « 90.00 », un écran peut avoir
// écrit « 90.5 ». Comparer les CHAÎNES annoncerait un changement de prix là où
// il n'y en a aucun, et barrerait un ancien prix identique au nouveau — deux
// fois le même nombre côte à côte, et c'est toute la liste dont on doute.
essai("« 18.2 » et « 18.20 » sont le même prix, pas un changement", () => {
  const r = reprendreLaLigne(ligne({ libelle: "Taille de haie", prixUnitaire: "18.2" }), GRILLE);
  assert.equal(r.sort, "inchange");
});

// **LA CORRECTION DU 8 SEPTEMBRE, et elle vaut d'être écrite.** Il lui avait
// été annoncé qu'une ligne sans tarif reviendrait « à chiffrer ». Faux :
// `lignes_prix` ne garde aucun lien vers son tarif d'origine, donc « aucun
// tarif ne correspond » veut dire « chiffrée à la main » bien plus souvent que
// « tarif supprimé ». Son prix se garde, et se dit.
essai("aucun tarif ne correspond : le prix est GARDÉ, jamais effacé", () => {
  const r = reprendreLaLigne(
    ligne({ libelle: "Traitement anti-mousse", quantite: "1", prixUnitaire: "120.00" }),
    GRILLE
  );
  assert.equal(r.sort, "prix-garde");
  assert.equal(r.prixUnitaire, "120.00");
  assert.equal(r.montant, "120.00");
});

essai("elle attendait son prix : elle l'attend encore", () => {
  const r = reprendreLaLigne(
    ligne({ libelle: "Reprise de massif", prixUnitaire: "0.00", aChiffrer: true }),
    GRILLE
  );
  assert.equal(r.sort, "attend-son-prix");
});

// Un tarif trouvé maintenant ne rattrape pas ce qu'on ignorait : si le libellé
// avait correspondu, la ligne aurait été chiffrée la première fois. La reprise
// ne décide pas à sa place ce qu'il n'avait pas décidé.
essai("« à chiffrer » ne se chiffre pas tout seul, même si un tarif existe", () => {
  const r = reprendreLaLigne(
    ligne({ libelle: "Taille de haie", prixUnitaire: "0.00", aChiffrer: true }),
    GRILLE
  );
  assert.equal(r.sort, "attend-son-prix");
  assert.equal(r.prixUnitaire, "0.00");
});

essai("la casse et les accents ne séparent pas deux fois le même tarif", () => {
  const r = reprendreLaLigne(
    ligne({ libelle: "evacuation des dechets verts", prixUnitaire: "80.00" }),
    GRILLE
  );
  assert.equal(r.sort, "retarife");
  assert.equal(r.prixUnitaire, "90.00");
});

// Quarante mètres de haie la dernière fois n'en font pas quarante cette fois :
// c'est un relevé de chantier, pas un tarif. La reprise ne touche jamais au
// métré — sinon elle inventerait une mesure (`CLAUDE.md` §4).
essai("la quantité n'est jamais recalculée", () => {
  const r = reprendreLaLigne(
    ligne({ libelle: "Taille de haie", quantite: "63.50", prixUnitaire: "17.50" }),
    GRILLE
  );
  assert.equal(r.quantite, "63.50");
  assert.equal(r.montant, "1155.70");
});

essai("un libellé vide ne s'accroche pas à un tarif d'intitulé vide", () => {
  const r = reprendreLaLigne(ligne({ libelle: "   ", prixUnitaire: "42.00" }), [
    { intitule: "  ", prix: "9.99", unite: null },
  ]);
  assert.equal(r.sort, "prix-garde");
  assert.equal(r.prixUnitaire, "42.00");
});

essai("le montant s'arrondit au centime, jamais un flottant qui traîne", () => {
  assert.equal(montantDeLaLigne("3", "0.10"), "0.30");
  assert.equal(montantDeLaLigne("1.15", "1.00"), "1.15");
  assert.equal(montantDeLaLigne("12.5", "17.33"), "216.63");
});

essai("un prix illisible ne fabrique pas un montant", () => {
  assert.equal(montantDeLaLigne("2", "n'importe quoi"), "0.00");
});

essai("l'ordre du devis est respecté", () => {
  const r = reprendreLesLignes(
    [
      ligne({ libelle: "Deuxième", ordre: 2 }),
      ligne({ libelle: "Première", ordre: 1 }),
    ],
    GRILLE
  );
  assert.deepEqual(r.map((l) => l.libelle), ["Première", "Deuxième"]);
});

// **Un avertissement qui parle à tort s'apprend à être ignoré** (`CLAUDE.md`
// §4 ter) : sur un devis que rien n'a changé, l'écran ne dit rien.
essai("rien à dire quand rien n'a bougé", () => {
  const r = reprendreLesLignes([ligne({ libelle: "Taille de haie", prixUnitaire: "18.20" })], GRILLE);
  assert.equal(resumeDeLaReprise(r).aQuelqueChoseADire, false);
});

essai("un prix qui a bougé, ça se dit", () => {
  const r = reprendreLesLignes([ligne({ libelle: "Taille de haie", prixUnitaire: "17.50" })], GRILLE);
  const resume = resumeDeLaReprise(r);
  assert.equal(resume.retarifees, 1);
  assert.equal(resume.aQuelqueChoseADire, true);
});

// Un prix gardé n'est pas une alerte : c'est le cas ORDINAIRE d'une ligne
// chiffrée à la main. En faire un avertissement rendrait la bannière permanente,
// donc invisible.
essai("un prix gardé, seul, ne déclenche pas d'avertissement", () => {
  const r = reprendreLesLignes([ligne({ libelle: "Reprise de massif", prixUnitaire: "250.00" })], GRILLE);
  const resume = resumeDeLaReprise(r);
  assert.equal(resume.prixGardes, 1);
  assert.equal(resume.aQuelqueChoseADire, false);
});

essai("une grille vide ne casse rien : tous les prix sont gardés", () => {
  const r = reprendreLesLignes(
    [ligne({ libelle: "Taille de haie", prixUnitaire: "17.50" })],
    []
  );
  assert.equal(r[0].sort, "prix-garde");
  assert.equal(r[0].prixUnitaire, "17.50");
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} Reprendre aux tarifs du jour — ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
