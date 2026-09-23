import assert from "node:assert/strict";
import { rapportsAMontrer } from "../src/lib/passage-entretien";

// **Retrouver un rapport envoyé : par le nom du client, ou par le jour, le mois,
// l'année.**
//
// Sa demande du 22 septembre 2026, capture de « Rapports envoyés » à l'appui :
// *« faut pouvoir filtrer par nom de client et que ça nous sorte toutes les
// fiches liées au client, et un filtre par jour mois année »*. Le même contrat
// que les fiches de sécurité et les retours : un nom tapé passe par-dessus la
// date, et sort TOUS les rapports du client.
//
// Le jour d'un rapport est celui du PASSAGE (`jour`, déjà une date de
// calendrier), celui que la ligne écrit : aucun fuseau à traverser.
const rapport = (clientNom: string | null, jour: string) => ({ clientNom, jour });
const RAPPORTS = [
  rapport("M. Bernard", "2026-09-22"),
  rapport("Monsieur Martin", "2026-09-03"),
  rapport("M. Bernard", "2026-08-25"),
  rapport("Madame Lucie", "2026-08-24"),
  rapport("Mme Moréau", "2025-11-14"),
  rapport(null, "2026-09-10"),
];
const lus = (l: { clientNom: string | null; jour: string }[]) => l.map((r) => `${r.clientNom ?? "Sans client"} ${r.jour}`);

let echecs = 0;
function cas(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${e instanceof Error ? e.message : e}`);
  }
}

cas("sans saisie, le mois choisi et lui seul", () => {
  assert.deepEqual(lus(rapportsAMontrer(RAPPORTS, { periode: "2026-09", saisie: "" })), [
    "M. Bernard 2026-09-22",
    "Monsieur Martin 2026-09-03",
    "Sans client 2026-09-10",
  ]);
  assert.deepEqual(rapportsAMontrer(RAPPORTS, { periode: "2026-01", saisie: "  " }), []);
});

cas("un jour choisi : ce jour-là, et lui seul", () => {
  assert.deepEqual(lus(rapportsAMontrer(RAPPORTS, { periode: "2026-08-24", saisie: "" })), ["Madame Lucie 2026-08-24"]);
  assert.deepEqual(rapportsAMontrer(RAPPORTS, { periode: "2026-08-23", saisie: "" }), []);
});

cas("un nom tapé rend TOUS les rapports du client, quelle que soit la date choisie", () => {
  assert.deepEqual(lus(rapportsAMontrer(RAPPORTS, { periode: "2026-09-03", saisie: "bernard" })), [
    "M. Bernard 2026-09-22",
    "M. Bernard 2026-08-25",
  ]);
});

cas("sans accent ni casse, comme la recherche des clients", () => {
  assert.deepEqual(lus(rapportsAMontrer(RAPPORTS, { periode: "2026-09", saisie: "MOREAU" })), ["Mme Moréau 2025-11-14"]);
});

cas("un rapport sans client ne sort jamais sur un nom", () => {
  assert.deepEqual(rapportsAMontrer(RAPPORTS, { periode: "2026-09", saisie: "sans client" }), []);
});

cas("un nom inconnu ne rend rien", () => {
  assert.deepEqual(rapportsAMontrer(RAPPORTS, { periode: "2026-09", saisie: "dupont" }), []);
});

if (echecs) {
  console.error(`\n${echecs} cas rouge(s).`);
  process.exit(1);
}
console.log("\nRecherche des rapports envoyés : vert.");
