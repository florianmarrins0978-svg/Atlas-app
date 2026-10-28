import assert from "node:assert/strict";
import {
  ecrireUnMontant,
  glisserLeJoint,
  jointATirer,
  repartirMainOeuvre,
} from "../src/lib/main-oeuvre-dictee";
import { contraste } from "../src/lib/chartes";
import { pastelsMainOeuvre } from "../src/lib/design-tokens";

/**
 * LA BARRE DE LA MAIN D'ŒUVRE : ce que ses gestes écrivent, et ce que le devis
 * en garde.
 *
 * **Sa planche du 27 octobre 2026** (`appli/soignee/main-oeuvre-curseur.html`),
 * choisie le soir même : une barre pour tout le total, une poignée entre deux
 * travaux qui ne change qu'eux deux, de 10 € en 10 €, et un montant qui se
 * touche pour s'écrire.
 *
 * **Sa réponse sur l'arrondi, le même soir :** *« si la main d'œuvre c'est
 * 397, ça pourra pas être arrondi à 10 »*. Un montant qu'il ÉCRIT reste donc à
 * l'euro près, et le devis doit écrire ce que la barre a montré : 197 tapé ne
 * devient pas 200 en route. Avant ce lot, `repartirMainOeuvre` repassait tout à
 * la dizaine, même ce qu'il avait réglé lui même.
 *
 * Fonctions pures : aucune base, aucun écran.
 */

let passed = 0;
let failed = 0;
function test(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ ${nom}`);
    passed++;
  } catch (err) {
    console.error(`❌ ${nom}`);
    console.error(`   ${err instanceof Error ? err.message : err}`);
    failed++;
  }
}

const somme = (m: readonly number[]) => Math.round(m.reduce((s, x) => s + x, 0) * 100) / 100;

console.log("=== Le devis écrit ce que la barre a montré ===\n");

test("197 € écrits sur 397 € de main d'œuvre arrivent tels quels, le voisin prend 200 €", () => {
  assert.deepEqual(repartirMainOeuvre("397.00", ["haie", "tonte"], { haie: 197, tonte: 200 }), {
    haie: "197.00",
    tonte: "200.00",
  });
});

test("le prix de sa grille reste le sien : 250 € de haie sur 397 €, l'autre travail prend 147 €", () => {
  // Avant : 250 et 147 passaient à la dizaine (250, 150), et le dernier
  // rattrapait l'écart en descendant à 147 ; dans l'autre ordre, la haie de sa
  // grille sortait à 247 €.
  assert.deepEqual(repartirMainOeuvre("397.00", ["tonte", "haie"], { tonte: 147, haie: 250 }), {
    tonte: "147.00",
    haie: "250.00",
  });
});

test("des parts qui ne font plus le total (un travail retiré) se repartagent à la dizaine", () => {
  // Sa règle du 5 août 2026, « en HT on fait des prix ronds », tient pour tout
  // partage que l'outil calcule.
  assert.deepEqual(repartirMainOeuvre("1600.00", ["a", "b", "c"], { a: 1, b: 1, c: 1 }), {
    a: "530.00",
    b: "530.00",
    c: "540.00",
  });
});

test("un écart d'arrondi ne rend jamais un travail négatif", () => {
  // 395 € pour un travail qui pèse tout, l'autre rien : 395 passe à 400, et le
  // dernier portait l'écart, soit −5 € sur le devis.
  const m = repartirMainOeuvre("395.00", ["a", "b"], { a: 300, b: 0 });
  assert.ok(Object.values(m).every((x) => Number(x) >= 0), JSON.stringify(m));
  assert.equal(Object.values(m).reduce((s, x) => s + Number(x), 0), 395, JSON.stringify(m));
});

test("des pourcentages enregistrés par l'ancien curseur restent des poids", () => {
  assert.deepEqual(repartirMainOeuvre("1600.00", ["a", "b"], { a: 25, b: 75 }), { a: "400.00", b: "1200.00" });
});

console.log("\n=== La poignée : seuls les deux voisins changent, de 10 € en 10 € ===\n");

test("tirer la poignée entre haie et tonte : 610 € et 790 €, le troisième ne bouge pas", () => {
  assert.deepEqual(glisserLeJoint([700, 700, 200], 0, 612), [610, 790, 200]);
});

test("la poignée s'arrête à 10 € de chaque bord : jamais un travail à zéro sous le doigt", () => {
  assert.deepEqual(glisserLeJoint([700, 700, 200], 0, -50), [10, 1390, 200]);
  assert.deepEqual(glisserLeJoint([700, 700, 200], 1, 5000), [700, 890, 10]);
});

test("sur 397 €, la poignée tient la dizaine et le voisin garde l'impair", () => {
  assert.deepEqual(glisserLeJoint([130, 137, 130], 0, 141), [140, 127, 130]);
});

test("des centimes dans le total restent au voisin, sans poussière d'arrondi", () => {
  const m = glisserLeJoint([200, 197.5], 0, 180.0000001);
  assert.deepEqual(m, [180, 217.5]);
});

test("deux travaux trop petits pour se partager ne bougent pas", () => {
  assert.deepEqual(glisserLeJoint([8, 7], 0, 12), [8, 7]);
});

console.log("\n=== Des poignées empilées : le doigt tire celle qui peut bouger ===\n");

// Trouvé par `test-main-oeuvre-barre-e2e.ts` le 27 octobre 2026. Les travaux à
// 0 € (« à chiffrer », la règle de `partsDeDepart`) n'ont pas de largeur : leurs
// poignées tombent au même endroit, et le doigt attrapait celle qui sépare
// deux travaux vides. Rien ne bougeait, sur son cas le plus courant :
// l'abattage prend tout, la fente et l'évacuation attendent.

test("abattage à 800 €, fente et évacuation à 0 : tirer à gauche donne à la fente", () => {
  assert.equal(jointATirer([800, 0, 0], 1, -1, 50), 0);
  assert.deepEqual(glisserLeJoint([800, 0, 0], jointATirer([800, 0, 0], 1, -1, 50), 600), [600, 200, 0]);
});

test("tirer à droite depuis la pile prend au premier travail qui a de quoi", () => {
  // 0 | 0 | 900 : les deux poignées sont au bord gauche, la seconde borde le 900.
  assert.equal(jointATirer([0, 0, 900], 0, 1, 50), 1);
});

test("un morceau trop étroit pour se voir compte dans la pile", () => {
  // 3 € sur 1 120 € ne fait pas un pixel : ses deux poignées n'en font qu'une.
  assert.equal(jointATirer([1117, 3, 0, 0], 2, -1, 96), 0);
});

test("des poignées séparées ne changent pas de joint", () => {
  assert.equal(jointATirer([700, 700, 200], 1, -1, 50), 1);
  assert.equal(jointATirer([700, 700, 200], 1, 1, 50), 1);
  assert.equal(jointATirer([700, 700, 200], 0, 1, 50), 0);
});

console.log("\n=== Le montant écrit : à l'euro près, le voisin prend la différence ===\n");

test("197 écrits : le voisin prend la différence, à l'euro près", () => {
  const r = ecrireUnMontant([130, 137, 130], 0, 197);
  assert.deepEqual(r.montants, [197, 70, 130]);
  assert.deepEqual(r.touches, [1]);
  assert.equal(somme(r.montants), 397);
});

test("baisser un montant : c'est le voisin qui reçoit", () => {
  const r = ecrireUnMontant([700, 700, 200], 0, 500);
  assert.deepEqual(r.montants, [500, 900, 200]);
  assert.deepEqual(r.touches, [1]);
});

test("le voisin n'a pas assez : le suivant complète, chacun garde 10 €", () => {
  const r = ecrireUnMontant([700, 700, 200], 0, 1400);
  assert.deepEqual(r.montants, [1400, 10, 190]);
  assert.deepEqual(r.touches, [1, 2]);
});

test("le dernier travail se paie sur celui du dessus", () => {
  const r = ecrireUnMontant([700, 700, 200], 2, 450);
  assert.deepEqual(r.montants, [700, 450, 450]);
  assert.deepEqual(r.touches, [1]);
});

test("plus que le total : il prend tout ce que les autres peuvent donner, jamais plus", () => {
  const r = ecrireUnMontant([700, 700, 200], 1, 99999);
  assert.deepEqual(r.montants, [10, 1580, 10]);
  assert.equal(somme(r.montants), 1600);
});

test("une saisie vide, illisible ou seule ne change rien", () => {
  assert.deepEqual(ecrireUnMontant([700, 900], 0, Number.NaN).montants, [700, 900]);
  assert.deepEqual(ecrireUnMontant([1600], 0, 500).montants, [1600]);
});

test("un travail à chiffrer (0 €) ne paie rien, et peut recevoir", () => {
  const r = ecrireUnMontant([800, 0, 800], 1, 300);
  assert.deepEqual(r.montants, [800, 300, 500]);
  assert.deepEqual(r.touches, [2]);
});

test("ce que la barre écrit, le devis le garde : la boucle complète sur 397 €", () => {
  const depart = [130, 137, 130];
  const apres = ecrireUnMontant(glisserLeJoint(depart, 1, 101), 0, 199).montants;
  const parts = { a: apres[0], b: apres[1], c: apres[2] };
  const devis = repartirMainOeuvre("397.00", ["a", "b", "c"], parts);
  assert.deepEqual(
    Object.values(devis).map(Number),
    apres,
    `la barre montrait ${apres.join(", ")}, le devis écrit ${JSON.stringify(devis)}`
  );
});

console.log("\n=== Les montants se lisent sur les cinq teintes ===\n");

test("l'encre de la barre tient 4,5 sur chacune des cinq teintes de la palette Jardin", () => {
  for (const teinte of pastelsMainOeuvre.teintes) {
    const c = contraste(pastelsMainOeuvre.encre, teinte);
    assert.ok(c >= 4.5, `${teinte} : ${c.toFixed(2)}`);
  }
});

console.log(`\n${passed} réussi(s), ${failed} échoué(s)`);
if (failed > 0) process.exit(1);
