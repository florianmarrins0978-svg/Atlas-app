import assert from "node:assert/strict";
import {
  avecLaDemi,
  creneauxOccupes,
  demiJourneesAPoser,
  resumeDesCreneaux,
  sansLaDemi,
} from "../src/lib/creneaux-chantier";
import type { Creneau } from "../src/lib/disponibilites";

/**
 * OÙ UN CHANTIER EST POSÉ — les règles, sans base ni écran.
 *
 * **Sa demande du 10 septembre 2026**, planche retenue : libérer une
 * demi-journée d'un chantier, la voir attendre dans « Sans date », et la
 * reposer ailleurs.
 *
 * **Ce que ces contrôles gardent, et c'est le point dangereux du lot :** un
 * chantier SANS créneau enregistré vaut encore son bloc d'un seul tenant. La
 * migration 0085 n'a rien recopié ; lire une liste vide comme « rien d'occupé »
 * libérerait d'un coup toutes les demi-journées déjà prises, et l'écran d'envoi
 * proposerait à un client un jour où quelqu'un travaille — la panne du 22 août
 * 2026, en pire.
 */

let echecs = 0;
function essai(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

const c = (jour: string, moment: "matin" | "apres_midi"): Creneau =>
  ({ jour, moment }) as Creneau;

// ─── LE REPLI, ET C'EST LUI QUI PROTÈGE LE PLANNING ────────────────────────

essai("sans aucune ligne, le chantier vaut son bloc d'un seul tenant", () => {
  const pose = { jour: "2026-09-11", moment: "apres_midi", dureeDemiJournees: 4 };
  assert.deepEqual(
    creneauxOccupes(pose, []).map((x) => `${x.jour} ${x.moment}`),
    [
      "2026-09-11 apres_midi",
      "2026-09-14 matin",
      "2026-09-14 apres_midi",
      "2026-09-15 matin",
    ],
    "le week-end n'est pas sauté, ou la durée n'est pas lue"
  );
});

essai("une durée absente vaut la journée, jamais rien", () => {
  const pose = { jour: "2026-09-14", moment: "matin", dureeDemiJournees: null };
  assert.equal(creneauxOccupes(pose, []).length, 2);
});

essai("un chantier sans jour n'occupe rien", () => {
  assert.deepEqual(creneauxOccupes({ jour: null, moment: null, dureeDemiJournees: 4 }, []), []);
});

essai("dès qu'il y a des lignes, ce sont ELLES qui font foi", () => {
  const pose = { jour: "2026-09-11", moment: "apres_midi", dureeDemiJournees: 4 };
  const lignes = [c("2026-09-14", "matin"), c("2026-09-22", "apres_midi")];
  assert.deepEqual(creneauxOccupes(pose, lignes), lignes, "le bloc d'origine reprend la main");
});

// ─── CE QUI ATTEND UNE PLACE ───────────────────────────────────────────────

essai("ce qui manque est la différence entre le demandé et le posé", () => {
  const pose = { jour: "2026-09-11", moment: "matin", dureeDemiJournees: 4 };
  assert.equal(demiJourneesAPoser(pose, [c("2026-09-11", "matin")]), 3);
  assert.equal(demiJourneesAPoser(pose, []), 0, "un bloc entier n'attend rien");
});

essai("posé plus longtemps que demandé n'attend pas « moins un »", () => {
  const pose = { jour: "2026-09-11", moment: "matin", dureeDemiJournees: 2 };
  const lignes = [c("2026-09-11", "matin"), c("2026-09-11", "apres_midi"), c("2026-09-14", "matin")];
  assert.equal(demiJourneesAPoser(pose, lignes), 0);
});

// ─── LIBÉRER, PUIS REPOSER — son geste ─────────────────────────────────────

essai("libérer une demi-journée laisse les autres en place", () => {
  const pose = { jour: "2026-09-11", moment: "matin", dureeDemiJournees: 4 };
  const restants = sansLaDemi(pose, [], c("2026-09-11", "matin"));
  assert.deepEqual(
    restants.map((x) => `${x.jour} ${x.moment}`),
    ["2026-09-11 apres_midi", "2026-09-14 matin", "2026-09-14 apres_midi"]
  );
});

essai("libérer une demi-journée qu'il n'occupe pas ne retire rien", () => {
  const pose = { jour: "2026-09-11", moment: "matin", dureeDemiJournees: 2 };
  assert.equal(sansLaDemi(pose, [], c("2026-09-30", "matin")).length, 2);
});

essai("reposer un morceau l'ajoute à sa place dans le temps", () => {
  const pose = { jour: "2026-09-14", moment: "matin", dureeDemiJournees: 3 };
  const lignes = [c("2026-09-14", "matin"), c("2026-09-14", "apres_midi")];
  assert.deepEqual(
    avecLaDemi(pose, lignes, c("2026-09-11", "apres_midi")).map((x) => x.jour),
    ["2026-09-11", "2026-09-14", "2026-09-14"],
    "le morceau reposé AVANT le reste doit passer devant"
  );
});

essai("reposer deux fois la même demi-journée n'occupe pas deux places", () => {
  const pose = { jour: "2026-09-14", moment: "matin", dureeDemiJournees: 2 };
  const lignes = [c("2026-09-14", "matin")];
  assert.equal(avecLaDemi(pose, lignes, c("2026-09-14", "matin")).length, 1);
});

// ─── LES TROIS COLONNES D'ORIGINE, RECALCULÉES ─────────────────────────────

essai("le résumé rend le PREMIER créneau, dans l'ordre du temps", () => {
  const r = resumeDesCreneaux([
    c("2026-09-15", "matin"),
    c("2026-09-11", "apres_midi"),
    c("2026-09-11", "matin"),
  ]);
  assert.deepEqual(r, { jour: "2026-09-11", moment: "matin", nombre: 3 });
});

essai("plus aucun créneau : le chantier n'est plus posé", () => {
  assert.deepEqual(resumeDesCreneaux([]), { jour: null, moment: null, nombre: 0 });
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} Où un chantier est posé — ${echecs} échec(s).`);
if (echecs > 0) process.exit(1);
