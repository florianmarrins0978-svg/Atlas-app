/**
 * LE GESTE QU'IL A DICTÉ, éprouvé sans navigateur — 17 et 18 septembre 2026,
 * planche `appli/deux-jours-pas-colles.html`.
 *
 * Ses mots, un par cas : « si on a un chantier de 8 jours, si je clique sur le
 * 23, qu'ils mettent les 8 d'affilée » · « le 25, je l'enlève : je clique
 * dessus pour l'enlever » · « il ne doit pas se décaler d'une case, il doit
 * s'effacer, et on clique sur le jour qu'on souhaite pour le remettre » · « un
 * bouton on/off pour si on souhaite faire une deuxième proposition ».
 *
 * Et ce qui ne bouge pas : « une ou deux dates, jamais plus » (`docs/AGENT.md`
 * §2.2) — les cas d'avant, écrits sur `basculerJour`, vivent ici désormais.
 *
 *   npx tsx scripts/test-propositions-de-jours.ts
 */
import assert from "node:assert/strict";
import {
  basculerLaSeconde,
  blocEnEvitant,
  gesteSurUnJour,
  joursManquants,
  toucherUnJour,
  type EtatDesPropositions,
} from "../src/lib/propositions-de-jours";
import {
  creneauxSurLesJours,
  estUnBlocDAffilee,
  joursDuBloc,
  joursDuChantier,
  propositionRetenable,
} from "../src/lib/disponibilites";
import { joursEnToutesLettres } from "../src/lib/jour";

let reussis = 0;
let echoues = 0;
function cas(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ ${nom}`);
    reussis++;
  } catch (err) {
    console.error(`❌ ${nom}`);
    console.error(`   ${err instanceof Error ? err.message : err}`);
    echoues++;
  }
}

// Septembre 2026 : le 18 est un vendredi, le 21 un lundi — sa capture.
const VIDE: EtatDesPropositions = { propositions: [], secondeVoulue: false, active: 0 };
const DEUX_JOURS = 4;
const HUIT_JOURS = 16;

console.log("=== Un appui pose le bloc d'affilée ===");

cas("un chantier de 8 jours : un appui sur le 23 pose les 8 d'affilée, week-ends sautés", () => {
  const e = toucherUnJour(VIDE, "2026-09-23", HUIT_JOURS);
  assert.deepEqual(e.propositions, [[
    "2026-09-23", "2026-09-24", "2026-09-25", "2026-09-28",
    "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02",
  ]]);
});

cas("les jours du bloc sont ceux que l'acceptation réservera", () => {
  assert.deepEqual(joursDuBloc("2026-09-18", DEUX_JOURS), ["2026-09-18", "2026-09-21"]);
  assert.equal(joursDuChantier(1), 1, "une demi-journée occupe un jour");
  assert.equal(joursDuChantier(3), 2, "un jour et demi occupe deux jours");
});

console.log("\n=== Un appui sur un jour du chantier l'efface, rien ne bouge ===");

cas("effacer le 25 sur 8 jours : sept jours restent où ils sont, et il en manque un", () => {
  const pose = toucherUnJour(VIDE, "2026-09-23", HUIT_JOURS);
  const e = toucherUnJour(pose, "2026-09-25", HUIT_JOURS);
  assert.deepEqual(e.propositions[0], [
    "2026-09-23", "2026-09-24", "2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02",
  ]);
  assert.equal(joursManquants(e.propositions[0], HUIT_JOURS), 1);
  assert.deepEqual(gesteSurUnJour(e, "2026-10-05", HUIT_JOURS), { geste: "ajouter", proposition: 0 });
});

cas("le 18 et le 22 : toucher le 18, effacer le 21, toucher le 22", () => {
  let e = toucherUnJour(VIDE, "2026-09-18", DEUX_JOURS);
  assert.deepEqual(e.propositions, [["2026-09-18", "2026-09-21"]]);
  e = toucherUnJour(e, "2026-09-21", DEUX_JOURS);
  assert.deepEqual(e.propositions, [["2026-09-18"]]);
  e = toucherUnJour(e, "2026-09-22", DEUX_JOURS);
  assert.deepEqual(e.propositions, [["2026-09-18", "2026-09-22"]]);
});

cas("quand rien ne manque, un appui ailleurs pose un nouveau bloc", () => {
  const e = toucherUnJour(toucherUnJour(VIDE, "2026-09-18", DEUX_JOURS), "2026-09-28", DEUX_JOURS);
  assert.deepEqual(e.propositions, [["2026-09-28", "2026-09-29"]]);
});

console.log("\n=== L'interrupteur « Vous proposez deux dates » ===");

cas("allumé, le prochain appui pose le premier jour de la seconde, en évitant la première", () => {
  let e = basculerLaSeconde(toucherUnJour(VIDE, "2026-09-18", DEUX_JOURS));
  assert.equal(e.secondeVoulue, true);
  assert.deepEqual(gesteSurUnJour(e, "2026-09-17", DEUX_JOURS), { geste: "poser_le_bloc", proposition: 1 });
  e = toucherUnJour(e, "2026-09-17", DEUX_JOURS);
  // Le 18 est tenu par la première : la seconde saute au 22.
  assert.deepEqual(e.propositions, [["2026-09-18", "2026-09-21"], ["2026-09-17", "2026-09-22"]]);
});

cas("éteint, la seconde disparaît", () => {
  let e = basculerLaSeconde(toucherUnJour(VIDE, "2026-09-18", DEUX_JOURS));
  e = toucherUnJour(e, "2026-09-23", DEUX_JOURS);
  e = basculerLaSeconde(e);
  assert.deepEqual(e.propositions, [["2026-09-18", "2026-09-21"]]);
  assert.equal(e.secondeVoulue, false);
});

cas("effacer un jour de la seconde : c'est elle qui manque, et c'est elle que l'appui suivant comble", () => {
  let e = basculerLaSeconde(toucherUnJour(VIDE, "2026-09-18", DEUX_JOURS));
  e = toucherUnJour(e, "2026-09-23", DEUX_JOURS);
  e = toucherUnJour(e, "2026-09-24", DEUX_JOURS);
  assert.deepEqual(e.propositions[1], ["2026-09-23"]);
  e = toucherUnJour(e, "2026-09-30", DEUX_JOURS);
  assert.deepEqual(e.propositions, [["2026-09-18", "2026-09-21"], ["2026-09-23", "2026-09-30"]]);
});

console.log("\n=== Une ou deux dates, jamais trois — le geste d'avant, sur une journée ===");

cas("un premier appui retient, un second sur le même relâche — et l'appui suivant repose un bloc", () => {
  const e = toucherUnJour(VIDE, "2026-08-12", 2);
  assert.deepEqual(e.propositions, [["2026-08-12"]]);
  const vide = toucherUnJour(e, "2026-08-12", 2);
  assert.deepEqual(vide.propositions, [[]]);
  assert.deepEqual(gesteSurUnJour(vide, "2026-08-14", DEUX_JOURS), { geste: "poser_le_bloc", proposition: 0 });
  assert.deepEqual(toucherUnJour(vide, "2026-08-14", DEUX_JOURS).propositions, [["2026-08-14", "2026-08-17"]]);
});

cas("deux dates tiennent ensemble, et l'interrupteur s'allume tout seul", () => {
  const e = toucherUnJour(toucherUnJour(VIDE, "2026-08-12", 2), "2026-08-14", 2);
  assert.deepEqual(e.propositions, [["2026-08-12"], ["2026-08-14"]]);
  assert.equal(e.secondeVoulue, true);
});

cas("la troisième chasse la PLUS ANCIENNE, elle n'est pas refusée en silence", () => {
  // Un bouton qui ne répond pas se lit comme une panne : le patron appuierait
  // trois fois avant de comprendre.
  const e = toucherUnJour(toucherUnJour(toucherUnJour(VIDE, "2026-08-12", 2), "2026-08-14", 2), "2026-08-17", 2);
  assert.deepEqual(e.propositions, [["2026-08-17"], ["2026-08-14"]]);
});

cas("retirer puis remettre une date la rend la plus récente : c'est l'autre qui cède ensuite", () => {
  let e = toucherUnJour(toucherUnJour(VIDE, "2026-08-12", 2), "2026-08-14", 2);
  e = toucherUnJour(e, "2026-08-12", 2);       // retirée : sa place reste, vide
  assert.deepEqual(e.propositions, [[], ["2026-08-14"]]);
  e = toucherUnJour(e, "2026-08-12", 2);       // remise à sa place, dernière touchée
  assert.deepEqual(e.propositions, [["2026-08-12"], ["2026-08-14"]]);
  e = toucherUnJour(e, "2026-08-17", 2);       // la 14, plus ancienne, cède
  assert.deepEqual(e.propositions, [["2026-08-12"], ["2026-08-17"]]);
});

cas("relâcher la seconde date d'une journée la ferme, et éteint l'interrupteur", () => {
  const e = toucherUnJour(toucherUnJour(toucherUnJour(VIDE, "2026-08-12", 2), "2026-08-14", 2), "2026-08-14", 2);
  assert.deepEqual(e.propositions, [["2026-08-12"]]);
  assert.equal(e.secondeVoulue, false);
});

console.log("\n=== Ce que l'acceptation réserve ===");

cas("des jours choisis se prennent entiers, matin puis après-midi, jusqu'à la durée", () => {
  assert.deepEqual(creneauxSurLesJours(["2026-09-22", "2026-09-18"], 4), [
    { jour: "2026-09-18", moment: "matin" },
    { jour: "2026-09-18", moment: "apres_midi" },
    { jour: "2026-09-22", moment: "matin" },
    { jour: "2026-09-22", moment: "apres_midi" },
  ]);
  assert.deepEqual(creneauxSurLesJours(["2026-09-18", "2026-09-22"], 3).map((c) => `${c.jour}:${c.moment}`), [
    "2026-09-18:matin", "2026-09-18:apres_midi", "2026-09-22:matin",
  ]);
});

cas("un bloc d'affilée se reconnaît, un bloc troué non", () => {
  assert.equal(estUnBlocDAffilee(["2026-09-18", "2026-09-21"], DEUX_JOURS), true);
  assert.equal(estUnBlocDAffilee(["2026-09-18", "2026-09-22"], DEUX_JOURS), false);
  assert.equal(estUnBlocDAffilee([], DEUX_JOURS), false);
});

cas("des jours choisis tiennent si chaque demi-journée a une équipe de libre", () => {
  const fenetre = { debut: "2026-09-01", fin: "2026-12-31" };
  const libre = new Map<string, number>();
  assert.equal(propositionRetenable(["2026-09-18", "2026-09-22"], DEUX_JOURS, libre, 1, fenetre), true);
  const pris = new Map([["2026-09-22:apres_midi", 1]]);
  assert.equal(propositionRetenable(["2026-09-18", "2026-09-22"], DEUX_JOURS, pris, 1, fenetre), false);
  assert.equal(propositionRetenable(["2026-09-18", "2026-09-22"], DEUX_JOURS, pris, 2, fenetre), true);
  assert.equal(propositionRetenable(["2026-09-18", "2027-03-01"], DEUX_JOURS, libre, 1, fenetre), false, "hors fenêtre");
});

cas("le bloc de la seconde saute ce que la première tient", () => {
  assert.deepEqual(blocEnEvitant("2026-09-17", DEUX_JOURS, new Set(["2026-09-18", "2026-09-21"])), ["2026-09-17", "2026-09-22"]);
  assert.deepEqual(blocEnEvitant("2026-09-17", DEUX_JOURS, new Set()), ["2026-09-17", "2026-09-18"]);
});

console.log("\n=== Ce que la cliente lit — sa règle du 18 septembre ===");

cas("dans un même mois, le mois ne s'écrit qu'au premier et au dernier jour", () => {
  const en2026 = new Date("2026-09-18T12:00:00Z");
  assert.equal(
    joursEnToutesLettres(["2026-09-18", "2026-09-21", "2026-09-22", "2026-09-23"], en2026),
    "le vendredi 18 septembre, le lundi 21, le mardi 22 et le mercredi 23 septembre"
  );
  assert.equal(joursEnToutesLettres(["2026-09-18", "2026-09-22"], en2026), "le vendredi 18 septembre et le mardi 22 septembre");
  assert.equal(joursEnToutesLettres(["2026-09-18"], en2026), "le vendredi 18 septembre");
});

cas("à cheval sur deux mois, chaque jour porte le sien", () => {
  const en2026 = new Date("2026-09-18T12:00:00Z");
  assert.equal(
    joursEnToutesLettres(["2026-09-30", "2026-10-01", "2026-10-02"], en2026),
    "le mercredi 30 septembre, le jeudi 1er octobre et le vendredi 2 octobre"
  );
});

console.log(`\n${reussis} réussi(s), ${echoues} échoué(s)`);
process.exit(echoues === 0 ? 0 : 1);
