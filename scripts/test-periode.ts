// LA PÉRIODE — une année, un mois ou un jour, et les trois mots qui la règlent.
//
// **Ce que cette suite protège.** Sa demande du 23 septembre 2026 : *« l'idée
// c'est de pouvoir filtrer aussi par mois ou par année ou par jour mois
// année »*. Trois écrans lisent la même période — les fiches de sécurité, les
// retours d'intervention, les rapports envoyés — et une période mal découpée
// ne se voit pas : la liste rend simplement moins de lignes qu'elle ne devrait.
//
// Sans base, sans navigateur.

import assert from "node:assert/strict";
import {
  avecLaPortee,
  dansLaPeriode,
  jourDeLaRoue,
  periodeValide,
  porteeDeLaPeriode,
  titreDeLaPeriode,
} from "../src/lib/periode";

let echecs = 0;
function essai(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}`);
    console.log(`    ${(e as Error).message}`);
  }
}

console.log("=== La période ===\n");

// ── Ce qu'une adresse a le droit de porter ─────────────────────────────
essai("une année, un mois et un jour sont des périodes", () => {
  assert.equal(periodeValide("2026"), "2026");
  assert.equal(periodeValide("2026-09"), "2026-09");
  assert.equal(periodeValide("2026-09-22"), "2026-09-22");
});

// Une adresse vient du dehors : elle se refuse, elle ne se répare pas.
essai("ce qui n'est pas une période est refusé", () => {
  for (const faux of ["", "26", "2026-", "2026-9", "2026-09-2", "hier", "2026-09-22T10:00"]) {
    assert.equal(periodeValide(faux), null, `« ${faux} » est passé`);
  }
  assert.equal(periodeValide(undefined), null);
});

// ── Ce que chaque période embrasse ─────────────────────────────────────
essai("la portée se lit sur la période", () => {
  assert.equal(porteeDeLaPeriode("2026"), "annee");
  assert.equal(porteeDeLaPeriode("2026-09"), "mois");
  assert.equal(porteeDeLaPeriode("2026-09-22"), "jour");
});

essai("une année garde tout ce qui s'y est passé", () => {
  const janvier = new Date("2026-01-02T09:00:00.000Z");
  const decembre = new Date("2026-12-30T09:00:00.000Z");
  const anneeDAvant = new Date("2025-11-04T09:00:00.000Z");
  assert.equal(dansLaPeriode(janvier, "2026"), true);
  assert.equal(dansLaPeriode(decembre, "2026"), true);
  assert.equal(dansLaPeriode(anneeDAvant, "2026"), false);
});

essai("un mois ne prend pas le mois voisin, un jour ne prend pas la veille", () => {
  const le22 = new Date("2026-09-22T09:00:00.000Z");
  assert.equal(dansLaPeriode(le22, "2026-09"), true);
  assert.equal(dansLaPeriode(le22, "2026-08"), false);
  assert.equal(dansLaPeriode(le22, "2026-09-22"), true);
  assert.equal(dansLaPeriode(le22, "2026-09-21"), false);
});

// **Le fuseau du patron, pas celui de la machine.** 22 h 30 à Greenwich, c'est
// déjà le lendemain à Paris — et la carte, elle, écrit le lendemain.
essai("le jour se lit à l'heure de Paris", () => {
  const tard = new Date("2026-09-22T22:30:00.000Z");
  assert.equal(dansLaPeriode(tard, "2026-09-23"), true);
  assert.equal(dansLaPeriode(tard, "2026-09-22"), false);
});

// ── Les trois mots du titre — sa proposition B du 23 septembre ─────────
essai("élargir garde le point du calendrier", () => {
  assert.equal(avecLaPortee("2026-09-22", "jour"), "2026-09-22");
  assert.equal(avecLaPortee("2026-09-22", "mois"), "2026-09");
  assert.equal(avecLaPortee("2026-09-22", "annee"), "2026");
});

// C'est ce qui permet de REDESCENDRE : le jour n'est jamais perdu, il est
// seulement caché sous la portée choisie.
essai("on remonte et l'on redescend sans rouvrir la roue", () => {
  const jour = jourDeLaRoue("2026");
  assert.equal(avecLaPortee(jour, "mois").length, 7);
  assert.equal(avecLaPortee(jour, "jour").length, 10);
});

essai("le titre écrit ce que la liste embrasse", () => {
  assert.equal(titreDeLaPeriode("2026"), "2026");
  assert.equal(titreDeLaPeriode("2026-09"), "Septembre 2026");
  assert.equal(titreDeLaPeriode("2026-09-22"), "22 septembre 2026");
});

// ── Le jour sur lequel la roue s'ouvre ─────────────────────────────────
essai("la roue s'ouvre sur aujourd'hui quand il est dans la période", () => {
  const maintenant = new Date("2026-09-22T09:00:00.000Z");
  assert.equal(jourDeLaRoue("2026", maintenant), "2026-09-22");
  assert.equal(jourDeLaRoue("2026-09", maintenant), "2026-09-22");
  assert.equal(jourDeLaRoue("2026-09-14", maintenant), "2026-09-14");
});

// **Une année n'a pas de mois** : la roue d'un téléphone refuse « 2026-01 »
// comme elle refuse « 2026 ». Sans cette ligne, le champ se vide et le titre
// perd sa date.
essai("une autre année s'ouvre sur son 1er janvier", () => {
  const maintenant = new Date("2026-09-22T09:00:00.000Z");
  assert.equal(jourDeLaRoue("2024", maintenant), "2024-01-01");
  assert.equal(jourDeLaRoue("2024-03", maintenant), "2024-03-01");
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} La période — ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
