import assert from "node:assert/strict";
import { bilanDeLaPeriode } from "../src/lib/bilan-periode";
import { consigneDuJour } from "../src/server/ai/services/assistant-service";

/**
 * L'assistant sait quel jour on est, et compte une période sans calculer.
 *
 * **Sa demande du 28 septembre 2026 :** *« joue le rôle d'un utilisateur qui
 * a des questions à lui poser et corrige à la racine celles où il n'arrive
 * pas à répondre »*. Deux racines sont sorties du jeu : la consigne ne portait
 * aucune date (« ce mois », « demain » se devinaient), et aucun outil ne
 * savait dire ce qui a été facturé ou encaissé entre deux jours.
 */

let echecs = 0;
function cas(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`❌ ${nom}\n   ${e instanceof Error ? e.message : e}`);
  }
}

cas("la consigne porte le jour de l'atelier, en lettres et en chiffres", () => {
  const c = consigneDuJour("2026-09-28");
  assert.match(c, /AUJOURD'HUI : .*28 septembre 2026 \(2026-09-28\)/);
  assert.match(c, /"ce mois"/);
});

cas("le jour vient APRÈS la consigne fixe", () => {
  // Le début ne change pas d'une question à l'autre.
  assert.equal(consigneDuJour("2026-09-28").split("AUJOURD'HUI")[0], consigneDuJour("2027-01-01").split("AUJOURD'HUI")[0]);
});

const factures = [
  {
    dateEmission: "2026-09-10",
    totalHt: "100.00",
    totalTtc: "120.00",
    avoirs: [{ date: "2026-10-02", ht: "10.00", ttc: "12.00" }],
    paiements: [
      { date: "2026-09-15", montant: "50.00" },
      { date: "2026-10-05", montant: "58.00" },
    ],
  },
  { dateEmission: "2026-10-01", totalHt: "200.00", totalTtc: "240.00", avoirs: [], paiements: [] },
];

cas("septembre : la facture de septembre, le règlement de septembre", () => {
  const b = bilanDeLaPeriode(factures, "2026-09-01", "2026-09-30");
  assert.deepEqual(
    [b.factureHt, b.factureTtc, b.encaisse, b.nombreFactures, b.nombreReglements, b.nombreAvoirs],
    ["100.00", "120.00", "50.00", 1, 1, 0]
  );
});

cas("octobre : l'avoir retire le jour où il est fait, le règlement tardif compte en octobre", () => {
  const b = bilanDeLaPeriode(factures, "2026-10-01", "2026-10-31");
  assert.deepEqual([b.factureHt, b.factureTtc, b.encaisse, b.nombreAvoirs], ["190.00", "228.00", "58.00", 1]);
});

cas("les bornes sont comprises", () => {
  assert.equal(bilanDeLaPeriode(factures, "2026-09-10", "2026-09-10").nombreFactures, 1);
  assert.equal(bilanDeLaPeriode(factures, "2026-09-11", "2026-09-30").nombreFactures, 0);
});

if (echecs > 0) {
  console.error(`\n❌ ${echecs} échec(s).`);
  process.exit(1);
}
console.log("\n✅ L'assistant sait le jour, et compte une période sans calculer de tête.");
process.exit(0);
