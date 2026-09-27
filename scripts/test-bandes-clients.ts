import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  grouperEnBandes,
  jourDeRangement,
  lettreDuClient,
  rangerParNom,
  BANDE_HORS_ALPHABET,
} from "../src/lib/bandes-clients";

// **Les bandes de la liste des clients — sa remarque du 3 septembre 2026.**
//
// *« Une liste longue se parcourt à l'aveugle : il n'y a ni ordre annoncé, ni
// repère pour sauter quelque part. »*
//
// Depuis le 27 septembre 2026, la liste se range de A à Z et les bandes sont
// des LETTRES (elles étaient des mois). Ce qui se tient ici :
//
//   1. la clé est le nom SANS sa civilité, sans accents ni casse ;
//   2. à nom égal, le plus récent devant ;
//   3. le regroupement ne TRIE rien : deux règles d'ordre pour une même liste,
//      c'est l'écran qui aurait tort sans que rien ne le dise.

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

const AUJOURD_HUI = "2026-09-03";

console.log("=== Les bandes de la liste des clients ===\n");

// ── De A à Z — sa demande du 27 septembre 2026, planche A retenue ──────────
//
// *« Filtre client trier par ordre alphabétique »*, puis *« la A, mais il faut
// garder le filtre qui existe aujourd'hui »* (`appli/clients-a-a-z.html`).

cas("la liste se range par nom, SANS sa civilité", () => {
  // Trier sur le nom brut rangerait toutes les « Mme » ensemble, puis tous les
  // « Mr. » : l'ordre alphabétique ne servirait à rien.
  const liste = [
    { nom: "Mme Chauvin", dernierJour: "2026-09-01" },
    { nom: "Mr. Bernard", dernierJour: "2026-08-19" },
    { nom: "Mme Aubry", dernierJour: "2026-07-29" },
    { nom: "Copropriété Les Cèdres", dernierJour: "2026-04-08" },
    { nom: "Mme Costa", dernierJour: "2026-08-06" },
    { nom: "Mr. Delaunay", dernierJour: null },
  ];
  assert.deepEqual(
    rangerParNom(liste).map((c) => c.nom),
    ["Mme Aubry", "Mr. Bernard", "Mme Chauvin", "Copropriété Les Cèdres", "Mme Costa", "Mr. Delaunay"]
  );
});

cas("les accents et la casse ne déplacent personne", () => {
  const liste = [
    { nom: "Mme Léger", dernierJour: null },
    { nom: "élodie Faure", dernierJour: null },
    { nom: "Mr. Lambert", dernierJour: null },
  ];
  assert.deepEqual(
    rangerParNom(liste).map((c) => c.nom),
    ["élodie Faure", "Mr. Lambert", "Mme Léger"]
  );
});

cas("à nom égal, le plus récent passe devant", () => {
  const liste = [
    { nom: "Mme Martins", dernierJour: "2026-06-24" },
    { nom: "Mr. Martins", dernierJour: null },
    { nom: "Mr. Martins", dernierJour: "2026-08-28" },
  ];
  assert.deepEqual(
    rangerParNom(liste).map((c) => c.dernierJour),
    ["2026-08-28", "2026-06-24", null]
  );
});

cas("ranger ne touche pas à la liste reçue", () => {
  const liste = [{ nom: "Mr. Bernard", dernierJour: null }, { nom: "Mme Aubry", dernierJour: null }];
  rangerParNom(liste);
  assert.equal(liste[0].nom, "Mr. Bernard");
});

cas("la bande d'un client est la première lettre de son nom sans civilité", () => {
  assert.equal(lettreDuClient("Mme Aubry"), "A");
  assert.equal(lettreDuClient("Mr. bernard"), "B");
  assert.equal(lettreDuClient("Élodie Faure"), "E");
  assert.equal(lettreDuClient("Copropriété Les Cèdres"), "C");
});

cas("un nom qui ne commence pas par une lettre a sa bande, en fin de liste", () => {
  // Un « 3F Habitat » ou un nom vide ne pose pas « undefined » au milieu de
  // sa liste, et ne se glisse pas entre deux lettres.
  assert.equal(lettreDuClient("3F Habitat"), BANDE_HORS_ALPHABET);
  assert.equal(lettreDuClient(""), BANDE_HORS_ALPHABET);
  assert.deepEqual(
    rangerParNom([
      { nom: "3F Habitat", dernierJour: null },
      { nom: "Mme Aubry", dernierJour: null },
    ]).map((c) => c.nom),
    ["Mme Aubry", "3F Habitat"]
  );
});

cas("les groupes suivent l'ordre reçu, une lettre par bande", () => {
  const liste = rangerParNom([
    { nom: "Mme Chauvin", dernierJour: "2026-09-01" },
    { nom: "Mme Aubry", dernierJour: "2026-07-29" },
    { nom: "Copropriété Les Cèdres", dernierJour: null },
    { nom: "Mr. Bernard", dernierJour: null },
  ]);
  const groupes = grouperEnBandes(liste);
  assert.deepEqual(groupes.map((g) => g.bande), ["A", "B", "C"]);
  assert.deepEqual(
    groupes.flatMap((g) => g.clients.map((c) => c.nom)),
    liste.map((c) => c.nom),
    "le regroupement a changé l'ordre : il y a désormais deux règles d'ordre pour une liste"
  );
  assert.equal(groupes[2].clients.length, 2, "les deux clients en C ne sont pas ensemble");
});

cas("une liste vide ne rend aucune bande, pas une bande vide", () => {
  assert.deepEqual(grouperEnBandes([]), []);
});

cas("une liste qui aurait perdu son ordre le MONTRE, au lieu de le masquer", () => {
  // Regrouper par clé plutôt que par voisinage réunirait deux A séparés par un
  // B : le désordre disparaîtrait de l'écran sans disparaître de la liste.
  assert.deepEqual(
    grouperEnBandes([{ nom: "Aubry" }, { nom: "Bernard" }, { nom: "Arnaud" }]).map((g) => g.bande),
    ["A", "B", "A"]
  );
});

// Sa capture du 26 septembre 2026 : un chantier planifié en novembre passait
// pour le plus récent. Le jour de rangement départage toujours deux homonymes.
cas("un jour à venir ne range pas un client : c'est le dernier jour passé qui compte", () => {
  assert.equal(jourDeRangement(["2026-11-05", "2026-08-20", null, "2026-09-02"], AUJOURD_HUI), "2026-09-02");
  assert.equal(jourDeRangement(["2026-09-03"], AUJOURD_HUI), "2026-09-03");
  assert.equal(jourDeRangement(["2026-10-01", undefined], AUJOURD_HUI), null);
});

// ─────────────────────────────────────────────────────────────────────────────
// **L'écran n'a pas le droit de refaire la règle** : un second tri à l'écran,
// et l'ordre finirait par s'écrire de deux façons dont une seule serait
// corrigée.
cas("ListeClients.tsx emploie la règle partagée, et ne trie pas lui-même", () => {
  const ecran = readFileSync(
    path.join(__dirname, "..", "src", "app", "clients", "ListeClients.tsx"),
    "utf8"
  );
  assert.match(ecran, /grouperEnBandes/, "l'écran range les bandes à sa façon");
  assert.doesNotMatch(ecran, /\.sort\(|localeCompare/, "l'écran porte son propre tri : il divergera de `rangerParNom`");
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} Les bandes de la liste des clients — ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
