// Le retour d'intervention — les règles, sans base.
//
// **Ce que cette suite protège.** Deux choses, et les deux se paient sur un
// chantier : un salarié bloqué par une exigence que le patron n'a jamais
// allumée, et un retour posé vide alors qu'il l'exigeait. Entre les deux, la
// liste du patron — qui doit retrouver ce qu'on a fait chez quelqu'un en 2024.

import assert from "node:assert/strict";
import {
  ceQuiManque,
  phraseDeCeQuiManque,
  peutPoserLeRetour,
  compteDesTaches,
  nomCherche,
  rangerLesRetours,
  anneesDesRetours,
  type RetourEnListe,
} from "../src/lib/retour-intervention";

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

const RIEN_EXIGE = { demande: false, photoExigee: false };
const PREUVE = { demande: true, photoExigee: false };
const PREUVE_ET_PHOTO = { demande: true, photoExigee: true };

function retour(p: Partial<RetourEnListe> & { clientNom: string; poseLe: string }): RetourEnListe {
  return {
    id: p.poseLe + p.clientNom,
    chantierNom: "Un chantier",
    posePar: "Julien",
    taches: [],
    photos: 0,
    aSignaler: null,
    ...p,
  };
}

console.log("=== Le retour d'intervention ===\n");

// ── Ce que le patron exige, et rien de plus ────────────────────────────
essai("le patron n'exige rien : le geste est libre", () => {
  assert.deepEqual(ceQuiManque({ taches: [], photos: 0 }, RIEN_EXIGE), []);
  assert.equal(peutPoserLeRetour({ taches: [], photos: 0 }, RIEN_EXIGE), true);
});

essai("preuve demandée, rien de coché : on le dit avant l'appui", () => {
  const manque = ceQuiManque(
    { taches: [{ libelle: "Taille", faite: false }], photos: 2 },
    PREUVE
  );
  assert.deepEqual(manque, ["cochez ce que vous avez fait"]);
});

essai("une seule case cochée suffit", () => {
  const pose = { taches: [{ libelle: "Taille", faite: true }, { libelle: "Tonte", faite: false }], photos: 0 };
  assert.equal(peutPoserLeRetour(pose, PREUVE), true);
});

essai("la photo n'est exigée que si le patron l'a allumée", () => {
  const pose = { taches: [{ libelle: "Taille", faite: true }], photos: 0 };
  assert.equal(peutPoserLeRetour(pose, PREUVE), true);
  assert.equal(peutPoserLeRetour(pose, PREUVE_ET_PHOTO), false);
});

essai("les deux manques se disent ensemble, pas l'un après l'autre", () => {
  const phrase = phraseDeCeQuiManque({ taches: [{ libelle: "T", faite: false }], photos: 0 }, PREUVE_ET_PHOTO);
  assert.equal(phrase, "cochez ce que vous avez fait et ajoutez une photo");
});

// **Le piège du zèle.** Exiger une photo alors que le patron n'a même pas
// demandé de preuve bloquerait un salarié pour un réglage qu'il n'a jamais vu.
essai("photo exigée mais preuve non demandée : rien n'est bloqué", () => {
  assert.deepEqual(ceQuiManque({ taches: [], photos: 0 }, { demande: false, photoExigee: true }), []);
});

essai("rien ne manque : la phrase est vide", () => {
  assert.equal(
    phraseDeCeQuiManque({ taches: [{ libelle: "T", faite: true }], photos: 1 }, PREUVE_ET_PHOTO),
    ""
  );
});

// ── Ce que le patron lit ───────────────────────────────────────────────
essai("« 2 sur 3 faites »", () => {
  assert.equal(
    compteDesTaches([
      { libelle: "a", faite: true },
      { libelle: "b", faite: true },
      { libelle: "c", faite: false },
    ]),
    "2 sur 3 faites"
  );
});

essai("tout fait se dit « tout fait », pas « 3 sur 3 »", () => {
  assert.equal(
    compteDesTaches([{ libelle: "a", faite: true }, { libelle: "b", faite: true }]),
    "tout fait"
  );
});

essai("aucune tâche : rien à compter, et surtout pas « 0 sur 0 »", () => {
  assert.equal(compteDesTaches([]), "");
});

// ── La recherche ───────────────────────────────────────────────────────
essai("la recherche plie les accents et la casse", () => {
  assert.equal(nomCherche("  Mme  CÔSTA "), "mme costa");
});

essai("« costa » trouve « Mme Costa »", () => {
  const liste = [
    retour({ clientNom: "Mme Costa", poseLe: "2026-08-28T17:05:00.000Z" }),
    retour({ clientNom: "M. Rialland", poseLe: "2026-09-02T16:40:00.000Z" }),
  ];
  const g = rangerLesRetours(liste, { client: "costa" });
  assert.equal(g.length, 1);
  assert.equal(g[0].client, "Mme Costa");
});

essai("un nom qui n'existe pas ne rend rien, sans casser", () => {
  const g = rangerLesRetours([retour({ clientNom: "Costa", poseLe: "2026-01-01T00:00:00.000Z" })], {
    client: "zzz",
  });
  assert.deepEqual(g, []);
});

// ── Le rangement par client ────────────────────────────────────────────
essai("les retours sont groupés par client", () => {
  const liste = [
    retour({ clientNom: "Mme Costa", poseLe: "2025-06-12T15:40:00.000Z" }),
    retour({ clientNom: "M. Rialland", poseLe: "2026-09-02T16:40:00.000Z" }),
    retour({ clientNom: "Mme Costa", poseLe: "2026-08-28T17:05:00.000Z" }),
  ];
  const g = rangerLesRetours(liste);
  assert.deepEqual(g.map((x) => x.client), ["M. Rialland", "Mme Costa"]);
  assert.equal(g[1].retours.length, 2);
});

// C'est le cœur de sa demande : deux passages chez le même homme se lisent
// côte à côte, même à quinze mois d'écart.
essai("chez un client, du plus récent au plus ancien", () => {
  const liste = [
    retour({ clientNom: "Mme Costa", poseLe: "2025-06-12T15:40:00.000Z" }),
    retour({ clientNom: "Mme Costa", poseLe: "2026-08-28T17:05:00.000Z" }),
  ];
  const g = rangerLesRetours(liste);
  assert.deepEqual(g[0].retours.map((r) => r.poseLe.slice(0, 4)), ["2026", "2025"]);
});

// Le retour du soir doit être en haut : sinon il faut le chercher, et c'est
// exactement ce que cette page évite.
essai("le client au retour le plus récent passe devant", () => {
  const liste = [
    retour({ clientNom: "Ancien", poseLe: "2024-10-07T16:15:00.000Z" }),
    retour({ clientNom: "Récent", poseLe: "2026-09-02T16:40:00.000Z" }),
  ];
  assert.deepEqual(rangerLesRetours(liste).map((g) => g.client), ["Récent", "Ancien"]);
});

// ── Les années — « il faut pouvoir les garder longtemps » ──────────────
essai("filtrer sur 2024 ne rend que 2024", () => {
  const liste = [
    retour({ clientNom: "A", poseLe: "2024-10-07T16:15:00.000Z" }),
    retour({ clientNom: "B", poseLe: "2026-09-02T16:40:00.000Z" }),
  ];
  const g = rangerLesRetours(liste, { annee: "2024" });
  assert.deepEqual(g.map((x) => x.client), ["A"]);
});

// Aucune fenêtre glissante : un retour de 2024 se retrouve en 2026.
essai("sans filtre, les vieilles années restent là", () => {
  const liste = [
    retour({ clientNom: "A", poseLe: "2024-10-07T16:15:00.000Z" }),
    retour({ clientNom: "B", poseLe: "2026-09-02T16:40:00.000Z" }),
  ];
  assert.equal(rangerLesRetours(liste).length, 2);
});

essai("les années proposées sortent des retours, pas du calendrier", () => {
  const liste = [
    retour({ clientNom: "A", poseLe: "2024-10-07T16:15:00.000Z" }),
    retour({ clientNom: "B", poseLe: "2026-09-02T16:40:00.000Z" }),
    retour({ clientNom: "C", poseLe: "2026-01-02T09:00:00.000Z" }),
  ];
  assert.deepEqual(anneesDesRetours(liste), ["2026", "2024"]);
});

essai("aucun retour : aucune année à proposer", () => {
  assert.deepEqual(anneesDesRetours([]), []);
});

essai("le nom et l'année se cumulent", () => {
  const liste = [
    retour({ clientNom: "Mme Costa", poseLe: "2025-06-12T15:40:00.000Z" }),
    retour({ clientNom: "Mme Costa", poseLe: "2026-08-28T17:05:00.000Z" }),
    retour({ clientNom: "M. Rialland", poseLe: "2026-09-02T16:40:00.000Z" }),
  ];
  const g = rangerLesRetours(liste, { client: "costa", annee: "2026" });
  assert.equal(g.length, 1);
  assert.equal(g[0].retours.length, 1);
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} Le retour d'intervention — ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
