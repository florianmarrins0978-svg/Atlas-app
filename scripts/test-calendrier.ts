import assert from "node:assert/strict";
import {
  basculerJour,
  etatDuJour,
  grilleDuMois,
  libelleMois,
  moisDansFenetre,
  moisDuJour,
  moisPrecedent,
  moisSuivant,
} from "../src/lib/calendrier";

// **Le calendrier, éprouvé sans navigateur.**
//
// Le patron, le 8 août 2026 : *« passe au calendrier pour le choix des dates à
// proposer au client, mais également qu'il ait accès au calendrier pour pouvoir
// proposer une date, avec un système pour qu'il n'ait pas accès aux dates déjà
// prises par un autre client. »*
//
// Ce que cette suite tient, et qu'un écran ne peut pas tenir seul :
//
//   1. **la grille est juste**, y compris aux endroits où les calendriers se
//      trompent : février bissextile, un mois qui commence un dimanche, le
//      passage d'une année à l'autre ;
//   2. **un jour pris ne se choisit pas** — c'est la demande, mot pour mot ;
//   3. **un jour hors fenêtre ne dit PAS qu'il est pris.** La page du client ne
//      doit rien laisser filtrer du planning au-delà de ce qu'on lui montre
//      (`docs/AGENT.md` §2.2 bis) ;
//   4. **jamais plus de deux dates**, et le refus ne se fait pas en silence.

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

console.log("=== La grille du mois, y compris là où l'on se trompe ===\n");

cas("six semaines de sept jours, toujours", () => {
  // Une hauteur fixe : sans elle, l'écran saute d'une ligne en changeant de
  // mois, et le doigt tombe à côté de la case visée.
  for (const [a, m] of [[2026, 2], [2026, 8], [2027, 1], [2024, 2]] as const) {
    const g = grilleDuMois(a, m);
    assert.equal(g.length, 6, `${a}-${m} : ${g.length} semaines`);
    for (const s of g) assert.equal(s.length, 7);
  }
});

cas("la semaine commence un LUNDI", () => {
  // En France. Un calendrier qui commence le dimanche décale toute la lecture,
  // et se remarque au premier coup d'œil.
  const [premiere] = grilleDuMois(2026, 8);
  const d = new Date(premiere[0].jour + "T00:00:00Z");
  assert.equal(d.getUTCDay(), 1, `la grille commence un ${premiere[0].jour}, qui n'est pas un lundi`);
});

cas("le 1er août 2026 est un samedi, et il tombe dans la bonne case", () => {
  const g = grilleDuMois(2026, 8);
  const premiereSemaine = g[0];
  assert.equal(premiereSemaine[5].jour, "2026-08-01", `samedi porte ${premiereSemaine[5].jour}`);
  assert.equal(premiereSemaine[5].duMois, true);
  // Les cases d'avant appartiennent à juillet, et se voient comme telles.
  assert.equal(premiereSemaine[0].duMois, false);
  assert.equal(premiereSemaine[0].jour, "2026-07-27");
});

cas("février 2024 a bien 29 jours, février 2026 en a 28", () => {
  const joursDe = (a: number, m: number) =>
    grilleDuMois(a, m).flat().filter((c) => c.duMois).map((c) => c.jour);
  assert.equal(joursDe(2024, 2).length, 29, "2024 est bissextile");
  assert.equal(joursDe(2026, 2).length, 28);
  assert.equal(joursDe(2024, 2).at(-1), "2024-02-29");
});

cas("aucun jour ne manque et aucun ne se répète", () => {
  for (const [a, m] of [[2026, 8], [2026, 12], [2027, 1]] as const) {
    const tous = grilleDuMois(a, m).flat().map((c) => c.jour);
    assert.equal(new Set(tous).size, tous.length, `${a}-${m} : un jour apparaît deux fois`);
    const duMois = grilleDuMois(a, m).flat().filter((c) => c.duMois).map((c) => c.jour);
    const attendu = new Date(Date.UTC(a, m, 0)).getUTCDate();
    assert.equal(duMois.length, attendu, `${a}-${m} : ${duMois.length} jours au lieu de ${attendu}`);
  }
});

console.log("\n=== Naviguer d'un mois à l'autre, et passer l'année ===");

cas("décembre mène à janvier de l'année suivante", () => {
  assert.deepEqual(moisSuivant({ annee: 2026, mois: 12 }), { annee: 2027, mois: 1 });
  assert.deepEqual(moisPrecedent({ annee: 2027, mois: 1 }), { annee: 2026, mois: 12 });
});

cas("le libellé porte TOUJOURS l'année", () => {
  // On navigue à dix-huit mois : « mars » seul ne dit pas lequel.
  assert.match(libelleMois({ annee: 2027, mois: 3 }), /mars.*2027/);
  assert.match(libelleMois({ annee: 2026, mois: 8 }), /août.*2026/);
});

cas("la navigation s'arrête aux bornes de la fenêtre", () => {
  const debut = "2026-08-09";
  const fin = "2028-02-10";
  assert.equal(moisDansFenetre({ annee: 2026, mois: 8 }, debut, fin), true, "le mois du début est dedans");
  assert.equal(moisDansFenetre({ annee: 2028, mois: 2 }, debut, fin), true, "le mois de la fin est dedans");
  assert.equal(moisDansFenetre({ annee: 2026, mois: 7 }, debut, fin), false);
  assert.equal(moisDansFenetre({ annee: 2028, mois: 3 }, debut, fin), false);
});

cas("le mois d'un jour se lit sans décalage", () => {
  // L'index 0 de JavaScript a déjà produit des décalages d'un mois ici.
  assert.deepEqual(moisDuJour("2026-01-31"), { annee: 2026, mois: 1 });
  assert.deepEqual(moisDuJour("2026-12-01"), { annee: 2026, mois: 12 });
});

console.log("\n=== Un jour pris ne se choisit pas — sa demande, mot pour mot ===");

const FENETRE = { debut: "2026-08-10", fin: "2026-09-10" };

cas("un jour occupé n'est pas choisissable", () => {
  const etat = etatDuJour("2026-08-12", { ...FENETRE, occupes: ["2026-08-12"], retenus: [] });
  assert.equal(etat, "occupe");
});

cas("un jour libre l'est", () => {
  assert.equal(etatDuJour("2026-08-13", { ...FENETRE, occupes: ["2026-08-12"], retenus: [] }), "choisissable");
});

cas("un jour hors fenêtre ne DIT PAS qu'il est pris", () => {
  // **Le contrôle qui protège le planning du patron.** Dire au client qu'un jour
  // de l'an prochain est « déjà pris » lui apprendrait ce qu'il n'a pas à
  // savoir : la page ne reçoit que des dates, jamais un état du planning
  // au-delà de ce qu'on lui montre (`docs/AGENT.md` §2.2 bis).
  const etat = etatDuJour("2026-11-03", { ...FENETRE, occupes: ["2026-11-03"], retenus: [] });
  assert.equal(etat, "hors_fenetre", "un jour hors fenêtre a révélé qu'il était occupé");
});

cas("un jour déjà retenu se dit « retenu », pas « occupé »", () => {
  // Sinon il s'afficherait barré, et le patron croirait ne plus pouvoir le
  // décocher.
  const etat = etatDuJour("2026-08-12", { ...FENETRE, occupes: ["2026-08-12"], retenus: ["2026-08-12"] });
  assert.equal(etat, "retenu");
});

cas("les bornes de la fenêtre sont DANS la fenêtre", () => {
  assert.equal(etatDuJour(FENETRE.debut, { ...FENETRE, occupes: [], retenus: [] }), "choisissable");
  assert.equal(etatDuJour(FENETRE.fin, { ...FENETRE, occupes: [], retenus: [] }), "choisissable");
  assert.equal(etatDuJour("2026-08-09", { ...FENETRE, occupes: [], retenus: [] }), "hors_fenetre");
  assert.equal(etatDuJour("2026-09-11", { ...FENETRE, occupes: [], retenus: [] }), "hors_fenetre");
});

console.log("\n=== Une ou deux dates, jamais trois ===");

cas("un premier appui retient, un second sur le même relâche", () => {
  assert.deepEqual(basculerJour([], "2026-08-12", 2), ["2026-08-12"]);
  assert.deepEqual(basculerJour(["2026-08-12"], "2026-08-12", 2), []);
});

cas("deux dates tiennent ensemble", () => {
  assert.deepEqual(basculerJour(["2026-08-12"], "2026-08-14", 2), ["2026-08-12", "2026-08-14"]);
});

cas("la troisième chasse la PLUS ANCIENNE, elle n'est pas refusée en silence", () => {
  // Un bouton qui ne répond pas se lit comme une panne : le patron appuierait
  // trois fois avant de comprendre.
  assert.deepEqual(
    basculerJour(["2026-08-12", "2026-08-14"], "2026-08-17", 2),
    ["2026-08-14", "2026-08-17"]
  );
});

cas("chez le client, une seule date à la fois", () => {
  // Il choisit SA date : la seconde remplace la première.
  assert.deepEqual(basculerJour(["2026-08-12"], "2026-08-14", 1), ["2026-08-14"]);
});

cas("un maximum absurde ne fait rien retenir", () => {
  assert.deepEqual(basculerJour([], "2026-08-12", 0), []);
});

console.log(`\n${echecs === 0 ? "✅ Toutes les vérifications passent." : `❌ ${echecs} échec(s).`}`);
process.exit(echecs === 0 ? 0 : 1);
