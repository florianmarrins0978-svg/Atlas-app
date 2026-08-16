import assert from "node:assert/strict";
import Decimal from "decimal.js";
import {
  dansLaPeriode,
  enAttenteDeReglement,
  entreesDuReleve,
  etatPaiement,
  refusDuPaiement,
  resteDu,
  totalRegle,
  type FacturePourTva,
  type Paiement,
} from "../src/lib/exigibilite-tva";

// **« Est-ce qu'il y a une possibilité pour que la facture rentre au relevé de
// TVA seulement une fois que le client m'a payé ? »** — le patron, le 14 août
// 2026. Puis : *« elle arrive dans un endroit en attente, et lorsque j'ai reçu
// le paiement, je clique sur valider et boum. »*
//
// **Ce que cette suite tient est ce qui part à l'administration.** Aucun autre
// module de ce dépôt n'a cette qualité-là : une erreur ici ne se voit pas sur un
// écran, elle se voit sur une déclaration de TVA, des mois plus tard, et c'est
// le patron qui la paie.
//
//   1. **le régime décide de la date**, et de rien d'autre ;
//   2. **un acompte n'apporte que SA part de TVA** — au prorata du TTC. Ni
//      tout, ni rien : 500 € sur 1 440 € apportent 83,33 € et non 240 € ;
//   3. **les centimes ne se perdent pas.** Trois acomptes arrondis chacun de
//      leur côté ne tombent pas sur le total ; la somme des lignes du relevé
//      doit valoir la facture, au centime ;
//   4. **un montant qui dépasse est REFUSÉ**, avec sa phrase — sinon le relevé
//      porterait plus de TVA que la facture n'en contient.

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

/** La facture qui sert d'exemple à tout le projet : 1 200 € HT, 20 % de TVA. */
const FACTURE: FacturePourTva = {
  dateEmission: "2026-08-05",
  totalHt: "1200.00",
  totalTva: "240.00",
  totalTtc: "1440.00",
};

console.log("\n=== Le régime décide de la date, et de rien d'autre ===");

cas("aux débits, la facture entre entière le jour de son émission", () => {
  const entrees = entreesDuReleve(FACTURE, [], "debits");
  assert.equal(entrees.length, 1);
  assert.equal(entrees[0].date, "2026-08-05");
  assert.equal(entrees[0].tva, "240.00");
  assert.equal(entrees[0].motif, "emission");
});

cas("aux débits, les règlements ne changent RIEN", () => {
  // C'est tout le sujet de sa question : sous ce régime, payer ou ne pas payer
  // ne déplace pas un centime de TVA.
  const avec = entreesDuReleve(FACTURE, [{ date: "2026-09-20", montant: "1440.00" }], "debits");
  assert.deepEqual(avec, entreesDuReleve(FACTURE, [], "debits"));
});

cas("AUX ENCAISSEMENTS, UNE FACTURE IMPAYÉE N'APPORTE RIEN", () => {
  // La demande, en une ligne.
  assert.deepEqual(entreesDuReleve(FACTURE, [], "encaissements"), []);
});

cas("payée en entier, elle entre à la date du RÈGLEMENT", () => {
  const entrees = entreesDuReleve(FACTURE, [{ date: "2026-10-02", montant: "1440.00" }], "encaissements");
  assert.equal(entrees.length, 1);
  assert.equal(entrees[0].date, "2026-10-02", "la date d'émission a été retenue au lieu de celle du paiement");
  assert.equal(entrees[0].tva, "240.00");
  assert.equal(entrees[0].motif, "paiement");
});

cas("un règlement d'octobre ne tombe pas dans le trimestre de l'émission", () => {
  // Le cas qui coûte de l'argent : facturé en août, payé en octobre. La TVA
  // appartient au 4e trimestre, pas au 3e.
  const [entree] = entreesDuReleve(FACTURE, [{ date: "2026-10-02", montant: "1440.00" }], "encaissements");
  assert.equal(dansLaPeriode(entree, "2026-07-01", "2026-09-30"), false);
  assert.equal(dansLaPeriode(entree, "2026-10-01", "2026-12-31"), true);
});

console.log("\n=== Un acompte n'apporte que SA part de TVA ===");

cas("500 € sur 1 440 € apportent 83,33 € de TVA — ni 240, ni zéro", () => {
  const [entree] = entreesDuReleve(FACTURE, [{ date: "2026-08-20", montant: "500.00" }], "encaissements");
  assert.equal(entree.tva, "83.33", `l'acompte a apporté ${entree.tva} € de TVA`);
  assert.equal(entree.ht, "416.67");
  assert.equal(entree.ttc, "500.00");
});

cas("LES CENTIMES NE SE PERDENT PAS : trois acomptes retombent sur la facture", () => {
  // **Le contrôle qui protège la déclaration.** Trois tiers de 1 440 € arrondis
  // chacun de leur côté donnent 239,99 € ou 240,01 € de TVA. Le relevé ne
  // tomberait plus sur la facture, et personne ne saurait expliquer l'écart.
  const acomptes: Paiement[] = [
    { date: "2026-08-20", montant: "480.00" },
    { date: "2026-09-10", montant: "480.00" },
    { date: "2026-10-05", montant: "480.00" },
  ];
  const entrees = entreesDuReleve(FACTURE, acomptes, "encaissements");
  assert.equal(entrees.length, 3);
  const somme = (champ: "ht" | "tva" | "ttc") =>
    entrees.reduce((a, e) => a.plus(new Decimal(e[champ])), new Decimal(0)).toFixed(2);
  assert.equal(somme("tva"), "240.00", `la somme des TVA vaut ${somme("tva")} au lieu de 240,00`);
  assert.equal(somme("ht"), "1200.00");
  assert.equal(somme("ttc"), "1440.00");
});

cas("des tiers qui ne tombent pas rond retombent quand même juste", () => {
  const facture: FacturePourTva = { dateEmission: "2026-01-05", totalHt: "100.00", totalTva: "20.00", totalTtc: "120.00" };
  const entrees = entreesDuReleve(
    facture,
    [
      { date: "2026-01-10", montant: "40.00" },
      { date: "2026-01-20", montant: "40.00" },
      { date: "2026-01-30", montant: "40.00" },
    ],
    "encaissements"
  );
  const tva = entrees.reduce((a, e) => a.plus(new Decimal(e.tva)), new Decimal(0)).toFixed(2);
  assert.equal(tva, "20.00", `la somme des TVA vaut ${tva}`);
});

cas("les règlements se lisent dans l'ordre des dates, pas de la saisie", () => {
  // Il note le solde avant l'acompte, un soir de rattrapage : c'est la date qui
  // décide de la période, jamais l'ordre de saisie.
  const entrees = entreesDuReleve(
    FACTURE,
    [
      { date: "2026-10-05", montant: "940.00" },
      { date: "2026-08-20", montant: "500.00" },
    ],
    "encaissements"
  );
  assert.deepEqual(entrees.map((e) => e.date), ["2026-08-20", "2026-10-05"]);
});

console.log("\n=== Ce qui reste dû, et où en est la facture ===");

cas("le reste dû se calcule, et ne devient jamais négatif", () => {
  assert.equal(resteDu(FACTURE, []), "1440.00");
  assert.equal(resteDu(FACTURE, [{ date: "2026-08-20", montant: "500.00" }]), "940.00");
  assert.equal(resteDu(FACTURE, [{ date: "2026-08-20", montant: "2000.00" }]), "0.00");
});

cas("les trois états d'une facture", () => {
  assert.equal(etatPaiement(FACTURE, []), "en_attente");
  assert.equal(etatPaiement(FACTURE, [{ date: "2026-08-20", montant: "500.00" }]), "partielle");
  assert.equal(etatPaiement(FACTURE, [{ date: "2026-08-20", montant: "1440.00" }]), "soldee");
});

cas("un centime manquant ne solde PAS la facture", () => {
  // Ce centime-là fera un avoir ou une relance. Ce n'est pas à une application
  // d'en décider par un arrondi.
  assert.equal(etatPaiement(FACTURE, [{ date: "2026-08-20", montant: "1439.99" }]), "partielle");
});

cas("le total reçu s'additionne juste", () => {
  assert.equal(
    totalRegle([
      { date: "2026-08-20", montant: "500.00" },
      { date: "2026-10-05", montant: "940.00" },
    ]),
    "1440.00"
  );
});

console.log("\n=== Les refus, et leurs phrases ===");

cas("UN MONTANT PLUS GRAND QUE LE RESTE DÛ EST REFUSÉ", () => {
  // Sans ce refus, le relevé porterait plus de TVA que la facture n'en contient,
  // et c'est l'administration qui poserait la question.
  const refus = refusDuPaiement(FACTURE, [{ date: "2026-08-20", montant: "1000.00" }], {
    date: "2026-09-01",
    montant: "500.00",
  });
  assert.ok(refus, "un trop-perçu de 60 € a été accepté");
  assert.match(refus, /440,00 €|440.00 €/, `le refus ne dit pas ce qui reste : « ${refus} »`);
});

cas("un règlement antérieur à la facture est refusé", () => {
  const refus = refusDuPaiement(FACTURE, [], { date: "2026-07-30", montant: "100.00" });
  assert.ok(refus, "un règlement daté d'avant l'émission a été accepté");
  assert.match(refus, /avant la facture/i);
});

cas("un montant qui n'en est pas un est refusé", () => {
  for (const montant of ["", "zéro", "0", "-100"]) {
    assert.ok(refusDuPaiement(FACTURE, [], { date: "2026-08-20", montant }), `« ${montant} » a été accepté`);
  }
});

cas("une date qui n'en est pas une est refusée", () => {
  for (const date of ["", "20/08/2026", "2026-8-5"]) {
    assert.ok(refusDuPaiement(FACTURE, [], { date, montant: "100.00" }), `« ${date} » a été acceptée`);
  }
});

cas("un règlement qui tombe juste est ACCEPTÉ", () => {
  assert.equal(refusDuPaiement(FACTURE, [], { date: "2026-08-20", montant: "1440.00" }), null);
  assert.equal(
    refusDuPaiement(FACTURE, [{ date: "2026-08-20", montant: "500.00" }], { date: "2026-09-01", montant: "940.00" }),
    null
  );
});

console.log("\n=== Ce qui attend, et qu'il faut ANNONCER ===");

cas("l'attente compte les factures non soldées, et leur TVA", () => {
  const attente = enAttenteDeReglement(
    [
      { facture: FACTURE, paiements: [] },
      { facture: FACTURE, paiements: [{ date: "2026-08-20", montant: "1440.00" }] },
    ],
    "encaissements"
  );
  assert.equal(attente.nombre, 1);
  assert.equal(attente.ttc, "1440.00");
  assert.equal(attente.tva, "240.00");
});

cas("une facture à moitié réglée n'attend plus que sa moitié", () => {
  const attente = enAttenteDeReglement(
    [{ facture: FACTURE, paiements: [{ date: "2026-08-20", montant: "500.00" }] }],
    "encaissements"
  );
  assert.equal(attente.ttc, "940.00");
  assert.equal(attente.tva, "156.67");
});

cas("aux débits, rien n'attend — tout est déjà déclaré", () => {
  const attente = enAttenteDeReglement([{ facture: FACTURE, paiements: [] }], "debits");
  assert.deepEqual(attente, { nombre: 0, ttc: "0.00", tva: "0.00" });
});

console.log("\n=== Ce qui ne doit pas casser ===");

cas("une facture à zéro n'apporte rien, et ne divise pas par zéro", () => {
  const gratuite: FacturePourTva = { dateEmission: "2026-08-05", totalHt: "0.00", totalTva: "0.00", totalTtc: "0.00" };
  assert.deepEqual(entreesDuReleve(gratuite, [{ date: "2026-08-20", montant: "10.00" }], "encaissements"), []);
  assert.equal(enAttenteDeReglement([{ facture: gratuite, paiements: [] }], "encaissements").tva, "0.00");
});

cas("une facture en franchise de TVA passe sans encombre", () => {
  const franchise: FacturePourTva = { dateEmission: "2026-08-05", totalHt: "500.00", totalTva: "0.00", totalTtc: "500.00" };
  const [entree] = entreesDuReleve(franchise, [{ date: "2026-09-01", montant: "500.00" }], "encaissements");
  assert.equal(entree.tva, "0.00");
  assert.equal(entree.ht, "500.00");
});

console.log(`\n${echecs === 0 ? "✅ Toutes les vérifications passent." : `❌ ${echecs} échec(s).`}`);
process.exit(echecs === 0 ? 0 : 1);
