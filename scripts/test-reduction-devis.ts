import assert from "node:assert/strict";
import {
  BORNES_REDUCTION,
  libelleReduction,
  pourcentValide,
  totauxAvecReduction,
} from "../src/lib/reduction-devis";

// Le prix accordé au client : que les totaux tombent juste, à l'euro près.
//
// **Ce que cette suite protège, et c'est de l'argent.** Le patron a choisi
// l'arrangement B le 16 août 2026 — « sous le total et prix accordé au client ».
// Il lui avait été dit ce que B coûte : la réduction n'est pas une ligne, donc
// elle doit être portée à la main dans le devis, la facture, leurs deux PDF et
// l'écran. **Chaque endroit qui recalculerait au lieu d'appeler cette règle est
// un montant faux sur un document qui part chez un client.**
//
// Le cas le plus vicieux est le dernier : 870 × 0,15 vaut
// 130.49999999999997 en virgule flottante. Un devis à 739,50 € deviendrait un
// devis à 739,51 €, et le client refait le calcul.

let echecs = 0;
function cas(nom: string, f: () => void) {
  try {
    f();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

/** Le devis de ses journées : 450 + 180 + 240 = 870,00 € HT. */
const LIGNES = [{ montant: "450.00" }, { montant: "180.00" }, { montant: "240.00" }];

console.log("=== Le prix accordé au client tombe-t-il juste ? ===\n");

// ── Les trois taux de sa maquette, vérifiés au centime ──────────────────────

cas("sans réduction, rien ne change de ce qui existait", () => {
  const t = totauxAvecReduction(LIGNES, "20");
  assert.equal(t.brutHt, "870.00");
  assert.equal(t.reductionPourcent, null);
  assert.equal(t.reductionMontant, null);
  assert.equal(t.totalHt, "870.00");
  assert.equal(t.totalTva, "174.00");
  assert.equal(t.totalTtc, "1044.00");
});

cas("5 % : 870 → 826,50 HT, TVA 165,30, TTC 991,80", () => {
  const t = totauxAvecReduction(LIGNES, "20", "5");
  assert.equal(t.reductionMontant, "43.50");
  assert.equal(t.totalHt, "826.50");
  assert.equal(t.totalTva, "165.30");
  assert.equal(t.totalTtc, "991.80");
});

cas("10 % : 870 → 783,00 HT, TVA 156,60, TTC 939,60", () => {
  const t = totauxAvecReduction(LIGNES, "20", "10");
  assert.equal(t.reductionMontant, "87.00");
  assert.equal(t.totalHt, "783.00");
  assert.equal(t.totalTva, "156.60");
  assert.equal(t.totalTtc, "939.60");
});

// **Le cas qui casse en virgule flottante.** 870 × 0,15 = 130.49999999999997.
cas("15 % : la virgule flottante ne vole pas un centime", () => {
  const t = totauxAvecReduction(LIGNES, "20", "15");
  assert.equal(t.reductionMontant, "130.50", "130,50 et pas 130,49 : c'est un centime du client");
  assert.equal(t.totalHt, "739.50");
  assert.equal(t.totalTva, "147.90");
  assert.equal(t.totalTtc, "887.40");
});

// ── L'ordre des opérations, qui n'est pas négociable ────────────────────────

cas("la TVA se calcule APRÈS la réduction, jamais avant", () => {
  const t = totauxAvecReduction(LIGNES, "20", "10");
  // 20 % du prix PLEIN font 174,00 € — ce serait une déclaration fausse.
  assert.notEqual(t.totalTva, "174.00");
  assert.equal(t.totalTva, "156.60");
  // Et la vérification par le bas : TVA = taux × totalHt.
  assert.equal(t.totalTva, (Number(t.totalHt) * 0.2).toFixed(2));
});

cas("le TTC est toujours la somme du HT et de sa TVA", () => {
  for (const p of [null, "5", "10", "15", "33.33", "100"]) {
    const t = totauxAvecReduction(LIGNES, "20", p);
    assert.equal(
      t.totalTtc,
      (Number(t.totalHt) + Number(t.totalTva)).toFixed(2),
      `à ${p} % : ${t.totalHt} + ${t.totalTva} ≠ ${t.totalTtc}`,
    );
  }
});

cas("le brut reste lisible, et le retiré s'y ajoute pour le retrouver", () => {
  const t = totauxAvecReduction(LIGNES, "20", "15");
  assert.equal(t.brutHt, "870.00", "le prix plein doit rester écrit : le document le montre");
  assert.equal(
    (Number(t.totalHt) + Number(t.reductionMontant)).toFixed(2),
    t.brutHt,
    "net + retiré doit refaire le brut, sinon le client trouve un écart",
  );
});

cas("un autre taux de TVA suit la même règle", () => {
  // 10 % en rénovation : le taux appartient au document, pas au produit.
  const t = totauxAvecReduction(LIGNES, "10", "5");
  assert.equal(t.totalHt, "826.50");
  assert.equal(t.totalTva, "82.65");
  assert.equal(t.totalTtc, "909.15");
});

// ── Ce qu'on refuse d'écrire sur un devis ───────────────────────────────────

cas("zéro veut dire « aucune réduction », pas « une réduction de zéro »", () => {
  for (const rien of ["0", 0, "0.00", "-5", -1]) {
    const t = totauxAvecReduction(LIGNES, "20", rien);
    assert.equal(t.reductionPourcent, null, JSON.stringify(rien));
    assert.equal(t.reductionMontant, null);
    assert.equal(t.totalHt, "870.00");
  }
});

cas("ce qui n'est pas un nombre n'est pas un pourcentage", () => {
  for (const faux of ["", "  ", "beaucoup", "cinq", null, undefined, {}, "5%"]) {
    assert.equal(pourcentValide(faux), null, JSON.stringify(faux));
  }
});

cas("un doigt qui glisse est borné, pas refusé en silence", () => {
  assert.equal(pourcentValide("150"), String(BORNES_REDUCTION.max));
  assert.equal(pourcentValide(1000), "100");
  // 100 % reste possible : un chantier offert existe, et le refuser serait
  // décider à sa place.
  const t = totauxAvecReduction(LIGNES, "20", "100");
  assert.equal(t.totalHt, "0.00");
  assert.equal(t.totalTva, "0.00");
  assert.equal(t.totalTtc, "0.00");
});

cas("la virgule française se lit comme le point", () => {
  assert.equal(pourcentValide("7,5"), "7.5");
  assert.equal(pourcentValide("7.5"), "7.5");
  assert.equal(totauxAvecReduction(LIGNES, "20", "7,5").reductionMontant, "65.25");
});

cas("plus de deux décimales sont ramenées à ce que la base porte", () => {
  // La colonne est `numeric(5,2)` : laisser passer « 7,333 » ferait diverger
  // l'écran de ce qui est enregistré.
  assert.equal(pourcentValide("7.333"), "7.33");
});

cas("un devis vide ne fabrique pas de réduction", () => {
  const t = totauxAvecReduction([], "20", "15");
  assert.equal(t.brutHt, "0.00");
  assert.equal(t.reductionMontant, "0.00");
  assert.equal(t.totalHt, "0.00");
  assert.equal(t.totalTtc, "0.00");
});

// ── Le mot, celui qu'il a désigné ───────────────────────────────────────────

cas("le document dit « Prix accordé au client », pas « Réduction »", () => {
  // Son choix du 16 août, contre l'autre mot qu'il proposait lui-même.
  assert.equal(libelleReduction("15"), "Prix accordé au client 15 %");
  assert.doesNotMatch(libelleReduction("15")!, /[Rr]éduction/);
});

cas("un pourcentage rond ne traîne pas ses décimales", () => {
  assert.equal(libelleReduction("5"), "Prix accordé au client 5 %");
  assert.equal(libelleReduction("5.00"), "Prix accordé au client 5 %");
  assert.equal(libelleReduction("7.5"), "Prix accordé au client 7,5 %");
});

cas("sans réduction, il n'y a pas de phrase — donc rien à imprimer", () => {
  assert.equal(libelleReduction(null), null);
  assert.equal(libelleReduction(totauxAvecReduction(LIGNES, "20").reductionPourcent), null);
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
