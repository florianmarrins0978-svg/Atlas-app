import assert from "node:assert/strict";
import Decimal from "decimal.js";
import {
  categoriesDeLAvoir,
  categoriesDeLaFacture,
  recapParTaux,
  retirerLesAvoirs,
  tauxLisible,
  ventilerParTaux,
} from "../src/lib/tva-par-taux";
import { entreesDuReleve } from "../src/lib/exigibilite-tva";

// **« Il faudrait savoir c'est une TVA à combien »** — le patron, le
// 25 septembre 2026, sur la planche `appli/tva-collectee-a-la-calculette.html`.
//
// Ce que cette suite tient : une ligne du relevé découpée par taux ne change
// JAMAIS la TVA due. La somme des parts retombe au centime sur l'entrée, et
// chaque part se vérifie à la calculette à son propre taux. Le relevé portait
// jusqu'ici la MOYENNE d'une facture mixte (TVA ÷ HT de la facture entière),
// un taux qui n'existe pas.

const somme = (xs: readonly string[]) => xs.reduce((a, x) => a.plus(new Decimal(x)), new Decimal(0)).toFixed(2);
let n = 0;
const cas = (nom: string, f: () => void) => {
  f();
  n++;
  console.log(`  ✓ ${nom}`);
};

// Une facture de jardin qui mêle 10 % (plantes) et 20 % (main d'œuvre).
const lignesMixtes = [
  { montant: "400.00", tauxTva: "20.00" },
  { montant: "100.00", tauxTva: "10.00" },
];
const mixte = categoriesDeLaFacture(lignesMixtes, "20.00", null);

cas("une facture à un seul taux rend une seule part, identique à l'entrée", () => {
  const cats = categoriesDeLaFacture([{ montant: "465.00", tauxTva: null }], "20.00", null);
  assert.deepEqual(ventilerParTaux({ tva: "93.00", ttc: "558.00" }, cats), [
    { taux: "20.00", tva: "93.00", ttc: "558.00" },
  ]);
});

cas("une facture mixte émise entière rend exactement ses deux catégories", () => {
  // 400 à 20 % : 80 de TVA, 480 TTC ; 100 à 10 % : 10 de TVA, 110 TTC.
  const parts = ventilerParTaux({ tva: "90.00", ttc: "590.00" }, mixte);
  assert.deepEqual(parts, [
    { taux: "20.00", tva: "80.00", ttc: "480.00" },
    { taux: "10.00", tva: "10.00", ttc: "110.00" },
  ]);
});

cas("la moyenne n'apparaît jamais : chaque part porte un taux de la facture", () => {
  const parts = ventilerParTaux({ tva: "90.00", ttc: "590.00" }, mixte);
  // TVA ÷ HT de la facture entière : 90 ÷ 500 = 18 %, le taux que l'ancien relevé affichait.
  assert.ok(parts.every((p) => p.taux === "20.00" || p.taux === "10.00"));
});

cas("un acompte sur une facture mixte : les parts retombent au centime, et se vérifient à leur taux", () => {
  const facture = { dateEmission: "2026-09-01", totalHt: "500.00", totalTva: "90.00", totalTtc: "590.00", avoirs: [] };
  const entrees = entreesDuReleve(
    facture,
    [
      { date: "2026-09-05", montant: "296.00" },
      { date: "2026-09-20", montant: "294.00" },
    ],
    "encaissements"
  );
  let tvaTotale = new Decimal(0);
  for (const e of entrees) {
    const parts = ventilerParTaux(e, mixte);
    assert.equal(somme(parts.map((p) => p.ttc)), new Decimal(e.ttc).toFixed(2), "le montant se perd en route");
    assert.equal(somme(parts.map((p) => p.tva)), new Decimal(e.tva).toFixed(2), "la TVA se perd en route");
    for (const p of parts) {
      const attendue = new Decimal(p.ttc).times(new Decimal(p.taux!)).dividedBy(new Decimal(p.taux!).plus(100));
      assert.ok(
        attendue.minus(new Decimal(p.tva)).abs().lessThanOrEqualTo("0.02"),
        `À ${p.taux} %, ${p.ttc} € devraient porter ${attendue.toFixed(2)} € de TVA, la page dit ${p.tva}`
      );
    }
    tvaTotale = tvaTotale.plus(somme(parts.map((p) => p.tva)));
  }
  assert.equal(tvaTotale.toFixed(2), "90.00");
});

cas("un avoir sur la ligne à 10 % : le reste ne se déclare plus qu'à 20 %", () => {
  const avoir = categoriesDeLAvoir({ totalTva: "10.00", lignes: [{ totalHt: "100.00", tauxTva: "10.00" }] });
  assert.deepEqual(avoir, [{ taux: "10.00", ht: "100.00", tva: "10.00" }]);
  const net = retirerLesAvoirs(mixte, [avoir]);
  assert.deepEqual(net, [{ taux: "20.00", ht: "400.00", tva: "80.00" }]);
  assert.deepEqual(ventilerParTaux({ tva: "80.00", ttc: "480.00" }, net), [
    { taux: "20.00", tva: "80.00", ttc: "480.00" },
  ]);
});

cas("un avoir total se répartit sur ses taux et retombe sur ce qu'il retire", () => {
  const avoir = categoriesDeLAvoir({
    totalTva: "90.00",
    lignes: [
      { totalHt: "400.00", tauxTva: "20.00" },
      { totalHt: "100.00", tauxTva: "10.00" },
    ],
  });
  assert.equal(somme(avoir.map((c) => c.tva)), "90.00");
  assert.deepEqual(retirerLesAvoirs(mixte, [avoir]), []);
  // Aux débits, la ligne de l'avoir est NÉGATIVE : les parts le restent.
  const parts = ventilerParTaux({ tva: "-90.00", ttc: "-590.00" }, avoir);
  assert.equal(somme(parts.map((p) => p.tva)), "-90.00");
  assert.ok(parts.every((p) => new Decimal(p.ttc).isNegative()));
});

cas("une remise se répartit comme sur le papier de la facture", () => {
  const cats = categoriesDeLaFacture(lignesMixtes, "20.00", "10");
  assert.deepEqual(cats, [
    { taux: "20.00", ht: "360.00", tva: "72.00" },
    { taux: "10.00", ht: "90.00", tva: "9.00" },
  ]);
});

cas("sans catégorie lisible, le taux reste nul : il ne se devine pas", () => {
  assert.deepEqual(ventilerParTaux({ tva: "12.00", ttc: "72.00" }, []), [{ taux: null, tva: "12.00", ttc: "72.00" }]);
});

cas("le récapitulatif : du plus fort taux au plus faible, « sans taux » en dernier, montant manquant dit", () => {
  const recap = recapParTaux([
    { taux: "10.00", tva: "49.09", ttc: "540.00" },
    { taux: null, tva: "60.00", ttc: null },
    { taux: "20.00", tva: "15.40", ttc: "92.40" },
    { taux: "20", tva: "29.60", ttc: "177.60" },
  ]);
  assert.deepEqual(recap, [
    { taux: "20.00", tva: "45.00", ttc: "270.00", montantManquant: false },
    { taux: "10.00", tva: "49.09", ttc: "540.00", montantManquant: false },
    { taux: null, tva: "60.00", ttc: "0.00", montantManquant: true },
  ]);
});

cas("le taux s'écrit comme il se dit", () => {
  assert.equal(tauxLisible("20.00"), "20 %");
  assert.equal(tauxLisible("5.50"), "5,5 %");
});

console.log(`\n✅ ${n} cas : la TVA par taux retombe toujours sur le relevé.`);
