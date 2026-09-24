/**
 * L'avoir : ce qu'il retire, et ce qu'il refuse (src/lib/avoir.ts).
 *
 * Les chiffres sont ceux de sa planche du 24 septembre 2026
 * (`appli/avoir.html`) : la facture F2026-000012 de M. Martin, cinq lignes,
 * 1 200,00 € HT, TVA 20 %, 1 440,00 € TTC.
 */
import assert from "node:assert/strict";
import { calculerAvoir, type FacturePourAvoir } from "../src/lib/avoir";

let echecs = 0;
function cas(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

const ligne = (id: string, libelle: string, quantite: string, unite: string, pu: string, taux: string | null = null) => ({
  id,
  libelle,
  quantite,
  unite,
  prixUnitaire: pu,
  montant: (Number(pu) * Number(quantite)).toFixed(2),
  tauxTva: taux,
});

const FACTURE: FacturePourAvoir = {
  numero: "F2026-000012",
  totalHt: "1200.00",
  totalTva: "240.00",
  totalTtc: "1440.00",
  tauxTva: "20.00",
  reductionPourcent: null,
  lignes: [
    ligne("l1", "Taille de haie de thuyas, trois faces", "38", "ml", "12.00"),
    ligne("l2", "Taille de haie de lauriers, deux faces", "22", "ml", "15.00"),
    ligne("l3", "Désherbage manuel des massifs", "4", "h", "45.00"),
    ligne("l4", "Évacuation des déchets verts en déchetterie", "1", "forfait", "164.00"),
    ligne("l5", "Déplacement", "2", "u", "35.00"),
  ],
};

const refus = (r: ReturnType<typeof calculerAvoir>) => (r.ok ? null : r.refus);
const avoir = (r: ReturnType<typeof calculerAvoir>) => {
  if (!r.ok) throw new Error(`refusé : ${r.refus}`);
  return r.avoir;
};

console.log("\n=== Ce qu'il retire ===");

cas("300 € sur toute la facture : 250 € HT et 50 € de TVA, sur une ligne à son motif", () => {
  const a = avoir(calculerAvoir(FACTURE, [], { portee: null, montantTtc: "300", motif: "Geste commercial" }));
  assert.equal(a.totalHt, "250.00");
  assert.equal(a.totalTva, "50.00");
  assert.equal(a.totalTtc, "300.00");
  assert.equal(a.total, false);
  assert.equal(a.lignes.length, 1);
  assert.equal(a.lignes[0]!.libelle, "Geste commercial, sur la facture F2026-000012");
});

cas("100 € sur la haie de thuyas : la ligne est nommée, et HT + TVA retombe sur le TTC", () => {
  const a = avoir(calculerAvoir(FACTURE, [], { portee: "l1", montantTtc: "100", motif: "Geste commercial" }));
  assert.equal(a.ligneFactureId, "l1");
  assert.equal(a.totalHt, "83.33");
  assert.equal(a.totalTva, "16.67");
  assert.equal(a.lignes[0]!.libelle, "Geste commercial, sur taille de haie de thuyas, trois faces");
});

cas("tout retirer reprend chaque ligne de la facture, et ses totaux exacts", () => {
  const a = avoir(calculerAvoir(FACTURE, [], { portee: null, montantTtc: "1440", motif: "Annulation" }));
  assert.equal(a.total, true);
  assert.equal(a.lignes.length, 5);
  assert.equal(a.totalHt, "1200.00");
  assert.equal(a.totalTva, "240.00");
});

cas("un montant avec virgule se lit : 250,50", () => {
  assert.equal(avoir(calculerAvoir(FACTURE, [], { portee: null, montantTtc: "250,50", motif: "Remise" })).totalTtc, "250.50");
});

console.log("\n=== Ce qu'il refuse, et ce qu'il dit ===");

cas("sans motif, la loi le demande", () => {
  assert.match(refus(calculerAvoir(FACTURE, [], { portee: null, montantTtc: "300", motif: "  " }))!, /motif/);
});

cas("un montant illisible, vide ou nul", () => {
  assert.match(refus(calculerAvoir(FACTURE, [], { portee: null, montantTtc: "abc", motif: "x" }))!, /ne se lit pas/);
  assert.match(refus(calculerAvoir(FACTURE, [], { portee: null, montantTtc: "", motif: "x" }))!, /Écrivez le montant/);
  assert.match(refus(calculerAvoir(FACTURE, [], { portee: null, montantTtc: "0", motif: "x" }))!, /0 €/);
});

cas("plus que la facture", () => {
  assert.match(refus(calculerAvoir(FACTURE, [], { portee: null, montantTtc: "1500", motif: "x" }))!, /plus que la facture/);
});

cas("plus que la ligne choisie : 547,20 € au plus sur les thuyas", () => {
  const r = refus(calculerAvoir(FACTURE, [], { portee: "l1", montantTtc: "600", motif: "x" }))!;
  assert.match(r, /plus que cette ligne/);
  assert.match(r, /547,20/);
});

cas("un avoir déjà fait réduit ce qu'on peut encore retirer", () => {
  const deja = [{ ligneFactureId: null, totalTtc: "1400.00" }];
  assert.match(refus(calculerAvoir(FACTURE, deja, { portee: null, montantTtc: "50", motif: "x" }))!, /plus que la facture/);
  assert.equal(avoir(calculerAvoir(FACTURE, deja, { portee: null, montantTtc: "40", motif: "x" })).total, false);
});

cas("SA RÉPONSE « LA B » : deux taux de TVA, une partie, et il doit choisir la ligne", () => {
  const deuxTaux: FacturePourAvoir = {
    ...FACTURE,
    lignes: [ligne("p", "Plantation", "1", "u", "1000.00", "10"), ligne("e", "Entretien", "1", "u", "1000.00", "20")],
    totalHt: "2000.00",
    totalTva: "300.00",
    totalTtc: "2300.00",
  };
  assert.match(refus(calculerAvoir(deuxTaux, [], { portee: null, montantTtc: "230", motif: "x" }))!, /choisissez la ligne/);
  // Sur l'entretien : 230 € TTC à 20 %, soit 191,67 € HT et 38,33 € de TVA.
  const a = avoir(calculerAvoir(deuxTaux, [], { portee: "e", montantTtc: "230", motif: "x" }));
  assert.equal(a.totalHt, "191.67");
  assert.equal(a.totalTva, "38.33");
});

cas("une remise de 10 % : la ligne ne vaut plus que ce que le client a payé", () => {
  const remisee: FacturePourAvoir = { ...FACTURE, reductionPourcent: "10" };
  // 456 € HT − 10 % = 410,40 € HT, soit 492,48 € TTC.
  assert.match(refus(calculerAvoir(remisee, [], { portee: "l1", montantTtc: "492.49", motif: "x" }))!, /492,48/);
  assert.equal(avoir(calculerAvoir(remisee, [], { portee: "l1", montantTtc: "492.48", motif: "x" })).totalTtc, "492.48");
});

console.log(`\n${echecs === 0 ? "✅ Toutes les vérifications passent." : `❌ ${echecs} échec(s).`}`);
process.exit(echecs === 0 ? 0 : 1);
