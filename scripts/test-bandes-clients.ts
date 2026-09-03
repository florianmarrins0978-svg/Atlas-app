import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  bandeDuClient,
  grouperEnBandes,
  BANDE_PLUS_ANCIEN,
  BANDE_SANS_CHANTIER,
} from "../src/lib/bandes-clients";

// **Les bandes de la liste des clients — sa remarque du 3 septembre 2026.**
//
// *« Une liste longue se parcourt à l'aveugle : il n'y a ni ordre annoncé, ni
// repère pour sauter quelque part. »*
//
// La liste ÉTAIT déjà rangée du chantier le plus récent au plus ancien
// (`listerFichesClients`) : ces bandes ne changent pas l'ordre, elles le
// nomment. Ce qui se tient ici :
//
//   1. la frontière est un MOIS DE CALENDRIER, pas trente jours — le 1er
//      septembre et le 31 août sont dans deux bandes, à un jour d'écart ;
//   2. trois mois nommés, le reste groupé : neuf bandes pour vingt et un
//      clients feraient du repère le bruit qu'il devait réduire ;
//   3. le regroupement ne TRIE rien — deux règles d'ordre pour une même liste,
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

// Le jour de la maquette qu'il a retenue, pour que les cas se lisent comme
// l'écran qu'il a vu.
const AUJOURD_HUI = "2026-09-03";

console.log("=== Les bandes de la liste des clients ===\n");

cas("le mois en cours porte son nom", () => {
  assert.equal(bandeDuClient("2026-09-01", AUJOURD_HUI), "septembre");
});

cas("les deux mois précédents portent le leur", () => {
  assert.equal(bandeDuClient("2026-08-28", AUJOURD_HUI), "août");
  assert.equal(bandeDuClient("2026-07-02", AUJOURD_HUI), "juillet");
});

cas("au-delà de trois mois, tout se groupe", () => {
  assert.equal(bandeDuClient("2026-06-24", AUJOURD_HUI), BANDE_PLUS_ANCIEN);
  assert.equal(bandeDuClient("2025-11-20", AUJOURD_HUI), BANDE_PLUS_ANCIEN);
});

cas("un client sans chantier n'a pas de date, et il a sa bande", () => {
  assert.equal(bandeDuClient(null, AUJOURD_HUI), BANDE_SANS_CHANTIER);
});

cas("la frontière est un MOIS, pas trente jours", () => {
  // À un jour l'un de l'autre, et dans deux bandes : c'est voulu. Compter en
  // jours ferait sauter la frontière selon la longueur de février.
  assert.equal(bandeDuClient("2026-09-01", AUJOURD_HUI), "septembre");
  assert.equal(bandeDuClient("2026-08-31", AUJOURD_HUI), "août");
});

cas("le passage d'une année se compte en mois, pas en chiffres d'année", () => {
  // Au 15 janvier, novembre est à deux mois : il porte son nom, même s'il
  // appartient à l'année d'avant. Soustraire les mois sans les années aurait
  // rendu « -10 ».
  assert.equal(bandeDuClient("2025-11-20", "2026-01-15"), "novembre");
  assert.equal(bandeDuClient("2025-10-20", "2026-01-15"), BANDE_PLUS_ANCIEN);
});

cas("une date à venir ne fabrique pas une bande future", () => {
  // Un chantier posé pour le mois prochain porte cette date-là. Il ne doit pas
  // ouvrir une bande « octobre » au-dessus de « septembre », qui ferait remonter
  // un client au-dessus de l'ordre voulu par le dépôt.
  assert.equal(bandeDuClient("2026-10-12", AUJOURD_HUI), BANDE_PLUS_ANCIEN);
});

cas("une date illisible ne pose pas « undefined » au milieu de sa liste", () => {
  assert.equal(bandeDuClient("pas-une-date", AUJOURD_HUI), BANDE_PLUS_ANCIEN);
  assert.equal(bandeDuClient("", AUJOURD_HUI), BANDE_SANS_CHANTIER);
});

cas("les groupes suivent l'ordre reçu, et ne le retrient pas", () => {
  const liste = [
    { nom: "Chauvin", dernierJour: "2026-09-01" },
    { nom: "Martins", dernierJour: "2026-08-28" },
    { nom: "Moreau", dernierJour: "2026-08-24" },
    { nom: "Renard", dernierJour: "2026-07-02" },
    { nom: "Perrot", dernierJour: "2025-11-20" },
    { nom: "Delaunay", dernierJour: null },
  ];
  const groupes = grouperEnBandes(liste, AUJOURD_HUI);
  assert.deepEqual(
    groupes.map((g) => g.bande),
    ["septembre", "août", "juillet", BANDE_PLUS_ANCIEN, BANDE_SANS_CHANTIER]
  );
  assert.deepEqual(
    groupes.flatMap((g) => g.clients.map((c) => c.nom)),
    liste.map((c) => c.nom),
    "le regroupement a changé l'ordre : il y a désormais deux règles d'ordre pour une liste"
  );
  assert.equal(groupes[1].clients.length, 2, "les deux clients d'août ne sont pas ensemble");
});

cas("une liste vide ne rend aucune bande — pas une bande vide", () => {
  assert.deepEqual(grouperEnBandes([], AUJOURD_HUI), []);
});

cas("une liste qui aurait perdu son ordre le MONTRE, au lieu de le masquer", () => {
  // Regrouper par clé plutôt que par voisinage réunirait deux août séparés par
  // un juillet : le désordre disparaîtrait de l'écran sans disparaître de la
  // liste. Deux bandes du même nom sont laides — et c'est le but.
  const desordre = [
    { dernierJour: "2026-08-28" },
    { dernierJour: "2026-07-02" },
    { dernierJour: "2026-08-01" },
  ];
  assert.deepEqual(
    grouperEnBandes(desordre, AUJOURD_HUI).map((g) => g.bande),
    ["août", "juillet", "août"]
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// **L'écran n'a pas le droit de refaire la règle** — même garde-fou que la
// recherche : une seconde table de mois, et « août » finirait par s'écrire de
// deux façons dont une seule serait corrigée.
cas("ListeClients.tsx emploie la règle partagée, et ne nomme pas les mois lui-même", () => {
  const ecran = readFileSync(
    path.join(__dirname, "..", "src", "app", "clients", "ListeClients.tsx"),
    "utf8"
  );
  assert.match(ecran, /grouperEnBandes/, "l'écran range les bandes à sa façon");
  assert.doesNotMatch(
    ecran,
    /janvier|février|décembre/,
    "l'écran porte sa propre table de mois : elle divergera de celle de `jour.ts`"
  );
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} Les bandes de la liste des clients — ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
