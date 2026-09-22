import assert from "node:assert/strict";
import { fichesAMontrer } from "../src/lib/fiche-securite";

// **Chercher une fiche de sécurité par le nom du client.**
//
// Sa demande du 22 septembre 2026, capture de l'écran à l'appui (Pagnol,
// Julien, septembre 2026) : *« faut pouvoir faire une recherche par nom aussi
// et il te sort toutes les fiches de ce client »*. TOUTES : le mois choisi en
// tête ne borne plus rien dès qu'un nom est tapé — une fiche de juin se
// cherche en septembre.

const fiche = (client: string, chantierNom: string, iso: string) => ({ client, chantierNom, signeeLe: new Date(iso) });
const FICHES = [
  fiche("Pagnol", "Mr. Pagnol", "2026-09-22T09:00:00Z"),
  fiche("Julien", "Mr. Julien", "2026-09-22T08:00:00Z"),
  fiche("Pagnol", "Mr. Pagnol, la haie", "2026-06-03T09:00:00Z"),
  fiche("Moréau", "Mme Moréau", "2025-11-14T09:00:00Z"),
];
const noms = (l: { chantierNom: string }[]) => l.map((f) => f.chantierNom);

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
  assert.deepEqual(noms(fichesAMontrer(FICHES, { mois: "2026-09", saisie: "" })), ["Mr. Pagnol", "Mr. Julien"]);
  assert.deepEqual(noms(fichesAMontrer(FICHES, { mois: "2026-06", saisie: "  " })), ["Mr. Pagnol, la haie"]);
  assert.deepEqual(fichesAMontrer(FICHES, { mois: "2026-01", saisie: "" }), []);
});

cas("un nom tapé rend TOUTES les fiches du client, tous mois confondus", () => {
  assert.deepEqual(noms(fichesAMontrer(FICHES, { mois: "2026-09", saisie: "pagnol" })), ["Mr. Pagnol", "Mr. Pagnol, la haie"]);
});

cas("sans accent ni casse, comme la recherche des clients", () => {
  assert.deepEqual(noms(fichesAMontrer(FICHES, { mois: "2026-09", saisie: "MOREAU" })), ["Mme Moréau"]);
});

cas("le nom du chantier se cherche aussi", () => {
  assert.deepEqual(noms(fichesAMontrer(FICHES, { mois: "2026-09", saisie: "haie" })), ["Mr. Pagnol, la haie"]);
});

cas("un nom inconnu ne rend rien", () => {
  assert.deepEqual(fichesAMontrer(FICHES, { mois: "2026-09", saisie: "dupont" }), []);
});

if (echecs) {
  console.error(`\n${echecs} cas rouge(s).`);
  process.exit(1);
}
console.log("\nRecherche des fiches de sécurité : vert.");
