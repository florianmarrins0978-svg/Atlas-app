import assert from "node:assert/strict";
import { toucherUnJourDuClient } from "../src/lib/propositions-de-jours";
import { joursDuBloc } from "../src/lib/disponibilites";

// LES JOURS QUE LE CLIENT PROPOSE — le geste que le patron a dicté le
// 20 septembre 2026, et qu'il a fallu qu'il réclame une seconde fois :
// « on peut pas désélectionner un jour sur les 4 et le mettre ailleurs en
// recliquant ailleurs ».
//
// C'est le geste de SON écran d'envoi (`propositions-de-jours.ts`, sa règle du
// 17 septembre), appliqué à la seule liste du client. Trois gestes, et le
// troisième — combler — manquait : sans lui, un appui ailleurs remplace toute
// la sélection.

// Le client raisonne en JOURS : c'est tout ce que sa page reçoit.
const QUATRE_JOURS = 4;
const UN_JOUR = 1;

let echecs = 0;
function cas(nom: string, verifier: () => void) {
  try {
    verifier();
    console.log(`  ok  ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  RATÉ  ${nom}`);
    console.error(`        ${(e as Error).message}`);
  }
}

console.log("=== Le client pose ses jours comme le patron pose les siens ===");

cas("un premier appui pose le chantier entier, d'affilée", () => {
  const jours = toucherUnJourDuClient([], "2026-10-12", QUATRE_JOURS);
  assert.deepEqual(jours, joursDuBloc("2026-10-12", QUATRE_JOURS * 2));
  assert.equal(jours.length, 4, "Un chantier de quatre jours doit en poser quatre.");
});

cas("un appui sur un jour posé l'efface, et RIEN ne se décale", () => {
  const quatre = toucherUnJourDuClient([], "2026-10-12", QUATRE_JOURS);
  const trois = toucherUnJourDuClient(quatre, quatre[2], QUATRE_JOURS);
  assert.deepEqual(trois, [quatre[0], quatre[1], quatre[3]]);
});

cas("l'appui suivant COMBLE le jour qui manque, où elle veut", () => {
  // Le geste qu'il a réclamé : « désélectionner un jour sur les 4 et le mettre
  // ailleurs ». Sans « combler », cet appui reposait le bloc entier.
  const quatre = toucherUnJourDuClient([], "2026-10-12", QUATRE_JOURS);
  const trois = toucherUnJourDuClient(quatre, quatre[2], QUATRE_JOURS);
  const remis = toucherUnJourDuClient(trois, "2026-10-22", QUATRE_JOURS);
  assert.equal(remis.length, 4, "Le jour effacé n'a pas été remis ailleurs.");
  assert.ok(remis.includes("2026-10-22"), "Le jour touché n'est pas entré dans la liste.");
  for (const j of trois) {
    assert.ok(remis.includes(j), `Combler a fait bouger ${j}, qu'elle n'avait pas touché.`);
  }
});

cas("une fois complète, un appui ailleurs repose le bloc entier", () => {
  const quatre = toucherUnJourDuClient([], "2026-10-12", QUATRE_JOURS);
  const ailleurs = toucherUnJourDuClient(quatre, "2026-11-02", QUATRE_JOURS);
  assert.deepEqual(ailleurs, joursDuBloc("2026-11-02", QUATRE_JOURS * 2));
});

cas("un chantier d'un jour n'ouvre JAMAIS une seconde proposition", () => {
  // Sur l'écran du patron, un second appui vaut « une ou deux dates au choix ».
  // Chez le client, ce serait deux jours pour un chantier qui en prend un.
  const un = toucherUnJourDuClient([], "2026-10-12", UN_JOUR);
  assert.deepEqual(un, ["2026-10-12"]);
  const autre = toucherUnJourDuClient(un, "2026-10-15", UN_JOUR);
  assert.deepEqual(autre, ["2026-10-15"], "Le jour a été ajouté au lieu de remplacer.");
});

cas("retoucher l'unique jour d'un chantier d'un jour le défait", () => {
  const un = toucherUnJourDuClient([], "2026-10-12", UN_JOUR);
  assert.deepEqual(toucherUnJourDuClient(un, "2026-10-12", UN_JOUR), []);
});

cas("une liste vidée repart sur le bloc entier, pas sur un jour seul", () => {
  const un = toucherUnJourDuClient([], "2026-10-12", QUATRE_JOURS);
  let jours = un;
  for (const j of [...un]) jours = toucherUnJourDuClient(jours, j, QUATRE_JOURS);
  assert.deepEqual(jours, []);
  assert.equal(toucherUnJourDuClient(jours, "2026-10-19", QUATRE_JOURS).length, 4);
});

cas("les jours rendus sont toujours triés — la phrase les lit dans l'ordre", () => {
  const quatre = toucherUnJourDuClient([], "2026-10-12", QUATRE_JOURS);
  const trois = toucherUnJourDuClient(quatre, quatre[3], QUATRE_JOURS);
  const remis = toucherUnJourDuClient(trois, "2026-10-05", QUATRE_JOURS);
  assert.deepEqual(remis, [...remis].sort(), "Les jours ne sont pas triés.");
});

if (echecs > 0) {
  console.error(`\n${echecs} contrôle(s) en échec.`);
  process.exit(1);
}
console.log("Tous les contrôles des jours du client sont passés.");
