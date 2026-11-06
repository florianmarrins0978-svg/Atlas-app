// Reprendre un chantier : ses anciens prix, et le tarif du jour PROPOSÉ.
//
// **Ce que cette suite protège, et c'est de l'argent.** Le 8 septembre 2026 il
// avait choisi « la 1 » : reprendre aux tarifs d'aujourd'hui. Le 26 septembre,
// devant ce que ça donnait, il l'a retirée : *« il faut reprendre les prix de
// l'ancien devis ; à la limite demande s'il veut qu'on mette les prix à jour,
// il dit oui ou non, mais pas comme ça sans qu'il le sache »*. Un prix qui
// change tout seul sur un devis qu'il croit recopié, c'est un devis qu'il
// envoie sans l'avoir relu. La reprise garde donc l'ancien prix, et PROPOSE le
// tarif du jour ; c'est l'écran qui pose la question.
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
    mainDoeuvre: false,
    partMainDoeuvre: null,
    joursMainDoeuvre: null,
    ...p,
  };
}

const GRILLE: TarifDuJour[] = [
  { intitule: "Taille de haie", prix: "18.20", unite: "ml" },
  { intitule: "Évacuation des déchets verts", prix: "90.00", unite: null },
];

console.log("=== Reprendre un chantier à ses prix, le tarif du jour proposé ===\n");

essai("le tarif a monté : l'ancien prix RESTE, le neuf est seulement proposé", () => {
  const r = reprendreLaLigne(
    ligne({ libelle: "Taille de haie", quantite: "40", prixUnitaire: "17.50" }),
    GRILLE
  );
  assert.equal(r.sort, "grille-proposee");
  assert.equal(r.prixUnitaire, "17.50");
  assert.equal(r.montant, "700.00");
  assert.equal(r.sort === "grille-proposee" ? r.prixGrille : null, "18.20");
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
  assert.equal(r.sort, "grille-proposee");
  assert.equal(r.prixUnitaire, "80.00");
  assert.equal(r.sort === "grille-proposee" ? r.prixGrille : null, "90.00");
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
  assert.equal(r.montant, "1111.25");
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

essai("un tarif qui a bougé, ça se dit", () => {
  const r = reprendreLesLignes([ligne({ libelle: "Taille de haie", prixUnitaire: "17.50" })], GRILLE);
  const resume = resumeDeLaReprise(r);
  assert.equal(resume.grillesProposees, 1);
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

// ─── SA DÉCISION DU 6 NOVEMBRE 2026 : la main d'œuvre suit le devis repris ───
//
// *« Il faut garder les 400 € de main d'œuvre. Et quand on fait mettre à
// jour les prix, ça doit juste se mettre à jour par rapport à la taille de la
// haie. À part si les prix de la main d'œuvre ont augmenté : si on est passé
// de 400 à 420, ça se réfère au nouveau prix de la main d'œuvre. Mais dans
// tous les cas, il faut que la ligne main d'œuvre soit présente. »*
//
// Sa haie de l'an dernier : 25 ml à 12 €, plus 400 € de main d'œuvre répartis
// dessus (2 jours d'homme à 200 €), soit 25 ml à 28 €. Cette année, sa grille
// dit 13 € la haie.
const GRILLE_DU_JOUR = (jourHomme: string): TarifDuJour[] => [
  { intitule: "Taille de haie de laurier", prix: "13.00", unite: "ml" },
  { intitule: "Main d'œuvre", prix: jourHomme, unite: "jour/homme" },
];
const HAIE = {
  libelle: "Taille de haie de laurier",
  quantite: "25",
  prixUnitaire: "28.00",
  unite: "ml",
  partMainDoeuvre: "400.00",
  joursMainDoeuvre: "2",
};

essai("la main d'œuvre répartie reste, et le tarif du jour ne vise que la taille", () => {
  const r = reprendreLaLigne(ligne(HAIE), GRILLE_DU_JOUR("200.00"));
  assert.equal(r.prixUnitaire, "28.00", "le devis repris change avant sa réponse");
  assert.equal(r.partMainDoeuvre, "400.00", "les 400 € de main d'œuvre sont perdus");
  assert.equal(r.prixTravail, "12.00", "la taille seule vaut 12 €, main d'œuvre retirée");
  assert.equal(r.sort, "grille-proposee");
  assert.equal(r.sort === "grille-proposee" ? r.prixGrille : null, "13.00", "le tarif du jour se compare à 28 €, part comprise");
  assert.equal(r.partGrille, null, "son prix du jour n'a pas bougé : rien à proposer pour la main d'œuvre");
});

essai("son prix du jour par homme a bougé : la main d'œuvre passe de 400 à 420", () => {
  const r = reprendreLaLigne(ligne(HAIE), GRILLE_DU_JOUR("210.00"));
  assert.equal(r.partGrille, "420.00");
  assert.equal(resumeDeLaReprise([r]).aQuelqueChoseADire, true);
});

essai("la taille au même prix, seule la main d'œuvre a bougé : la question se pose", () => {
  const r = reprendreLaLigne(ligne({ ...HAIE }), [
    { intitule: "Taille de haie de laurier", prix: "12.00", unite: "ml" },
    { intitule: "Main d'œuvre", prix: "210.00", unite: "jour/homme" },
  ]);
  assert.equal(r.sort, "inchange");
  assert.equal(r.partGrille, "420.00");
  assert.equal(resumeDeLaReprise([r]).aQuelqueChoseADire, true);
});

// Les jours ne se devinent pas : une part posée avant qu'Atlas les retienne,
// ou celle d'un partenaire, garde son montant. Jamais un prix reconstitué.
essai("sans les jours d'homme, la main d'œuvre garde ses 400 €", () => {
  const r = reprendreLaLigne(ligne({ ...HAIE, joursMainDoeuvre: null }), GRILLE_DU_JOUR("210.00"));
  assert.equal(r.partMainDoeuvre, "400.00");
  assert.equal(r.partGrille, null);
});

// Une dictée « répartie » met TOUT le prix du travail en main d'œuvre : il n'y
// a pas de prix de taille à mettre à jour, et en proposer un ajouterait 325 €
// qu'aucun devis n'a portés.
essai("un travail payé tout entier en main d'œuvre ne reçoit pas le tarif de la taille", () => {
  const r = reprendreLaLigne(
    ligne({ ...HAIE, prixUnitaire: "16.00", partMainDoeuvre: "400.00" }),
    GRILLE_DU_JOUR("210.00")
  );
  assert.equal(r.prixTravail, "0.00");
  assert.notEqual(r.sort, "grille-proposee", "un prix de taille apparaît là où il n'y en avait pas");
  assert.equal(r.partGrille, "420.00");
});

// La ligne « Main d'œuvre » elle-même : ses jours d'homme sont sa quantité, son
// prix est le prix du jour par homme. Elle se reconnaît à son unité, comme la
// dictée la chiffre (`tarif-main-oeuvre.ts`), jamais à son libellé.
essai("la ligne de main d'œuvre au jour par homme reçoit le prix du jour", () => {
  const r = reprendreLaLigne(
    ligne({ libelle: "Main d’œuvre", quantite: "4", prixUnitaire: "200.00", unite: "jour/homme", mainDoeuvre: true }),
    GRILLE_DU_JOUR("210.00")
  );
  assert.equal(r.mainDoeuvre, true);
  assert.equal(r.sort === "grille-proposee" ? r.prixGrille : null, "210.00");
});

essai("une main d'œuvre au forfait garde son prix", () => {
  const r = reprendreLaLigne(
    ligne({ libelle: "Main d’œuvre", quantite: "1", prixUnitaire: "500.00", unite: "forfait", mainDoeuvre: true }),
    GRILLE_DU_JOUR("210.00")
  );
  assert.equal(r.sort, "prix-garde");
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} Reprendre à ses prix, tarif du jour proposé : ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
