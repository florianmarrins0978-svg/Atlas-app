// Le fil par mois de « Terminés » — sans base de données.
//
// Trois choses que l'œil ne rattrape pas : dans quel mois tombe un chantier,
// combien attendent d'être facturés, et ce que chaque mois totalise.

import assert from "node:assert/strict";
import {
  grouperParMois,
  libelleEncart,
  totalFacture,
  estFacture,
  type LigneTerminee,
} from "../src/lib/termines-par-mois";

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

const ligne = (p: Partial<LigneTerminee> & { id: string }): LigneTerminee => ({
  nom: `Chantier ${p.id}`,
  clientNom: null,
  datePlanifiee: null,
  factureNumero: null,
  factureStatut: null,
  totalTtc: null,
  devisTotalTtc: null,
  ...p,
});

console.log("=== Le fil par mois ===");

essai("un chantier du 20 août est un chantier d'AOÛT, facturé ou non", () => {
  // Le sortir dans un bloc à part casserait le fil : il ne raconterait plus le
  // temps mais deux listes empilées.
  const mois = grouperParMois([
    ligne({ id: "a", datePlanifiee: "2026-08-20", devisTotalTtc: "1240.00" }),
    ligne({ id: "b", datePlanifiee: "2026-08-02", factureStatut: "emise", totalTtc: "1320.00" }),
  ]);
  assert.equal(mois.length, 1, `${mois.length} groupes au lieu d'un seul mois`);
  assert.equal(mois[0].nom, "août");
  assert.equal(mois[0].aFacturer.length, 1);
  assert.equal(mois[0].facturees.length, 1);
});

essai("le plus récent en tête", () => {
  const mois = grouperParMois([
    ligne({ id: "j", datePlanifiee: "2026-07-28", factureStatut: "emise", totalTtc: "1860.00" }),
    ligne({ id: "a", datePlanifiee: "2026-08-02", factureStatut: "emise", totalTtc: "1320.00" }),
  ]);
  assert.deepEqual(mois.map((m) => m.nom), ["août", "juillet"]);
});

essai("chaque mois porte SON total, et le trimestre le sien", () => {
  const mois = grouperParMois([
    ligne({ id: "a", datePlanifiee: "2026-08-02", factureStatut: "emise", totalTtc: "1320.00" }),
    ligne({ id: "j1", datePlanifiee: "2026-07-28", factureStatut: "emise", totalTtc: "1860.00" }),
    ligne({ id: "j2", datePlanifiee: "2026-07-21", factureStatut: "emise", totalTtc: "640.00" }),
  ]);
  assert.equal(mois[0].totalFacture, 1320);
  assert.equal(mois[1].totalFacture, 2500);
  assert.equal(totalFacture(mois), 3820);
});

essai("le total du mois ne compte QUE ce qui est facturé", () => {
  // Mélanger le prévu et le facturé ferait annoncer un chiffre qui n'existe
  // nulle part : ni ce qui est encaissé, ni ce qui attend.
  const mois = grouperParMois([
    ligne({ id: "a", datePlanifiee: "2026-08-02", factureStatut: "emise", totalTtc: "1320.00" }),
    ligne({ id: "b", datePlanifiee: "2026-08-20", devisTotalTtc: "1240.00" }),
  ]);
  assert.equal(mois[0].totalFacture, 1320);
  assert.equal(mois[0].totalPrevu, 1240);
});

essai("le montant affiché vient de la facture, sinon du devis", () => {
  const mois = grouperParMois([
    ligne({ id: "a", datePlanifiee: "2026-08-02", factureStatut: "emise", totalTtc: "1320.00", devisTotalTtc: "9999.00" }),
    ligne({ id: "b", datePlanifiee: "2026-08-20", devisTotalTtc: "1240.00" }),
  ]);
  assert.equal(mois[0].facturees[0].montant, 1320, "la facture doit primer sur le devis");
  assert.equal(mois[0].aFacturer[0].montant, 1240);
});

essai("une facture à 0,00 € se lit — elle ne se cache pas", () => {
  // Le patron en a une dans ses données réelles (F2026-0001). Sa réponse du
  // 10 août 2026 : on l'affiche telle quelle, sans commentaire.
  const mois = grouperParMois([
    ligne({ id: "z", datePlanifiee: "2026-08-05", factureStatut: "emise", totalTtc: "0.00", factureNumero: "F2026-0001" }),
  ]);
  assert.equal(mois[0].facturees.length, 1, "la facture nulle a disparu de l'écran");
  assert.equal(mois[0].facturees[0].montant, 0);
});

essai("un montant inconnu n'est pas zéro", () => {
  // Sinon on ne distinguerait plus une vraie facture à 0 € d'un devis muet.
  const mois = grouperParMois([ligne({ id: "x", datePlanifiee: "2026-08-11" })]);
  assert.equal(mois[0].aFacturer[0].montant, null);
  assert.equal(mois[0].totalPrevu, 0, "un montant inconnu ne doit rien ajouter au total");
});

essai("un chantier sans date ne se range pas au hasard", () => {
  const mois = grouperParMois([
    ligne({ id: "a", datePlanifiee: "2026-08-02", factureStatut: "emise", totalTtc: "10.00" }),
    ligne({ id: "s", datePlanifiee: null, factureStatut: "emise", totalTtc: "20.00" }),
  ]);
  assert.equal(mois[0].cle, "sans-date", "le groupe sans date doit venir en tête, pas se perdre au fond");
});

console.log("\n=== L'encart : à zéro, il n'existe pas ===");

essai("à zéro, PAS d'encart — jamais de « 0 »", () => {
  assert.equal(libelleEncart(0), null);
  assert.equal(libelleEncart(-1), null);
});

essai("le compte s'écrit en toutes lettres, capitale en tête", () => {
  assert.equal(libelleEncart(1), "Un à facturer");
  assert.equal(libelleEncart(2), "Deux à facturer");
  assert.equal(libelleEncart(8), "Huit à facturer");
});

essai("le compte annoncé égale le nombre de lignes montrées", () => {
  const lignes = [
    ligne({ id: "a", datePlanifiee: "2026-08-20", devisTotalTtc: "1240.00" }),
    ligne({ id: "b", datePlanifiee: "2026-08-18", devisTotalTtc: "700.00" }),
    ligne({ id: "c", datePlanifiee: "2026-08-02", factureStatut: "emise", totalTtc: "1320.00" }),
  ];
  const mois = grouperParMois(lignes);
  assert.equal(libelleEncart(mois[0].aFacturer.length), "Deux à facturer");
  assert.equal(mois[0].aFacturer.length, 2);
  assert.equal(mois[0].totalPrevu, 1940);
});

essai("« émise » est le seul état qui vaut facturé", () => {
  // Une facture préparée mais non envoyée n'est pas partie : le chantier
  // attend toujours. Créer n'est pas envoyer.
  assert.equal(estFacture({ factureStatut: "emise" }), true);
  assert.equal(estFacture({ factureStatut: "brouillon" }), false);
  assert.equal(estFacture({ factureStatut: null }), false);
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} Le fil de « Terminés » — ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
