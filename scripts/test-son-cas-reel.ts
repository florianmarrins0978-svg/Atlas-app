/**
 * SA DICTÉE DU 30 AOÛT 2026, jouée d'un bout à l'autre de la chaîne.
 *
 * **Pourquoi ce fichier existe alors que dix suites couvrent déjà ces
 * fonctions.** Elles les couvrent UNE PAR UNE. Le défaut qu'il a trouvé au
 * téléphone vivait exactement entre elles : `mesures-arbre.ts` lisait
 * parfaitement « souches de 60 », `questions-chiffrage.ts` lisait parfaitement
 * une colonne `diametreCm` — et personne n'écrivait cette colonne. Chaque suite
 * était verte, la chaîne était cassée.
 *
 * Ici on part de ce que le MODÈLE rend et on va jusqu'à ce que le patron LIT :
 * les questions posées, et le libellé du devis.
 *
 * **Ce que ce contrôle ne prouve pas, et il faut le dire :** ce que le modèle
 * répond vraiment. Cet environnement n'a pas de clé (`CLAUDE.md` §1 ter). Les
 * sorties de modèle ci-dessous sont donc des HYPOTHÈSES — la plus dure d'abord
 * (le modèle range tout en colonnes et ne laisse qu'un mot), puis les variantes
 * qu'il peut rendre. Le contrôle réel reste `npm run verifier:chaine-dictee`,
 * sur son espace.
 */
import assert from "node:assert/strict";
import { structureDeLaPrestation } from "../src/lib/prestation-structuree";
import { questionsAvantChiffrage } from "../src/lib/questions-chiffrage";
import { libelleClient } from "../src/lib/libelle-client";
import type { LigneExtraite } from "../src/server/ai/schemas/extraction";

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

/**
 * SA DICTÉE, mot pour mot, telle qu'il l'a redictée au téléphone le 30 août :
 *
 * « Taille de 800 mètres linéaires de haie de laurier, démontage d'un érable de
 *   40 centimètres au pied et 12 mètres de haut avec rétention, dessouchage de
 *   deux souches de 60, évacuation des déchets et tonte de 1 200 mètres carrés
 *   de pelouse, prévoir deux hommes pendant une journée. »
 */

/** Ce que le modèle rend, quand il range au maximum en colonnes. */
const LECTURE_SERREE: LigneExtraite[] = [
  { libelle: "Taille de haie de laurier", description: null, quantite: "800", unite: "ml", nature: "haie", espece: "laurier", aConfirmer: false },
  { libelle: "Démontage d'un érable", description: "40 centimètres au pied, 12 mètres de haut, avec rétention", quantite: "1", unite: "arbre", nature: "abattage", espece: "érable", aConfirmer: false },
  { libelle: "Dessouchage", description: "souches de 60", quantite: "2", unite: "souche", nature: "dessouchage", espece: null, aConfirmer: false },
  { libelle: "Évacuation des déchets", description: null, quantite: null, unite: null, nature: "evacuation", espece: null, aConfirmer: false },
  { libelle: "Tonte de la pelouse", description: null, quantite: "1200", unite: "m²", nature: "tonte", espece: null, aConfirmer: false },
];

/** Ce qu'il rend quand il garde la mesure dans le libellé. */
const LECTURE_BAVARDE: LigneExtraite[] = [
  { libelle: "Démontage d'un érable de 40 cm au pied et 12 m de haut avec rétention", description: null, quantite: "1", unite: "arbre", nature: "abattage", espece: "érable", aConfirmer: false },
  { libelle: "Dessouchage de deux souches de 60", description: null, quantite: "2", unite: "souche", nature: "dessouchage", espece: null, aConfirmer: false },
];

/** Ce que la chaîne écrit en base pour une ligne extraite. */
function enBase(ligne: LigneExtraite) {
  const s = structureDeLaPrestation(ligne);
  // `libelleAvecQuantite` recolle la quantité au libellé, comme le fait
  // `brouillon-service.ts`. La `description` du modèle, elle, N'EST PAS
  // persistée — c'est précisément ce qui rendait la mesure irrécupérable
  // plus loin, et pourquoi elle se lit à la structuration.
  const libelle =
    s.quantite && s.unite ? `${ligne.libelle} (${ligne.quantite} ${ligne.unite})` : ligne.libelle;
  return { libelle, quantite: s.quantite, unite: s.unite, nature: s.nature, espece: s.espece, caracteristiques: s.caracteristiques, methode: null };
}

console.log("\n=== Étape par étape : où le diamètre entrait, et où il entre ===\n");

cas("l'érable : « 40 centimètres au pied » arrive EN COLONNE", () => {
  const p = enBase(LECTURE_SERREE[1]);
  assert.deepEqual(p.caracteristiques, { diametreCm: 40, hauteurM: 12 });
});

cas("les souches : « souches de 60 » arrive EN COLONNE, sans unité prononcée", () => {
  const p = enBase(LECTURE_SERREE[2]);
  assert.deepEqual(p.caracteristiques, { diametreCm: 60 });
});

cas("la haie, l'évacuation et la tonte n'inventent AUCUNE mesure", () => {
  for (const i of [0, 3, 4]) {
    assert.equal(enBase(LECTURE_SERREE[i]).caracteristiques, null, LECTURE_SERREE[i].libelle);
  }
});

cas("la lecture bavarde donne exactement les mêmes colonnes", () => {
  assert.deepEqual(enBase(LECTURE_BAVARDE[0]).caracteristiques, { diametreCm: 40, hauteurM: 12 });
  assert.deepEqual(enBase(LECTURE_BAVARDE[1]).caracteristiques, { diametreCm: 60 });
});

console.log("\n=== Ce qu'Atlas lui demande ENCORE, sur sa dictée réelle ===\n");

cas("L'ÉRABLE NE DEMANDE PLUS SON DIAMÈTRE", () => {
  const q = questionsAvantChiffrage([enBase(LECTURE_SERREE[1])]);
  const diametre = q.filter((x) => x.id.includes("diametre"));
  assert.equal(diametre.length, 0, `posée quand même : ${diametre.map((d) => d.question).join(" / ")}`);
});

cas("LES SOUCHES NE DEMANDENT PLUS LEUR DIAMÈTRE", () => {
  const q = questionsAvantChiffrage([enBase(LECTURE_SERREE[2])]);
  const diametre = q.filter((x) => x.id.includes("diametre"));
  assert.equal(diametre.length, 0, `posée quand même : ${diametre.map((d) => d.question).join(" / ")}`);
});

cas("sur la dictée ENTIÈRE, plus une seule question de diamètre", () => {
  const q = questionsAvantChiffrage(LECTURE_SERREE.map(enBase));
  const diametre = q.filter((x) => x.id.includes("diametre"));
  assert.equal(diametre.length, 0, `posées : ${diametre.map((d) => d.question).join(" / ")}`);
});

cas("la même chose avec la lecture bavarde", () => {
  const q = questionsAvantChiffrage(LECTURE_BAVARDE.map(enBase));
  assert.equal(q.filter((x) => x.id.includes("diametre")).length, 0);
});

cas("CE QUI N'EST PAS DIT SE DEMANDE TOUJOURS — le garde-fou n'est pas cassé", () => {
  // Sans mesure dans la dictée, la question qui vaut de l'argent doit revenir.
  const muet: LigneExtraite = { libelle: "Dessouchage", description: null, quantite: "2", unite: "souche", nature: "dessouchage", espece: null, aConfirmer: false };
  const q = questionsAvantChiffrage([enBase(muet)]);
  assert.equal(q.filter((x) => x.id.includes("diametre")).length, 1, "un diamètre inconnu doit encore se demander");
  assert.equal(q.find((x) => x.id.includes("diametre"))?.question, "Quel diamètre fait la souche ?");
});

console.log("\n=== Ce que le CLIENT lit sur le devis ===\n");

cas("LE DEVIS AFFICHE « Dessouchage de souches de 60 cm »", () => {
  assert.equal(libelleClient(enBase(LECTURE_SERREE[2])), "Dessouchage de souches de 60 cm");
});

cas("le nombre ne revient PAS dans le libellé — il reste dans sa colonne", () => {
  const p = enBase(LECTURE_SERREE[2]);
  const lu = libelleClient(p);
  assert.ok(!/\bdeux\b|\b2\b/i.test(lu), `« ${lu} » porte encore le compte`);
  assert.equal(p.quantite, "2.00");
  assert.equal(p.unite, "souche");
});

cas("une seule souche reste au SINGULIER", () => {
  const une: LigneExtraite = { libelle: "Dessouchage", description: "souche de 45", quantite: "1", unite: "souche", nature: "dessouchage", espece: null, aConfirmer: false };
  assert.equal(libelleClient(enBase(une)), "Dessouchage de souche de 45 cm");
});

cas("les trois autres libellés qu'il a validés ne bougent PAS", () => {
  assert.equal(libelleClient(enBase(LECTURE_SERREE[0])), "Taille de haie de laurier");
  assert.equal(libelleClient(enBase(LECTURE_SERREE[4])), "Tonte de la pelouse");
  assert.equal(libelleClient(enBase(LECTURE_SERREE[1])), "Démontage d'un érable");
});

cas("un geste SANS diamètre n'invente rien", () => {
  const sansMesure: LigneExtraite = { libelle: "Dessouchage", description: null, quantite: "2", unite: "souche", nature: "dessouchage", espece: null, aConfirmer: false };
  assert.equal(libelleClient(enBase(sansMesure)), "Dessouchage");
});

cas("une unité de MESURE ne devient jamais un objet", () => {
  // « Taille de haie de mls de 60 cm » : ce que la borne évite.
  const haie: LigneExtraite = { libelle: "Taille", description: "haie de 60 cm de diamètre", quantite: "800", unite: "ml", nature: "haie", espece: null, aConfirmer: false };
  const lu = libelleClient(enBase(haie));
  assert.ok(!/\bmls?\b/i.test(lu), `« ${lu} » nomme une unité de mesure`);
});

console.log(`\n${reussites} réussite(s), ${echecs} échec(s).`);
if (echecs > 0) process.exit(1);
