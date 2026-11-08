import assert from "node:assert/strict";
import {
  HEURES_PROPOSEES,
  MINUTES_MAX,
  MINUTES_PROPOSEES,
  caseDuChantier,
  dureeLisible,
  enHeuresEtMinutes,
  heuresRecues,
  intervenantsDuJour,
  libelleHeures,
  libelleMinutes,
  minutesDe,
  phrasePourLAttestation,
  type IntervenantDuJour,
} from "../src/lib/heures-d-intervention";

/**
 * LES HEURES DU RETOUR DU JOUR : la règle pure (le crédit d'impôt, lot 2).
 *
 * Planche `appli/soignee/credit-d-impot.html`, « Retour du jour ». Ce que
 * cette suite défend : **seuls ceux qui étaient sur le chantier ce jour-là
 * tapent des heures**, et rien ne s'écrit hors des roulettes. Une heure au nom
 * d'un salarié en congé, ou au nom du patron quand ses gars y étaient, part
 * sur une attestation fiscale et y reste.
 */

let echecs = 0;
function cas(nom: string, verifier: () => void): void {
  try {
    verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

const JOUR = "2026-11-05";
const CHANTIER = {
  id: "c1",
  nom: "Entretien du jardin",
  creneaux: [
    { jour: JOUR, moment: "matin" as const },
    { jour: JOUR, moment: "apres_midi" as const },
    { jour: "2026-11-06", moment: "matin" as const },
  ],
};
const SALARIES = [
  { rang: 1, nom: "Martin Julien", numero: 1 },
  { rang: 2, nom: "Roux Léa", numero: 2 },
  { rang: 3, nom: null, numero: 5 },
  { rang: 4, nom: "Petit Marc", numero: null },
];
const base = {
  jour: JOUR,
  chantier: CHANTIER,
  coches: [] as { chantierId: string; jour: string | null; demi: string; rang: number }[],
  absences: [],
  nombreSalaries: 4,
  salaries: SALARIES,
  patron: "Thomas Leroy",
};

console.log("=== Les heures du retour du jour ===");

cas("les roulettes : 0 à 24 h, puis 00 à 59, une par une", () => {
  assert.deepEqual([HEURES_PROPOSEES[0], HEURES_PROPOSEES.at(-1), HEURES_PROPOSEES.length], [0, 24, 25]);
  assert.deepEqual([MINUTES_PROPOSEES[0], MINUTES_PROPOSEES.at(-1), MINUTES_PROPOSEES.length], [0, 59, 60]);
  assert.equal(libelleHeures(3), "3 h");
  assert.equal(libelleMinutes(5), "05");
  assert.equal(MINUTES_MAX, 1499);
});

cas("les deux roulettes donnent des minutes, et rien hors de leurs crans", () => {
  assert.equal(minutesDe(24, 59), 1499);
  assert.equal(minutesDe(3, 30), 210);
  assert.equal(minutesDe(25, 0), null);
  assert.equal(minutesDe(3, 60), null);
  assert.equal(minutesDe(2.5, 0), null);
  assert.equal(minutesDe(-1, 0), null);
  assert.deepEqual(enHeuresEtMinutes(150), { heures: 2, minutes: 30 });
  assert.deepEqual(enHeuresEtMinutes(1500), { heures: 0, minutes: 0 });
});

cas("la durée s'écrit comme sur l'attestation", () => {
  assert.equal(dureeLisible(150), "2 h 30");
  assert.equal(dureeLisible(180), "3 h");
  assert.equal(dureeLisible(45), "0 h 45");
  assert.equal(dureeLisible(125), "2 h 05");
});

cas("la case du chantier : la facture d'abord, puis le devis, puis la règle d'une pièce neuve", () => {
  const s = { declaree: true, activiteACote: false, clientNom: "Lambert", clientCivilite: "mr" as const };
  assert.equal(caseDuChantier({ ...s, facture: false, devis: true }), false, "la facture décochée ne commande pas");
  assert.equal(caseDuChantier({ ...s, facture: true, devis: false }), true);
  assert.equal(caseDuChantier({ ...s, facture: null, devis: false }), false, "le devis décoché ne commande pas");
  assert.equal(caseDuChantier({ ...s, facture: null, devis: null }), true, "un passage d'entretien sans devis");
  assert.equal(caseDuChantier({ ...s, activiteACote: true, facture: null, devis: null }), false);
});

cas("la case n'est jamais retenue pour une entreprise non déclarée, ni pour un client entreprise", () => {
  assert.equal(caseDuChantier({ declaree: false, activiteACote: false, clientNom: "Lambert", clientCivilite: "mr", facture: true, devis: true }), false);
  assert.equal(caseDuChantier({ declaree: true, activiteACote: false, clientNom: "Jardins Martin", clientCivilite: "entreprise", facture: true, devis: true }), false);
});

cas("« Pour l'attestation de Mr. Lambert. »", () => {
  assert.equal(phrasePourLAttestation("Lambert", "mr"), "Pour l'attestation de Mr. Lambert.");
  assert.equal(phrasePourLAttestation("Vasseur", "mme"), "Pour l'attestation de Mme Vasseur.");
});

cas("un chantier qui n'est pas posé ce jour-là : personne", () => {
  assert.deepEqual(intervenantsDuJour({ ...base, jour: "2026-11-07", coches: [{ chantierId: "c1", jour: null, demi: "matin", rang: 1 }] }), []);
  assert.deepEqual(intervenantsDuJour({ ...base, jour: "2026-11-07", nombreSalaries: 0 }), []);
});

cas("aucun salarié : le patron seul, n° 0, avec son nom", () => {
  const r = intervenantsDuJour({ ...base, nombreSalaries: 0 });
  assert.deepEqual(r, [{ numero: 0, nom: "Thomas Leroy", libelle: "Thomas Leroy" }]);
});

cas("le patron sans nom écrit : « Vous » à l'écran, rien sur le papier", () => {
  const r = intervenantsDuJour({ ...base, nombreSalaries: 0, patron: null });
  assert.deepEqual(r, [{ numero: 0, nom: null, libelle: "Vous" }]);
});

cas("SEULS LES SALARIÉS COCHÉS CE JOUR-LÀ, jamais le patron quand il en a", () => {
  const r = intervenantsDuJour({
    ...base,
    coches: [
      { chantierId: "c1", jour: JOUR, demi: "matin", rang: 1 },
      // Sans jour : chaque jour posé du chantier.
      { chantierId: "c1", jour: null, demi: "apres_midi", rang: 2 },
      // Un autre jour : pas aujourd'hui.
      { chantierId: "c1", jour: "2026-11-06", demi: "matin", rang: 3 },
    ],
  });
  assert.deepEqual(
    r.map((i) => i.numero),
    [1, 2]
  );
  assert.ok(!r.some((i) => i.numero === 0), "le patron est entré alors qu'il a des salariés");
});

cas("un salarié en congé ce jour-là ne tape pas d'heures", () => {
  const r = intervenantsDuJour({
    ...base,
    coches: [
      { chantierId: "c1", jour: JOUR, demi: "matin", rang: 1 },
      { chantierId: "c1", jour: JOUR, demi: "matin", rang: 2 },
    ],
    absences: [{ equipeId: "e2", rang: 2, premierJour: JOUR, dernierJour: JOUR, nature: "conge" }],
  });
  assert.deepEqual(
    r.map((i) => i.numero),
    [1]
  );
});

cas("sans nom écrit, l'écran dit « Salarié 3 », le papier ne dit rien ; sans numéro, pas de ligne", () => {
  const r = intervenantsDuJour({
    ...base,
    coches: [
      { chantierId: "c1", jour: JOUR, demi: "matin", rang: 3 },
      { chantierId: "c1", jour: JOUR, demi: "matin", rang: 4 },
    ],
  });
  assert.deepEqual(r, [{ numero: 5, nom: null, libelle: "Salarié 3" }]);
});

const PERMIS: IntervenantDuJour[] = [
  { numero: 1, nom: "Martin Julien", libelle: "Martin Julien" },
  { numero: 2, nom: "Roux Léa", libelle: "Roux Léa" },
];

cas("les heures reçues se relisent contre la liste du jour, et emportent le nom écrit", () => {
  const r = heuresRecues(
    [
      { numero: 1, minutes: 210 },
      { numero: 2, minutes: 0 },
    ],
    PERMIS
  );
  assert.deepEqual(r, {
    ok: true,
    lignes: [
      { numero: 1, nom: "Martin Julien", minutes: 210 },
      { numero: 2, nom: "Roux Léa", minutes: 0 },
    ],
  });
});

cas("un numéro qui n'est pas sur le chantier ce jour-là se refuse", () => {
  const r = heuresRecues([{ numero: 0, minutes: 60 }], PERMIS);
  assert.equal(r.ok, false);
});

cas("une durée hors des roulettes se refuse, une forme fausse aussi", () => {
  assert.equal(heuresRecues([{ numero: 1, minutes: 1500 }], PERMIS).ok, false);
  assert.equal(heuresRecues([{ numero: 1, minutes: -5 }], PERMIS).ok, false);
  assert.equal(heuresRecues([{ numero: 1, minutes: 30.5 }], PERMIS).ok, false);
  assert.equal(heuresRecues([{ numero: "1", minutes: 30 }], PERMIS).ok, false);
  assert.equal(heuresRecues("trois heures", PERMIS).ok, false);
  assert.equal(
    heuresRecues(
      [
        { numero: 1, minutes: 30 },
        { numero: 1, minutes: 60 },
      ],
      PERMIS
    ).ok,
    false,
    "un même intervenant deux fois"
  );
});

if (echecs > 0) {
  console.error(`\n${echecs} échec(s).`);
  process.exit(1);
}
console.log("\nSeuls ceux qui étaient là tapent leurs heures, et dans les roulettes.");
