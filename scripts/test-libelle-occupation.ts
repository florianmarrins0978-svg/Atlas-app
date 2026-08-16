import assert from "node:assert/strict";
import { libelleOccupation, type JourIso } from "../src/server/disponibilites";

// Ce qu'un chantier OCCUPE, dit en toutes lettres.
//
// **LE DÉFAUT QUE CETTE SUITE EMPÊCHE DE REVENIR.** La ligne du planning
// écrivait la demi-journée de DÉPART. Comme un chantier posé dure une journée
// entière par défaut, le cas le plus courant du produit annonçait « matin »
// pour une journée pleine — et un chantier de trois jours l'annonçait aussi.
// Le patron, capture à l'appui le 13 août 2026 : « ça laisse à penser que juste
// le matin est bloqué alors que c'est la journée ».
//
// Rien de tout cela ne se voit sur une suite navigateur : l'écran affichait un
// mot parfaitement plausible. C'est en le comparant à la durée qu'il ment.
//
// Les repères de dates, tous vérifiés :
//   ven. 14 août 2026 · lun. 17 · jeu. 20 · ven. 21 · lun. 24 · mar. 25

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

const j = (s: string) => s as JourIso;

console.log("=== Ce que le chantier occupe, et non son heure de départ ===\n");

// ── Le cas qui a motivé tout le lot ─────────────────────────────────────────
cas("une journée entière dit « journée », JAMAIS « matin »", () => {
  const o = libelleOccupation(j("2026-08-14"), "matin", 2);
  assert.equal(o.texte, "journée");
  assert.notEqual(o.texte, "matin");
  assert.equal(o.porteLaDate, false);
});

cas("une vraie demi-journée garde son mot", () => {
  assert.equal(libelleOccupation(j("2026-08-17"), "matin", 1).texte, "matin");
  assert.equal(libelleOccupation(j("2026-08-20"), "apres_midi", 1).texte, "après-midi");
});

// ── Plusieurs jours : les mots que le patron a arrêtés le 14 août 2026 ──────
cas("trois jours partis un vendredi sautent le week-end et disent « du 21 au 25 août »", () => {
  const o = libelleOccupation(j("2026-08-21"), "matin", 6);
  assert.equal(o.texte, "du 21 au 25 août");
  assert.equal(o.porteLaDate, true);
});

cas("une journée et demie partie l'après-midi déborde sur le lendemain", () => {
  const o = libelleOccupation(j("2026-08-24"), "apres_midi", 3);
  assert.equal(o.texte, "du 24 au 25 août");
  assert.equal(o.porteLaDate, true);
});

// **LE PIÈGE QUE PERSONNE NE VOIT VENIR.** Deux demi-journées à partir de
// l'APRÈS-MIDI, ce n'est pas une journée : c'est cet après-midi-là plus le
// matin suivant. « journée » serait faux, et l'artisan croirait sa matinée du
// lendemain libre.
cas("deux demi-journées parties l'après-midi ne sont PAS une « journée »", () => {
  const o = libelleOccupation(j("2026-08-17"), "apres_midi", 2);
  assert.notEqual(o.texte, "journée");
  assert.equal(o.texte, "du 17 au 18 août");
});

cas("un chantier parti le vendredi après-midi reprend le LUNDI, pas le samedi", () => {
  assert.equal(libelleOccupation(j("2026-08-21"), "apres_midi", 2).texte, "du 21 au 24 août");
});

// ── Le mois qui change ──────────────────────────────────────────────────────
// « du 31 au 2 septembre » se lirait comme le 31 septembre. Le mois de départ
// doit alors être écrit, et c'est le seul cas où il l'est deux fois.
cas("à cheval sur deux mois, les deux mois sont écrits", () => {
  const o = libelleOccupation(j("2026-08-31"), "matin", 6);
  assert.equal(o.texte, "du 31 août au 2 septembre");
});

// ── Ce qui existait avant les créneaux, et ne doit pas changer de sens ──────
// Un chantier posé avant la migration des créneaux n'a ni moment ni durée. Il
// valait « journée entière à partir du matin » partout ailleurs
// (`compterOccupation`) : le libellé doit dire exactement la même chose, sinon
// l'écran et la réservation se contrediraient sur les mêmes lignes.
cas("sans moment ni durée : une journée entière, comme le reste du produit", () => {
  const o = libelleOccupation(j("2026-08-14"), null, null);
  assert.equal(o.texte, "journée");
  assert.equal(o.porteLaDate, false);
});

cas("une durée absurde ne fait pas tomber l'écran", () => {
  assert.equal(libelleOccupation(j("2026-08-14"), "matin", 0).texte, "matin");
  assert.equal(libelleOccupation(j("2026-08-14"), "matin", -3).texte, "matin");
  assert.equal(libelleOccupation(j("2026-08-14"), "matin", 1.7).texte, "matin");
});

// ── `porteLaDate` : ce que l'appelant en fait ───────────────────────────────
// Sans lui, la feuille du chevron écrirait « 21 août · du 21 au 25 août ».
cas("porteLaDate distingue exactement les libellés qui contiennent déjà les jours", () => {
  for (const duree of [1, 2]) {
    assert.equal(libelleOccupation(j("2026-08-14"), "matin", duree).porteLaDate, false);
  }
  for (const duree of [3, 4, 6, 20]) {
    const o = libelleOccupation(j("2026-08-14"), "matin", duree);
    assert.equal(o.porteLaDate, true, `durée ${duree} : ${o.texte}`);
    assert.match(o.texte, /^du \d/);
  }
});

// Cent jours, la borne haute de la liste des durées : rien ne doit s'emballer.
cas("cent jours restent une plage lisible", () => {
  const o = libelleOccupation(j("2026-08-14"), "matin", 200);
  assert.equal(o.porteLaDate, true);
  assert.match(o.texte, /^du 14 août au \d+ \p{L}+$/u);
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
