import assert from "node:assert/strict";
import {
  creneauxOccupesParAbsence,
  croiseLaFenetre,
  fusionnerAbsences,
  libelleAbsence,
  phraseDuRefus,
  refusDeLAbsence,
} from "../src/lib/absences-equipe";
import {
  cleCreneau,
  compterOccupation,
  departPossible,
  jourRetenable,
} from "../src/server/disponibilites";

/**
 * Une équipe absente ne compte plus dans les dates proposées.
 *
 * *Le patron, le 14 août 2026 : « Comment on fait si jamais il y a une équipe
 * qui doit partir en déplacement pour cinq jours ? »*
 *
 * **Ce que ces cas gardent, et qu'aucun écran ne verrait :** que l'absence
 * retire EXACTEMENT une unité de capacité, ni plus ni moins. Trop, et le patron
 * perd des jours qu'il pouvait tenir ; pas assez, et un client retient une date
 * qu'on ne pourra pas honorer — le second coûte infiniment plus cher, et c'est
 * précisément celui qu'aucun écran ne montre.
 */

let echecs = 0;
function cas(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

const A = (premierJour: string, dernierJour: string, equipeId = "eq-1") => ({
  equipeId,
  premierJour,
  dernierJour,
});

console.log("=== Les jours qu'une absence retire ===\n");

cas("les cinq jours du déplacement, matin et après-midi", () => {
  // Son cas, mot pour mot : une équipe part cinq jours.
  const creneaux = creneauxOccupesParAbsence(A("2026-09-08", "2026-09-12"));
  assert.equal(creneaux.length, 10, "cinq jours font dix demi-journées");
  assert.deepEqual(creneaux[0], { jour: "2026-09-08", moment: "matin" });
  assert.deepEqual(creneaux.at(-1), { jour: "2026-09-12", moment: "apres_midi" });
});

cas("les deux bornes sont INCLUSES", () => {
  // « du 8 au 12 » comprend le 8 et le 12, comme le patron l'écrirait. Exclure
  // le dernier jour rendrait une date que l'équipe ne peut pas tenir.
  const jours = new Set(creneauxOccupesParAbsence(A("2026-09-08", "2026-09-12")).map((c) => c.jour));
  assert.ok(jours.has("2026-09-08"));
  assert.ok(jours.has("2026-09-12"));
  assert.equal(jours.size, 5);
});

cas("un seul jour d'absence est un cas ordinaire, pas une erreur", () => {
  assert.equal(creneauxOccupesParAbsence(A("2026-09-08", "2026-09-08")).length, 2);
});

cas("les week-ends sont compris — « suis-je là ? » ne connaît pas les jours ouvrés", () => {
  // Du vendredi au lundi : quatre jours, samedi et dimanche inclus. Même règle
  // que pour l'agenda extérieur.
  const jours = new Set(creneauxOccupesParAbsence(A("2026-09-11", "2026-09-14")).map((c) => c.jour));
  assert.deepEqual([...jours], ["2026-09-11", "2026-09-12", "2026-09-13", "2026-09-14"]);
});

cas("une absence qui traverse un mois, et une année bissextile", () => {
  assert.equal(creneauxOccupesParAbsence(A("2026-01-30", "2026-02-02")).length, 8);
  assert.equal(creneauxOccupesParAbsence(A("2028-02-27", "2028-03-01")).length, 8, "2028 est bissextile");
});

cas("une absence à l'envers n'occupe RIEN", () => {
  // Bloquer un jour au hasard sur une donnée qui n'a pas de sens coûterait un
  // créneau que le patron ne comprendrait pas avoir perdu.
  assert.deepEqual(creneauxOccupesParAbsence(A("2026-09-12", "2026-09-08")), []);
});

cas("une date illisible n'occupe rien non plus", () => {
  assert.deepEqual(creneauxOccupesParAbsence(A("12/09/2026", "2026-09-12")), []);
  assert.deepEqual(creneauxOccupesParAbsence(A("", "")), []);
});

console.log("\n=== Ce que l'absence retire à la capacité ===\n");

cas("deux équipes, une absente : il n'en reste qu'une", () => {
  const occupation = fusionnerAbsences(new Map(), [A("2026-09-08", "2026-09-12")], 2);
  assert.equal(occupation.get(cleCreneau({ jour: "2026-09-09", moment: "matin" })), 1);
  // Une place reste : un chantier peut encore partir.
  assert.equal(departPossible("2026-09-09", 2, occupation, 2), "matin");
});

cas("deux équipes, DEUX absentes : plus aucune date ce jour-là", () => {
  const occupation = fusionnerAbsences(
    new Map(),
    [A("2026-09-08", "2026-09-12", "eq-1"), A("2026-09-08", "2026-09-12", "eq-2")],
    2
  );
  assert.equal(departPossible("2026-09-09", 2, occupation, 2), null);
});

cas("une absence S'AJOUTE à un chantier déjà posé, elle ne l'écrase pas", () => {
  // C'est le cœur de la règle. Deux équipes, un chantier posé le 9 au matin, et
  // l'autre équipe en déplacement : il ne reste plus rien. Écraser au lieu
  // d'additionner rendrait ce jour libre, et un client y retiendrait une date.
  const chantiers = compterOccupation([
    { jour: "2026-09-09", moment: "matin", dureeDemiJournees: 2 },
  ], 1);
  const occupation = fusionnerAbsences(chantiers, [A("2026-09-08", "2026-09-12")], 2);
  assert.equal(occupation.get(cleCreneau({ jour: "2026-09-09", moment: "matin" })), 2);
  assert.equal(departPossible("2026-09-09", 2, occupation, 2), null);
});

cas("le total ne dépasse jamais le nombre d'équipes", () => {
  // Trois absences dans une entreprise qui en compte deux : inoffensif pour la
  // comparaison, mais faux pour tout écran qui lirait cette carte pour dire
  // « il reste combien de place ».
  const occupation = fusionnerAbsences(
    new Map(),
    [A("2026-09-09", "2026-09-09", "a"), A("2026-09-09", "2026-09-09", "b"), A("2026-09-09", "2026-09-09", "c")],
    2
  );
  assert.equal(occupation.get(cleCreneau({ jour: "2026-09-09", moment: "matin" })), 2);
});

cas("la carte reçue n'est jamais modifiée", () => {
  // Elle sert ailleurs, et une carte mutée à distance est un défaut qu'on ne
  // retrouve qu'au troisième écran.
  const origine = compterOccupation([{ jour: "2026-09-09", moment: "matin", dureeDemiJournees: 2 }], 1);
  const avant = new Map(origine);
  fusionnerAbsences(origine, [A("2026-09-08", "2026-09-12")], 2);
  assert.deepEqual([...origine.entries()].sort(), [...avant.entries()].sort());
});

cas("aucune absence : la carte est exactement celle d'avant", () => {
  const origine = compterOccupation([{ jour: "2026-09-09", moment: "matin", dureeDemiJournees: 2 }], 1);
  assert.deepEqual([...fusionnerAbsences(origine, [], 2).entries()].sort(), [...origine.entries()].sort());
});

cas("un chantier de deux jours ne peut pas ENJAMBER une absence", () => {
  // Le piège que seule une durée révèle : le 7 est libre, mais un chantier de
  // deux jours posé le 7 déborde sur le 8, où l'équipe est partie. Une règle
  // qui ne regarderait que le premier jour laisserait passer celui-là.
  const occupation = fusionnerAbsences(
    new Map(),
    [A("2026-09-08", "2026-09-12", "a"), A("2026-09-08", "2026-09-12", "b")],
    2
  );
  const fenetre = { debut: "2026-09-01", fin: "2026-09-30" };
  assert.equal(jourRetenable("2026-09-07", 2, occupation, 2, fenetre), true, "le 7 seul reste tenable");
  assert.equal(
    jourRetenable("2026-09-07", 4, occupation, 2, fenetre),
    false,
    "deux jours depuis le 7 débordent sur l'absence"
  );
});

cas("après l'absence, tout revient normal sans rien défaire", () => {
  const occupation = fusionnerAbsences(new Map(), [A("2026-09-08", "2026-09-12")], 2);
  assert.equal(occupation.get(cleCreneau({ jour: "2026-09-13", moment: "matin" })), undefined);
  assert.equal(departPossible("2026-09-13", 2, occupation, 2), "matin");
});

console.log("\n=== Croiser la fenêtre regardée ===\n");

cas("une absence à cheval sur le début de la fenêtre compte quand même", () => {
  assert.equal(croiseLaFenetre(A("2026-08-30", "2026-09-02"), "2026-09-01", "2026-09-30"), true);
});

cas("une absence entièrement passée ne compte pas", () => {
  assert.equal(croiseLaFenetre(A("2026-07-01", "2026-07-05"), "2026-09-01", "2026-09-30"), false);
});

cas("les bornes de la fenêtre sont incluses des deux côtés", () => {
  assert.equal(croiseLaFenetre(A("2026-09-30", "2026-10-04"), "2026-09-01", "2026-09-30"), true);
  assert.equal(croiseLaFenetre(A("2026-10-01", "2026-10-04"), "2026-09-01", "2026-09-30"), false);
});

console.log("\n=== Ce qu'on refuse d'enregistrer, et ce qu'on en dit ===\n");

cas("une absence ordinaire est acceptée", () => {
  assert.equal(refusDeLAbsence("2026-09-08", "2026-09-12"), null);
  assert.equal(refusDeLAbsence("2026-09-08", "2026-09-08"), null, "un seul jour reste valide");
});

cas("une absence à l'envers est refusée, avec sa phrase", () => {
  const refus = refusDeLAbsence("2026-09-12", "2026-09-08");
  assert.equal(refus, "a_l_envers");
  assert.equal(phraseDuRefus(refus!), "Le dernier jour tombe avant le premier.");
});

cas("des dates illisibles sont refusées", () => {
  assert.equal(refusDeLAbsence("", "2026-09-12"), "jour_illisible");
  assert.equal(refusDeLAbsence("12 septembre", "2026-09-12"), "jour_illisible");
});

cas("plus d'un an d'absence est une saisie fautive, pas un déplacement", () => {
  assert.equal(refusDeLAbsence("2026-09-08", "2027-09-08"), null, "un an tout juste passe");
  assert.equal(refusDeLAbsence("2026-09-08", "2028-09-08"), "trop_longue");
});

cas("chaque refus porte SA phrase — jamais un « réessayez » pour trois causes", () => {
  const phrases = (["jour_illisible", "a_l_envers", "trop_longue"] as const).map(phraseDuRefus);
  assert.equal(new Set(phrases).size, 3, `deux refus disent la même chose : ${phrases.join(" | ")}`);
});

console.log("\n=== Ce que le patron lit ===\n");

cas("« du 8 au 12 septembre » — le mois n'est écrit qu'une fois", () => {
  assert.equal(libelleAbsence("2026-09-08", "2026-09-12"), "du 8 au 12 septembre");
});

cas("un seul jour ne se dit pas « du 8 au 8 »", () => {
  // « du 8 septembre au 8 septembre » se lit comme une erreur de
  // l'application, et le patron chercherait ce qu'il a mal saisi.
  assert.equal(libelleAbsence("2026-09-08", "2026-09-08"), "le 8 septembre");
});

cas("à cheval sur deux mois, les deux sont écrits", () => {
  assert.equal(libelleAbsence("2026-08-30", "2026-09-02"), "du 30 août au 2 septembre");
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} Absences d'équipe — ${echecs} échec(s).`);
if (echecs > 0) process.exit(1);
