import assert from "node:assert/strict";
import {
  CLES_TRI_CLIENTS,
  aucunePieceDuMois,
  clientsDuMois,
  moisDuJour,
  titreDuTri,
} from "../src/lib/tri-clients";

// **LE FILTRE DE SES LISTES DE CLIENTS** — sa demande du 22 octobre 2026
// (`appli/facture-mairie-chorus.html`) : *« quand ils vont avoir dix années de
// dossiers et qu'ils ont envie de retrouver un devis fait en 2017 »*. Le
// bouton Filtre de Terminés, puis le calendrier qui s'ouvre au toucher d'une
// date. Ce contrôle tient la règle pure : quels clients, quelle pièce, quel
// titre.

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

const CLIENTS = [
  { id: "a", nom: "SIVOM de la Loire", joursDevis: ["2017-06-12", "2024-03-02"], joursFactures: ["2017-07-01"] },
  { id: "b", nom: "Mairie de Rezé", joursDevis: ["2017-06-28"], joursFactures: [] },
  { id: "c", nom: "Bernard", joursDevis: ["2019-03-04"], joursFactures: ["2017-06-30"] },
  { id: "d", nom: "Aubry", joursDevis: [], joursFactures: [] },
];

console.log("Les trois clés du volet");

cas("les mots de Terminés, et les deux dates", () => {
  assert.deepEqual(
    CLES_TRI_CLIENTS.map((c) => c.libelle),
    ["Nom du client", "Date du devis", "Date de facturation"]
  );
});

console.log("\nLe mois choisi au calendrier");

cas("un jour du calendrier donne son mois", () => {
  assert.equal(moisDuJour("2017-06-12"), "2017-06");
  assert.equal(moisDuJour(""), null);
  assert.equal(moisDuJour("demain"), null);
});

cas("seuls les clients qui ont un devis ce mois-là, le plus récent en haut", () => {
  const r = clientsDuMois(CLIENTS, "devis", "2017-06");
  assert.deepEqual(r.map((c) => c.id), ["b", "a"]);
  assert.deepEqual(r[0].piece, { quoi: "Devis", jour: "2017-06-28" });
  assert.deepEqual(r[1].piece, { quoi: "Devis", jour: "2017-06-12" }, "la pièce de CE mois, pas sa plus récente");
});

cas("la date de facturation lit les factures, pas les devis", () => {
  const r = clientsDuMois(CLIENTS, "facture", "2017-06");
  assert.deepEqual(r.map((c) => c.id), ["c"]);
  assert.deepEqual(r[0].piece, { quoi: "Facture", jour: "2017-06-30" });
});

cas("un mois vide ne rend personne, et le dit", () => {
  assert.deepEqual(clientsDuMois(CLIENTS, "devis", "2010-01"), []);
  assert.equal(aucunePieceDuMois({ cle: "devis", mois: "2010-01" }), "Aucun devis en janvier 2010.");
  assert.equal(aucunePieceDuMois({ cle: "facture", mois: "2010-01" }), "Aucune facture en janvier 2010.");
});

cas("le titre dit la pièce et le mois, en minuscules après « de »", () => {
  assert.equal(titreDuTri({ cle: "devis", mois: "2017-06" }), "Devis de juin 2017");
  assert.equal(titreDuTri({ cle: "facture", mois: "2017-06" }), "Factures de juin 2017");
  assert.equal(titreDuTri({ cle: "nom" }), null, "de A à Z, aucun titre de plus");
});

if (echecs > 0) {
  console.error(`\n${echecs} contrôle(s) en échec.`);
  process.exit(1);
}
console.log("\nTous les contrôles du tri des clients sont passés.");
