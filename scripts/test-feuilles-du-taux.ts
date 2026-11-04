/**
 * Les feuilles de la TVA et de la remise — leurs règles, sans base ni écran.
 *
 * Nées sur le devis le 1er novembre 2026 (`appli/soignee/chantier.html?ecran=devis`),
 * reprises par la facture le 4 novembre (`appli/soignee/facture.html`, page
 * « ts », état « sansdevis », sa réponse « oui »). Deux écrans, une seule
 * lecture : ce que la feuille accepte ou refuse, et ce qu'elle montre avant
 * d'appliquer, se décident ici, et le chiffre montré est celui qui sera posé.
 */
import assert from "node:assert/strict";
import { apercuDeLaRemise, lireUneRemise, lireUneTva } from "../src/lib/feuilles-du-taux";

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

// Les montants portent une espace fine et une insécable : on les ramène à l'espace.
const lisible = (t: string) => t.replace(/[  ]/g, " ");

console.log("Les feuilles de la TVA et de la remise");

cas("un taux tapé à la française se lit, à deux décimales", () => {
  assert.deepEqual(lireUneTva("8,5", ["20.00"], "ce devis"), { taux: "8.50" });
  assert.deepEqual(lireUneTva("0", ["20.00"], "cette facture"), { taux: "0.00" });
});

cas("ce qui n'est pas un taux se refuse avec ses mots", () => {
  const lu = lireUneTva("dix", ["20.00"], "cette facture");
  assert.ok("refus" in lu && lu.refus.length > 0, "aucun refus écrit");
});

cas("une TVA déjà ouverte se refuse, et la phrase nomme la pièce", () => {
  assert.deepEqual(lireUneTva("20", ["20.00", "10.00"], "ce devis"), { refus: "Une TVA à 20 % est déjà sur ce devis." });
  assert.deepEqual(lireUneTva("10", ["20.00", "10.00"], "cette facture"), {
    refus: "Une TVA à 10 % est déjà sur cette facture.",
  });
});

cas("zéro n'est pas une remise ; un pourcentage tapé se lit", () => {
  assert.ok("refus" in lireUneRemise("0"));
  assert.ok("refus" in lireUneRemise(""));
  assert.deepEqual(lireUneRemise("12"), { taux: "12" });
  assert.deepEqual(lireUneRemise("7,5"), { taux: "7.5" });
});

cas("la remise montre ce qu'elle retire, avec les totaux de la pièce", () => {
  const apercu = apercuDeLaRemise(
    [
      { montant: "450.00", tauxTva: null },
      { montant: "180.00", tauxTva: null },
      { montant: "240.00", tauxTva: null },
    ],
    "20.00",
    "5"
  );
  assert.deepEqual(
    { calcul: lisible(apercu.calcul), montant: lisible(apercu.montant), dessous: lisible(apercu.dessous ?? "") },
    { calcul: "5 % de 870,00 € HT", montant: "− 43,50 €", dessous: "Total HT après remise : 826,50 €" }
  );
});

cas("ce qui ne reçoit pas la remise ne se compte pas dans ce qu'elle retire", () => {
  // Un travail en plus d'une facture n'a jamais été remisé (sa « A » du
  // 7 octobre 2026) : l'aperçu suit la règle des totaux, pas une seconde.
  const apercu = apercuDeLaRemise(
    [
      { montant: "1000.00", tauxTva: null, supplement: false },
      { montant: "200.00", tauxTva: null, supplement: true },
    ],
    "20.00",
    "10"
  );
  assert.equal(lisible(apercu.montant), "− 100,00 €");
  assert.equal(lisible(apercu.dessous ?? ""), "Total HT après remise : 1 100,00 €");
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} Les feuilles de la TVA et de la remise — ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
