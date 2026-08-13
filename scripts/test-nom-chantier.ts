import assert from "node:assert/strict";
import { nomDuChantier, intituleDuChantier } from "../src/lib/nom-chantier";
import { CIVILITE_PAR_DEFAUT } from "../src/lib/civilite";

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

cas("un client nommé donne son nom, avec sa civilité", () => {
  // **Changé le 13 août 2026 :** le nom valait « Chez M. Bernard ». Le patron,
  // capture de son devis à l'appui : *« il faut qu'il y ait écrit monsieur
  // Martins et pas chez Martins »*. « Chez » est la phrase par laquelle un
  // artisan désigne un chantier ; en tête d'un document, on nomme quelqu'un.
  assert.equal(nomDuChantier({ nomClient: "Martins", jour: JOUR }), `${CIVILITE_PAR_DEFAUT} Martins`);
  // Une civilité déjà saisie n'en reçoit pas une seconde.
  assert.equal(nomDuChantier({ nomClient: "M. Bernard", jour: JOUR }), "M. Bernard");
});

cas("le client prime sur l'adresse — c'est ainsi qu'il en parle", () => {
  assert.equal(
    nomDuChantier({ nomClient: "M. Bernard", adresseChantier: "12 rue des Lilas", jour: JOUR }),
    "M. Bernard"
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

cas("INVARIANT — la saisie survit intacte, et rien d'autre ne s'ajoute", () => {
  // **Cet invariant a été ASSOUPLI le 13 août 2026, et il faut le savoir.**
  //
  // Il tenait jusque-là que chaque mot du nom venait de la saisie. La civilité
  // rompt cette règle : « Mr. » n'est pas une donnée du client, c'est un
  // défaut, et le patron l'a demandé en sachant qu'il n'avait tapé que
  // « Martins » (`src/lib/civilite.ts`). Ne pas « rétablir » l'ancien
  // invariant sans lui : il a été levé, pas oublié.
  //
  // Ce qui reste tenu, et qui est l'essentiel : **la saisie n'est jamais
  // altérée**, et le seul mot qui puisse s'ajouter est celui-là.
  const donnees = [
    { nomClient: "Mme Roux", jour: JOUR },
    { nomClient: "Martins", jour: JOUR },
    { adresseChantier: "3 chemin du Bois", jour: JOUR },
    { nomClient: "SARL Untel", adresseChantier: "zone artisanale", jour: JOUR },
  ];
  const enMots = (t: string) =>
    t
      .toLowerCase()
      .split(/[^0-9a-zà-öø-ÿ]+/i)
      .filter((m) => m.length > 0);

  // **La civilité se découpe comme le reste.** Écrite « Mr. », elle donne le mot
  // « mr » : la comparer telle quelle à un mot déjà découpé ne trouve jamais
  // rien, et l'invariant accuse alors la civilité d'être un mot inventé.
  const motsDeLaCivilite = new Set(enMots(CIVILITE_PAR_DEFAUT));

  for (const d of donnees) {
    const nom = nomDuChantier(d);
    const saisi = `${d.nomClient ?? ""} ${d.adresseChantier ?? ""}`.toLowerCase();
    const inconnus = enMots(nom)
      .filter((m) => m !== "chantier" && m !== "du" && !motsDeLaCivilite.has(m))
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

// ─── L'intitulé qui accompagne l'adresse, dans la feuille « Y aller » ────────
//
// **Né d'une capture, le 12 août 2026** : la feuille affichait « M. Bernard —
// Chez M. Bernard ». Elle collait le client devant un nom que `nomDuChantier`
// fabrique justement à partir du client — donc le cas le plus courant du
// produit était le plus laid. Aucun test ne pouvait le voir : les deux textes
// étaient exacts, c'est leur mise bout à bout qui ne l'était pas.

cas("le nom porte déjà le client : on ne le répète pas", () => {
  assert.equal(intituleDuChantier("M. Bernard", "M. Bernard"), "M. Bernard");
  // Et les chantiers d'avant le 13 août 2026, restés « Chez … » en base tant
  // que la migration 0036 n'a pas tourné, se lisent toujours sans doublon.
  assert.equal(intituleDuChantier("M. Bernard", "Chez M. Bernard"), "Chez M. Bernard");
  assert.equal(
    intituleDuChantier("Martins", `${CIVILITE_PAR_DEFAUT} Martins`),
    `${CIVILITE_PAR_DEFAUT} Martins`
  );
});

cas("un nom donné à la main reçoit le client devant", () => {
  assert.equal(
    intituleDuChantier("M. Bernard", "Abattage de chêne"),
    "M. Bernard — Abattage de chêne"
  );
});

cas("deux graphies du même homme ne se lisent pas en double", () => {
  // Le nom du client est recopié dans le nom du chantier à la création ; l'un
  // des deux peut avoir été corrigé depuis.
  assert.equal(intituleDuChantier("M. BERNARD", "Chez M. Bernard"), "Chez M. Bernard");
  assert.equal(intituleDuChantier("Mme Rivière", "Chez Mme Riviere"), "Chez Mme Riviere");
});

cas("sans client, le nom du chantier suffit", () => {
  assert.equal(intituleDuChantier(null, "12 rue des Lilas"), "12 rue des Lilas");
  assert.equal(intituleDuChantier("   ", "Chantier du 12 août"), "Chantier du 12 août");
});

if (echecs > 0) {
  console.error(`\n${echecs} contrôle(s) en échec.`);
  process.exit(1);
}
console.log("Tous les contrôles du nom de chantier sont passés.");
