import assert from "node:assert/strict";
import {
  creneauxDuChantier,
  compterOccupation,
  departPossible,
  jourRetenable,
  dureeEnDemiJournees,
  libelleDuree,
  cleCreneau,
  fenetreProposition,
  DUREE_PAR_DEFAUT_DEMI_JOURNEES,
} from "../src/server/disponibilites";

// Les demi-journées et les équipes.
//
// Le patron, le 3 août 2026 : « si mon 1er chantier du 6 août ne dure que le
// matin, je ne peux pas caler une autre demi-journée l'après-midi », et « si
// j'ai deux équipes, je peux avoir deux chantiers le 6 août ».
//
// Trois choses sont éprouvées ici, et une quatrième surveillée :
//   1. l'après-midi du 6 redevient proposable ;
//   2. deux équipes tiennent deux chantiers le même jour ;
//   3. un chantier de deux jours bloque bien deux jours — ce qu'il ne faisait
//      pas : la durée dictée n'entrait nulle part dans la planification, et le
//      client suivant se voyait proposer le lendemain d'un chantier en cours ;
//   4. un chantier planifié AVANT cette évolution n'a ni moment ni durée. Il
//      doit continuer d'occuper la journée entière. Le relâcher libérerait, du
//      jour au lendemain, des après-midis déjà pris.

// Jeudi 6 août 2026 et ses voisins (le 8 est un samedi, le 9 un dimanche).
const JEU_6 = "2026-08-06";
const VEN_7 = "2026-08-07";
const LUN_10 = "2026-08-10";

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

console.log("=== Le cas du patron : la demi-journée du 6 août ===");

cas("un chantier du matin laisse l'après-midi libre", () => {
  const occupation = compterOccupation([{ jour: JEU_6, moment: "matin", dureeDemiJournees: 1 }]);
  assert.equal(
    departPossible(JEU_6, 1, occupation, 1),
    "apres_midi",
    "L'après-midi du 6 reste refusée alors que le matin seul est pris."
  );
});

cas("une journée entière démarre alors l'après-midi et déborde sur le lendemain", () => {
  // Ce n'est pas un défaut : deux demi-journées de travail peuvent se répartir
  // sur le 6 après-midi et le 7 matin, et c'est ainsi qu'un élagueur travaille.
  // Le client, lui, ne verra que la date de début — le 6.
  const occupation = compterOccupation([{ jour: JEU_6, moment: "matin", dureeDemiJournees: 1 }]);
  assert.equal(departPossible(JEU_6, 2, occupation, 1), "apres_midi");
  assert.deepEqual(creneauxDuChantier({ jour: JEU_6, moment: "apres_midi" }, 2).map(cleCreneau), [
    `${JEU_6}:apres_midi`,
    `${VEN_7}:matin`,
  ]);
});

cas("mais un jour dont le lendemain est plein ne prend plus de journée entière", () => {
  const occupation = compterOccupation([
    { jour: JEU_6, moment: "matin", dureeDemiJournees: 1 },
    { jour: VEN_7, moment: "matin", dureeDemiJournees: 2 },
  ]);
  assert.equal(
    departPossible(JEU_6, 2, occupation, 1),
    null,
    "Une journée a été acceptée alors qu'elle déborderait sur un lendemain déjà plein."
  );
});

cas("une journée entière déjà posée ferme le jour", () => {
  const occupation = compterOccupation([{ jour: JEU_6, moment: "matin", dureeDemiJournees: 2 }]);
  assert.equal(departPossible(JEU_6, 1, occupation, 1), null);
});

cas("un chantier de l'après-midi laisse le matin libre", () => {
  const occupation = compterOccupation([{ jour: JEU_6, moment: "apres_midi", dureeDemiJournees: 1 }]);
  assert.equal(departPossible(JEU_6, 1, occupation, 1), "matin");
});

console.log("=== Les équipes ===");

cas("deux équipes tiennent deux chantiers le même jour", () => {
  const occupation = compterOccupation([{ jour: JEU_6, moment: "matin", dureeDemiJournees: 2 }]);
  assert.equal(departPossible(JEU_6, 2, occupation, 2), "matin", "La seconde équipe n'a pas pu être employée.");
});

cas("mais pas trois", () => {
  const occupation = compterOccupation([
    { jour: JEU_6, moment: "matin", dureeDemiJournees: 2 },
    { jour: JEU_6, moment: "matin", dureeDemiJournees: 2 },
  ]);
  assert.equal(departPossible(JEU_6, 2, occupation, 2), null, "Un troisième chantier est passé avec deux équipes.");
});

cas("une seule équipe reste le comportement d'avant", () => {
  const occupation = compterOccupation([{ jour: JEU_6, moment: "matin", dureeDemiJournees: 2 }]);
  assert.equal(departPossible(JEU_6, 2, occupation, 1), null);
});

console.log("=== La durée, qui n'était nulle part ===");

cas("un chantier de deux jours occupe bien deux jours", () => {
  // Le défaut latent : le 7 restait proposable au client suivant.
  const occupation = compterOccupation([{ jour: JEU_6, moment: "matin", dureeDemiJournees: 4 }]);
  assert.equal(departPossible(VEN_7, 1, occupation, 1), null, "Le lendemain d'un chantier de 2 jours reste libre.");
});

cas("un chantier de deux jours commencé vendredi finit lundi, pas samedi", () => {
  const creneaux = creneauxDuChantier({ jour: VEN_7, moment: "matin" }, 4).map(cleCreneau);
  assert.deepEqual(creneaux, [
    `${VEN_7}:matin`,
    `${VEN_7}:apres_midi`,
    `${LUN_10}:matin`,
    `${LUN_10}:apres_midi`,
  ]);
});

cas("un chantier commencé l'après-midi déborde sur le lendemain matin", () => {
  const creneaux = creneauxDuChantier({ jour: JEU_6, moment: "apres_midi" }, 2).map(cleCreneau);
  assert.deepEqual(creneaux, [`${JEU_6}:apres_midi`, `${VEN_7}:matin`]);
});

console.log("=== Les chantiers d'avant, qui n'ont ni moment ni durée ===");

cas("un chantier hérité occupe toujours la journée entière", () => {
  // S'il ne le faisait plus, la migration libérerait des après-midis déjà pris.
  const occupation = compterOccupation([{ jour: JEU_6, moment: null, dureeDemiJournees: null }]);
  assert.equal(departPossible(JEU_6, 1, occupation, 1), null, "Un chantier hérité a libéré une demi-journée.");
});

cas("la durée par défaut est bien une journée", () => {
  assert.equal(DUREE_PAR_DEFAUT_DEMI_JOURNEES, 2);
});

console.log("=== Lire la durée dictée ===");

const ATTENDUS: [string, number | null][] = [
  ["2 jours", 4],
  ["1 jour", 2],
  ["une journée", 2],
  ["deux jours", 4],
  ["une demi-journée", 1],
  ["demi journée", 1],
  ["1/2 journée", 1],
  // Le libellé que la molette affiche — donc celui qu'il redit et qu'il dicte.
  // Il rendait 2 jusqu'au 16 août 2026 : une demi-journée réservait la journée.
  ["½ journée", 1],
  ["2 à 3 jours", 6],
  ["2-3 jours", 6],
  ["3 jours", 6],
  ["1,5 jour", 3],
  ["", null],
  ["2 hommes", null],
  ["broyeur plus camion", null],
];

for (const [texte, attendu] of ATTENDUS) {
  cas(`« ${texte || "(vide)"} » → ${attendu === null ? "inconnu" : attendu + " demi-journées"}`, () => {
    assert.equal(dureeEnDemiJournees(texte), attendu);
  });
}

cas("une durée illisible ne produit jamais un chiffre inventé", () => {
  // `CLAUDE.md` §4 : un champ sans source fiable reste vide. C'est l'appelant
  // qui applique la journée par défaut, en le sachant.
  assert.equal(dureeEnDemiJournees("à voir avec le client"), null);
  assert.equal(dureeEnDemiJournees(null), null);
  assert.equal(dureeEnDemiJournees(undefined), null);
});

cas("sur une fourchette, c'est le majorant qui compte", () => {
  // Sous-réserver ferait accepter une date où le patron n'a pas la place.
  assert.equal(dureeEnDemiJournees("2 à 4 jours"), 8);
});

console.log("=== Ce que la fenêtre et le week-end refusent encore ===");

cas("un samedi reste retenable — il n'est que non suggéré", () => {
  // Choix délibéré, antérieur aux créneaux : on ne PROPOSE jamais le week-end
  // (`premiersJoursLibres`), mais un client qui demande expressément un samedi
  // doit pouvoir l'obtenir. L'avoir refusé ici a cassé deux suites d'un coup.
  const maintenant = new Date("2026-08-01T09:00:00Z");
  const fenetre = fenetreProposition(maintenant);
  assert.equal(jourRetenable("2026-08-08", 1, new Map(), 1, fenetre), true);
});

cas("hors fenêtre, un jour libre reste refusé", () => {
  const maintenant = new Date("2026-08-01T09:00:00Z");
  const fenetre = fenetreProposition(maintenant);
  assert.equal(jourRetenable("2026-08-02", 1, new Map(), 1, fenetre), false, "Le délai minimal n'est plus tenu.");
  assert.equal(jourRetenable("2027-08-02", 1, new Map(), 1, fenetre), false, "La borne haute n'est plus tenue.");
});

cas("dans la fenêtre et libre, le jour passe", () => {
  const maintenant = new Date("2026-08-01T09:00:00Z");
  const fenetre = fenetreProposition(maintenant);
  assert.equal(jourRetenable(JEU_6, 2, new Map(), 1, fenetre), true);
});

console.log("=== Les libellés que le patron lit ===");

cas("les durées se disent en français", () => {
  assert.equal(libelleDuree(1), "une demi-journée");
  assert.equal(libelleDuree(2), "une journée");
  assert.equal(libelleDuree(4), "2 jours");
  // « une journée et demie » : le pluriel générique produisait « 1 jours et
  // demi », deux fautes dans trois mots.
  assert.equal(libelleDuree(3), "une journée et demie");
  assert.equal(libelleDuree(5), "2 jours et demi");
});

if (echecs > 0) {
  console.error(`\n${echecs} contrôle(s) en échec.`);
  process.exit(1);
}
console.log("Tous les contrôles des créneaux sont passés.");
