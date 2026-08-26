import assert from "node:assert/strict";
import { prixAttribuable } from "../src/lib/prix-attribuable";

// **Le garde-fou de l'apprentissage, éprouvé dans LES DEUX SENS.**
//
// Ce qu'il doit refuser : le montant d'une ligne qui porte deux travaux
// vendables séparément, ou un travail que le produit ne sait pas chiffrer. Sans
// ce refus, la case d'abattage du patron passe de 800 € à 1 500 € parce qu'une
// tonte de 1 200 m² voyageait sur la même ligne (mesuré le 26 août 2026).
//
// **Ce qu'il doit LAISSER PASSER, et qui compte autant :** son devis du 5 août,
// écrit de sa main — une ligne « abattage, broyage, évacuation » à 600 €. Ces
// 600 € SONT son prix d'abattage, par sa propre règle. Un garde-fou qui
// refuserait cette ligne-là arrêterait l'apprentissage sur son cas le plus
// courant : il dégraderait l'application au lieu de la réparer.

let reussites = 0;
let echecs = 0;
function cas(nom: string, verifier: () => void): void {
  try {
    verifier();
    console.log(`  ✓ ${nom}`);
    reussites++;
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

function attribueA(libelle: string, nature: string) {
  const r = prixAttribuable(libelle);
  assert.equal(
    r.attribuable,
    true,
    `refusé alors qu'il fallait l'accepter : ${r.attribuable ? "" : r.motif}`
  );
  assert.equal(r.attribuable && r.nature, nature);
}

function refuse(libelle: string) {
  const r = prixAttribuable(libelle);
  assert.equal(r.attribuable, false, `accepté alors qu'il fallait le refuser (nature « ${r.attribuable ? r.nature : ""} »)`);
}

console.log("\n=== Ce qui doit continuer d'enseigner ===\n");

cas("un abattage seul", () => {
  attribueA("Abattage d'un chêne mort — démontage avec rétention, ⌀ 70 cm", "abattage");
});

cas("SON devis du 5 août : abattage, broyage et évacuation sur une ligne", () => {
  // Sa règle du 7 août, mot pour mot : « l'abattage, le broyage et
  // l'évacuation, c'est sur une ligne ». Les 600 € de cette ligne SONT son prix
  // d'abattage — la refuser serait une régression franche.
  attribueA("Abattage d'un chêne mort\nBroyage des branches\nÉvacuation du gros bois", "abattage");
});

cas("le billonnage, qui accompagne l'abattage", () => {
  attribueA("Abattage d'un chêne mort\nCoupe en 50 cm", "abattage");
});

cas("un broyage SEUL reste un chantier à part entière", () => {
  // Broyer du bois déjà à terre est un vrai travail. Le déclarer « accessoire
  // de rien » ferait disparaître le seul apprentissage possible de la ligne.
  attribueA("Broyage des branches", "broyage");
});

cas("une taille de haie avec sa longueur", () => {
  attribueA("Taille de haie de laurier, 20 ml", "haie");
});

cas("les grumes — connues de la grille, inconnues de la mémoire", () => {
  // La grille sait les ranger (prix à la tonne) ; `signatureLecon` ne les
  // reconnaît pas. Un garde-fou qui n'aurait qu'un des deux vocabulaires
  // refuserait cet apprentissage-là. C'est pourquoi ce module prend l'union.
  attribueA("Enlèvement des grumes, 6 tonnes", "grumes");
});

cas("un fendage", () => attribueA("Fendage du bois", "fendage"));
cas("un dessouchage", () => attribueA("Dessouchage de la souche", "dessouchage"));
cas("un élagage", () => attribueA("Taille du tilleul", "elagage"));

console.log("\n=== Ce qui doit être refusé ===\n");

cas("SON devis du 26 août : une tonte voyage avec un démontage", () => {
  // Le cas mesuré : 1 500 € posés sur cette ligne écrasaient sa case
  // d'abattage, tonte de 1 200 m² comprise.
  refuse("Tonte de la pelouse (1200 m²)\nÉrable — démontage en rétention");
});

cas("deux travaux qui se vendent séparément", () => {
  refuse("Abattage d'un chêne mort\nTaille de haie de laurier");
});

cas("deux travaux vendables écrits sur une SEULE ligne de texte", () => {
  // Le même défaut sous un autre visage : le premier motif qui répond gagnerait.
  refuse("Abattage et dessouchage du chêne");
});

cas("un travail inconnu du produit, seul", () => {
  // Rien ne change par rapport à aujourd'hui : la grille et la mémoire
  // l'ignoraient déjà. On le dit simplement au lieu de se taire.
  refuse("Tonte de la pelouse (1200 m²)");
});

cas("une plantation posée à côté d'un abattage", () => {
  refuse("Abattage d'un érable\nPlantation de trois charmilles");
});

cas("une ligne vide", () => refuse(""));
cas("une ligne sans aucun travail", () => refuse("Divers"));

console.log("\n=== Le motif désigne le bon coupable ===\n");

cas("le refus nomme le travail qui gêne, pas un message générique", () => {
  const r = prixAttribuable("Tonte de la pelouse (1200 m²)\nÉrable — démontage en rétention");
  assert.equal(r.attribuable, false);
  assert.match(
    r.attribuable ? "" : r.motif,
    /Tonte de la pelouse/,
    "le motif ne dit pas QUEL travail rend le montant inattribuable"
  );
});

cas("deux vendables : le motif les nomme tous les deux", () => {
  const r = prixAttribuable("Abattage d'un chêne\nTaille de haie");
  assert.equal(r.attribuable, false);
  const motif = r.attribuable ? "" : r.motif;
  assert.match(motif, /abattage/);
  assert.match(motif, /haie/);
});

console.log(`\n${reussites} réussite(s), ${echecs} échec(s).`);
if (echecs > 0) process.exitCode = 1;
