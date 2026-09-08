import assert from "node:assert/strict";
import {
  absenteCeJour,
  cocheRefusee,
  joursAbsentsDuChantier,
  joursPresentsSurLeChantier,
  joursDuChantier,
  type AbsenceDUneEquipe,
  type ChantierPourAbsence,
} from "../src/lib/equipe-absente";

// **On ne coche pas quelqu'un qui n'est pas là** — son signalement du
// 7 septembre 2026 : *« j'ai mis Julien en congé, la feuille le dit aussi, or je
// peux quand même sélectionner Julien ce jour. »*
//
// Ce que cette suite défend : la RÈGLE, jamais une allure d'écran
// (`CLAUDE.md` §5 bis). Le gris se mesure au navigateur ; ici on fixe qui peut
// être coché, et c'est ce que le serveur applique aussi.

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

/** Julien (rang 1) est en congé le jeudi 10 — la situation de sa capture. */
const CONGE: AbsenceDUneEquipe[] = [
  { rang: 1, premierJour: "2026-09-10", dernierJour: "2026-09-10" },
];

/** Un chantier d'une journée, le 10. */
const LE_10: ChantierPourAbsence = {
  datePlanifiee: "2026-09-10",
  creneauDebut: "matin",
  dureeDemiJournees: 2,
};

console.log("=== On ne coche pas quelqu'un qui n'est pas là ===");

// ── Ce que le chantier traverse ────────────────────────────────────────────

cas("un chantier d'une journée ne traverse qu'un jour", () => {
  assert.deepEqual(joursDuChantier(LE_10), ["2026-09-10"]);
});

cas("un chantier de deux jours en traverse DEUX — la coche vaut pour les deux", () => {
  assert.deepEqual(
    joursDuChantier({ ...LE_10, dureeDemiJournees: 4 }),
    ["2026-09-10", "2026-09-11"]
  );
});

cas("un chantier PAS ENCORE POSÉ ne traverse rien, et ne refuse rien", () => {
  const nulPart = { datePlanifiee: null, creneauDebut: null, dureeDemiJournees: null };
  assert.deepEqual(joursDuChantier(nulPart), []);
  assert.equal(cocheRefusee(1, nulPart, CONGE, false), false);
});

cas("un créneau inconnu vaut matin, et ne fait pas tomber le calcul", () => {
  assert.deepEqual(joursDuChantier({ ...LE_10, creneauDebut: "n'importe quoi" }), ["2026-09-10"]);
});

// ── Qui est absent, et quand ───────────────────────────────────────────────

cas("les bornes de l'absence sont INCLUSES des deux côtés", () => {
  const semaine: AbsenceDUneEquipe[] = [
    { rang: 1, premierJour: "2026-09-10", dernierJour: "2026-09-14" },
  ];
  assert.equal(absenteCeJour(1, "2026-09-09", semaine), false, "la veille");
  assert.equal(absenteCeJour(1, "2026-09-10", semaine), true, "le premier jour");
  assert.equal(absenteCeJour(1, "2026-09-12", semaine), true, "au milieu");
  assert.equal(absenteCeJour(1, "2026-09-14", semaine), true, "le dernier jour");
  assert.equal(absenteCeJour(1, "2026-09-15", semaine), false, "le lendemain");
});

cas("le congé de Julien ne dit rien d'Antoine", () => {
  assert.equal(absenteCeJour(2, "2026-09-10", CONGE), false);
  assert.equal(cocheRefusee(2, LE_10, CONGE, false), false);
});

// ── LE CAS DE SA CAPTURE ───────────────────────────────────────────────────

cas("SA CAPTURE : Julien en congé le 10 ne peut PAS être coché sur le 10", () => {
  assert.deepEqual(joursAbsentsDuChantier(1, LE_10, CONGE), ["2026-09-10"]);
  assert.equal(cocheRefusee(1, LE_10, CONGE, false), true);
});

cas("MAIS il peut être DÉCOCHÉ — sinon l'état faux est sans issue", () => {
  // Sa capture montre Julien COCHÉ un jour où il est absent : la coche est
  // antérieure au congé, et il n'existe aucun autre chemin pour la retirer.
  assert.equal(cocheRefusee(1, LE_10, CONGE, true), false);
});

cas("deux jours dont UN SEUL de congé : ACCEPTÉ, et l'écran dira lequel", () => {
  /*
   * **Contrôle retourné le 8 septembre 2026 — son choix C.**
   *
   * Il défendait la veille l'inverse : refus dès un jour d'absence. C'était un
   * contournement, faute de pouvoir exprimer « Julien vendredi mais pas
   * jeudi ». C l'exprime : la pastille porte les jours de présence.
   */
  const deuxJours = { ...LE_10, dureeDemiJournees: 4 };
  assert.deepEqual(joursAbsentsDuChantier(1, deuxJours, CONGE), ["2026-09-10"]);
  assert.deepEqual(joursPresentsSurLeChantier(1, deuxJours, CONGE), ["2026-09-11"]);
  assert.equal(cocheRefusee(1, deuxJours, CONGE, false), false);
});

cas("un congé qui couvre TOUT le chantier refuse encore", () => {
  // La seule interdiction qui reste : cocher quelqu'un qui ne vient aucun jour
  // ferait partir le chantier avec un nom qui n'y sera jamais.
  const deuxJours = { ...LE_10, dureeDemiJournees: 4 };
  const toutCouvert = [{ rang: 1, premierJour: "2026-09-10", dernierJour: "2026-09-11" }];
  assert.deepEqual(joursPresentsSurLeChantier(1, deuxJours, toutCouvert), []);
  assert.equal(cocheRefusee(1, deuxJours, toutCouvert, false), true);
});

cas("LA DEMI-JOURNÉE COMPTE : un congé d'après-midi ne retire pas le matin", () => {
  // Depuis D2 (8 septembre 2026), une absence peut ne prendre qu'une moitié.
  // Sur la ligne du MATIN, un congé d'après-midi ne doit pas retirer le jour :
  // la pastille annoncerait un jour de moins que la vérité, et le patron
  // enverrait quelqu'un d'autre pour rien.
  const deuxJours = { ...LE_10, dureeDemiJournees: 4 };
  const apresMidi = [{
    rang: 1, premierJour: "2026-09-10", dernierJour: "2026-09-10",
    premierDemi: "apres_midi", dernierDemi: "apres_midi",
  }];
  assert.deepEqual(
    joursPresentsSurLeChantier(1, deuxJours, apresMidi, "matin"),
    ["2026-09-10", "2026-09-11"],
    "le matin a été retiré par un congé d'après-midi"
  );
  assert.deepEqual(
    joursPresentsSurLeChantier(1, deuxJours, apresMidi, "apres_midi"),
    ["2026-09-11"],
    "l'après-midi n'a pas été retiré"
  );
  // Sans préciser la moitié, on répond sur la journée — le résumé d'un jour.
  assert.deepEqual(joursPresentsSurLeChantier(1, deuxJours, apresMidi), ["2026-09-11"]);
});

cas("SANS congé, elle est là tous les jours — rien à écrire sur la pastille", () => {
  const deuxJours = { ...LE_10, dureeDemiJournees: 4 };
  assert.deepEqual(joursPresentsSurLeChantier(1, deuxJours, []), ["2026-09-10", "2026-09-11"]);
});

cas("un chantier LOIN du congé ne refuse rien", () => {
  const plusTard = { ...LE_10, datePlanifiee: "2026-09-17" };
  assert.deepEqual(joursAbsentsDuChantier(1, plusTard, CONGE), []);
  assert.equal(cocheRefusee(1, plusTard, CONGE, false), false);
});

cas("aucune absence : rien ne change, et c'est le cas de tous les jours", () => {
  assert.equal(cocheRefusee(1, LE_10, [], false), false);
  assert.deepEqual(joursAbsentsDuChantier(1, LE_10, []), []);
});

// ── Le contrôle sait-il rougir ? ───────────────────────────────────────────

cas("il rougirait contre la version d'avant", () => {
  // La version d'avant ne consultait AUCUNE absence : elle aurait laissé
  // cocher dans tous les cas. Si ce contrôle passait quand même, il ne
  // prouverait rien.
  assert.equal(cocheRefusee(1, LE_10, CONGE, false), true, "le cas qu'il a signalé");
  // Et il rougirait aussi contre la version d'HIER, qui refusait dès un jour.
  assert.equal(
    cocheRefusee(1, { ...LE_10, dureeDemiJournees: 4 }, CONGE, false),
    false,
    "le refus d'hier tient encore : le choix C n'est pas appliqué"
  );
});

console.log(echecs === 0 ? "\n✅ On ne coche pas un absent" : `\n❌ ${echecs} cas`);
process.exit(echecs === 0 ? 0 : 1);
