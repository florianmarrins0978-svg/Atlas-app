import assert from "node:assert/strict";
import { nomDuChantier } from "../src/lib/nom-chantier";

// Comment un chantier s'appelle, quand personne ne le nomme.
//
// Le patron, le 5 août 2026 : « dans la catégorie chantier, retire la case nom
// du chantier ». C'était le seul champ obligatoire de la création, et le seul
// qui lui demandait d'inventer quelque chose.
//
// **La règle éprouvée ici n'est pas « le nom est joli » mais : rien n'est
// fabriqué.** Chaque nom rendu se retrouve mot pour mot dans ce qui a été
// saisi — ou, à défaut de tout, dans la date, qui reste vraie. Un nom composé
// d'un élément que le patron n'a pas donné serait une donnée inventée
// (`CLAUDE.md` §4), même sous couvert d'étiquette.

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

const JOUR = "2026-08-05";

console.log("=== Le nom se déduit de ce qui a été donné ===");

cas("un client nommé donne « Chez M. Bernard »", () => {
  assert.equal(nomDuChantier({ nomClient: "M. Bernard", jour: JOUR }), "Chez M. Bernard");
});

cas("le client prime sur l'adresse — c'est ainsi qu'il en parle", () => {
  assert.equal(
    nomDuChantier({ nomClient: "M. Bernard", adresseChantier: "12 rue des Lilas", jour: JOUR }),
    "Chez M. Bernard"
  );
});

cas("sans client, l'adresse identifie le chantier", () => {
  assert.equal(nomDuChantier({ adresseChantier: "12 rue des Lilas, Nantes", jour: JOUR }), "12 rue des Lilas, Nantes");
});

cas("sans rien, la date — la seule chose vraie qui reste", () => {
  assert.equal(nomDuChantier({ jour: JOUR }), "Chantier du mercredi 5 août");
});

console.log("=== Ce qu'il ne fait jamais ===");

cas("des espaces seuls ne comptent pas pour un nom", () => {
  assert.equal(nomDuChantier({ nomClient: "   ", adresseChantier: "  ", jour: JOUR }), "Chantier du mercredi 5 août");
});

cas("null et undefined se traversent sans planter", () => {
  assert.equal(nomDuChantier({ nomClient: null, adresseChantier: undefined, jour: JOUR }), "Chantier du mercredi 5 août");
});

cas("INVARIANT — rien n'apparaît qui n'ait été donné", () => {
  // Le nom rendu ne contient que des mots venus de la saisie (ou le mot
  // « Chez »/« Chantier du » et la date, qui n'affirment rien de faux).
  const donnees = [
    { nomClient: "Mme Roux", jour: JOUR },
    { adresseChantier: "3 chemin du Bois", jour: JOUR },
    { nomClient: "SARL Untel", adresseChantier: "zone artisanale", jour: JOUR },
  ];
  for (const d of donnees) {
    const nom = nomDuChantier(d);
    const saisi = `${d.nomClient ?? ""} ${d.adresseChantier ?? ""}`.toLowerCase();
    const inconnus = nom
      .toLowerCase()
      .split(/[^0-9a-zà-öø-ÿ]+/i)
      .filter((m) => m.length > 0 && m !== "chez" && m !== "chantier" && m !== "du")
      .filter((m) => !saisi.includes(m));
    assert.deepEqual(inconnus, [], `Le nom « ${nom} » contient des mots que le patron n'a pas donnés.`);
  }
});

cas("un même client deux fois donne le même nom — aucune fantaisie", () => {
  // Déterminisme : deux chantiers du même client ne se distinguent pas par leur
  // nom, et c'est voulu. Les distinguer par un numéro inventé donnerait un
  // « Chez M. Bernard 2 » qui ne veut rien dire pour lui.
  assert.equal(
    nomDuChantier({ nomClient: "M. Bernard", jour: JOUR }),
    nomDuChantier({ nomClient: "M. Bernard", jour: "2026-09-01" })
  );
});

if (echecs > 0) {
  console.error(`\n${echecs} contrôle(s) en échec.`);
  process.exit(1);
}
console.log("Tous les contrôles du nom de chantier sont passés.");
