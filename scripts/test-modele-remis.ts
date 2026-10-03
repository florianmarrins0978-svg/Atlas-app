import assert from "node:assert/strict";
import { MODELE_FOURNI, modeleManquant, modeleRemis } from "../src/lib/prestations-entretien";

// « REMETTRE LE MODÈLE ATLAS » — sa réponse « B » du 29 septembre 2026.
//
// Sa demande : *« mon modèle doit déjà être là par défaut »*, puis *« il doit
// pouvoir la remettre en cliquant sur une touche, comme pour les messages
// préremplis »*. Devant la planche `appli/fiche-paysage-modele.html`, il a
// choisi **B : seuls les manquants reviennent, ses lignes à lui restent.**
//
// Ce qui se tient ici, sans base : ce qui manque, et où chaque ligne revient.
// Une ligne remise au bas de la fiche plutôt que dans sa famille, il la
// chercherait sur un chantier ; une ligne à lui effacée, il la perdrait.

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

const noms = (l: readonly { libelle: string }[]) => l.map((x) => x.libelle);

cas("une fiche vide reçoit le modèle entier, dans son ordre", () => {
  assert.deepEqual(noms(modeleRemis([])), noms(MODELE_FOURNI));
  assert.equal(modeleManquant([]).length, MODELE_FOURNI.length);
});

cas("une fiche identique au modèle n'a rien à remettre", () => {
  assert.deepEqual(modeleManquant(MODELE_FOURNI), []);
});

cas("B : ce qu'il avait retiré revient DANS SA FAMILLE, ses lignes restent", () => {
  const siennes = [
    { famille: "Pelouse", libelle: "Tonte et ébarbage" },
    { famille: "Pelouse", libelle: "Arrosage" },
    { famille: "Propreté", libelle: "Évacuation des déchets" },
  ];
  const remis = modeleRemis(siennes);
  const pelouse = remis.filter((l) => l.famille === "Pelouse").map((l) => l.libelle);
  assert.deepEqual(pelouse, ["Tonte et ébarbage", "Arrosage", "Traitement pelouse", "Scarification", "Engrais"]);
  assert.ok(noms(remis).includes("Arrosage"), "sa ligne à lui a disparu");
  assert.equal(remis.length, MODELE_FOURNI.length + 1);
  // Ses familles gardent leur place : Pelouse, puis Propreté, puis celles du
  // modèle qu'il n'avait plus, dans l'ordre du modèle.
  const familles = [...new Set(remis.map((l) => l.famille))];
  assert.deepEqual(familles, ["Pelouse", "Propreté", "Tailles", "Massifs"]);
});

cas("une ligne du modèle renommée à la casse près ne revient pas en double", () => {
  const siennes = [{ famille: "pelouse", libelle: "tonte et ebarbage" }];
  const remis = modeleRemis(siennes);
  assert.equal(remis.filter((l) => l.libelle.toLowerCase().startsWith("tonte")).length, 1);
  // Et elle rejoint sa famille telle qu'il l'écrit, sans en ouvrir une seconde.
  assert.equal(remis.filter((l) => l.famille === "Pelouse").length, 0);
  assert.equal(remis.filter((l) => l.famille === "pelouse").length, 4);
});

cas("une ligne déplacée dans une autre famille ne revient pas non plus", () => {
  const siennes = [{ famille: "Printemps", libelle: "Scarification" }];
  assert.ok(!noms(modeleManquant(siennes)).includes("Scarification"));
});

if (echecs > 0) {
  console.error(`\n${echecs} cas en échec.`);
  process.exit(1);
}
console.log("\nRemettre le modèle : tout est juste.");
