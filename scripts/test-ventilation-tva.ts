import assert from "node:assert/strict";
import Decimal from "decimal.js";
import { totauxAvecReduction } from "../src/lib/reduction-devis";
import {
  tauxLisible,
  tauxNormalise,
  tauxRepresentatif,
  ventilerTva,
} from "../src/lib/ventilation-tva";

// La TVA d'une facture qui porte PLUSIEURS taux.
//
// **Ce que cette suite protège, et ce n'est pas un confort.** Sa question du
// 1ᵉʳ septembre 2026 : « est-il possible que les TS n'aient pas la même TVA ? ».
// Oui — 5,5 % l'entretien, 10 % les travaux sur un logement de plus de deux
// ans, 20 % la création. Et l'ARTICLE 268 bis DU CGI taxe EN ENTIER au taux le
// plus élevé une facture qui ne ventile pas ses opérations : un supplément à
// 20 % noyé dans une facture à 10 % ferait passer toute la facture à 20 %, à sa
// charge.
//
// **L'invariant le plus important est le premier :** avec un seul taux, cette
// règle rend au centime ce que rendait `totauxAvecReduction`. Sans lui, la
// migration 0073 changerait le montant de milliers de factures existantes.

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

/** Sa facture du 31 août : F2026-000001, Mme Grospiron. */
const DEVIS = [
  { montant: "350.00", tauxTva: "20.00", origine: "devis" as const },
  { montant: "150.00", tauxTva: "20.00", origine: "devis" as const },
];

console.log("=== La TVA se ventile-t-elle par taux ? ===\n");

// ── L'invariant : un seul taux, et rien ne bouge ────────────────────────────

cas("un seul taux : au centime ce que rendait la règle du devis", () => {
  for (const pourcent of [null, "5", "12.5", "100"]) {
    for (const taux of ["20", "10", "5.5", "0"]) {
      const lignes = [{ montant: "450.00" }, { montant: "180.00" }, { montant: "240.00" }];
      const avant = totauxAvecReduction(lignes, taux, pourcent);
      const apres = ventilerTva(lignes, taux, pourcent);
      assert.equal(apres.totalHt, avant.totalHt, `HT à ${taux} % / remise ${pourcent}`);
      assert.equal(apres.totalTva, avant.totalTva, `TVA à ${taux} % / remise ${pourcent}`);
      assert.equal(apres.totalTtc, avant.totalTtc, `TTC à ${taux} % / remise ${pourcent}`);
      assert.equal(apres.reductionMontant, avant.reductionMontant);
      assert.equal(apres.brutHt, avant.brutHt);
    }
  }
});

cas("une ligne sans taux prend celui de la facture — tout l'historique en dépend", () => {
  // Les lignes d'avant la migration 0073 ont `taux_tva` nul : elles doivent
  // sortir identiques à elles-mêmes, sinon des factures déjà émises changent
  // de montant.
  const t = ventilerTva([{ montant: "500.00" }, { montant: "100.00", tauxTva: null }], "10");
  assert.equal(t.socles.length, 1);
  assert.equal(t.socles[0].tauxTva, "10.00");
  assert.equal(t.totalHt, "600.00");
  assert.equal(t.totalTva, "60.00");
  assert.equal(t.totalTtc, "660.00");
});

// ── Deux taux : sa facture, et le supplément qu'il ajoute ───────────────────

cas("sa facture + une terrasse à 20 % : un seul socle, 984,00 € TTC", () => {
  const t = ventilerTva(
    [...DEVIS, { montant: "320.00", tauxTva: "20.00", origine: "supplement" as const }],
    "20"
  );
  assert.equal(t.socles.length, 1);
  assert.equal(t.totalHt, "820.00");
  assert.equal(t.totalTva, "164.00");
  assert.equal(t.totalTtc, "984.00");
});

cas("un devis à 20 % et un supplément à 10 % : DEUX socles, jamais un taux moyen", () => {
  const t = ventilerTva(
    [...DEVIS, { montant: "200.00", tauxTva: "10.00", origine: "supplement" as const }],
    "20"
  );
  assert.equal(t.socles.length, 2);
  // Du plus élevé au plus bas : c'est l'ordre du document.
  assert.deepEqual(t.socles[0], { tauxTva: "20.00", ht: "500.00", tva: "100.00" });
  assert.deepEqual(t.socles[1], { tauxTva: "10.00", ht: "200.00", tva: "20.00" });
  assert.equal(t.totalHt, "700.00");
  assert.equal(t.totalTva, "120.00");
  assert.equal(t.totalTtc, "820.00");
});

cas("trois taux cohabitent — 20, 10 et 5,5", () => {
  const t = ventilerTva(
    [
      ...DEVIS,
      { montant: "200.00", tauxTva: "10.00", origine: "supplement" as const },
      { montant: "100.00", tauxTva: "5.50", origine: "supplement" as const },
    ],
    "20"
  );
  assert.equal(t.socles.length, 3);
  assert.deepEqual(
    t.socles.map((s) => s.tauxTva),
    ["20.00", "10.00", "5.50"]
  );
  assert.equal(t.socles[2].tva, "5.50");
  assert.equal(t.totalTtc, "925.50");
});

cas("deux lignes au MÊME taux ne font qu'un socle", () => {
  const t = ventilerTva(
    [
      ...DEVIS,
      { montant: "100.00", tauxTva: "10.00", origine: "supplement" as const },
      { montant: "50.00", tauxTva: "10.00", origine: "supplement" as const },
    ],
    "20"
  );
  assert.equal(t.socles.length, 2);
  assert.equal(t.socles[1].ht, "150.00");
});

// ── La remise ne mord que sur le devis ──────────────────────────────────────

cas("la remise porte sur le devis, jamais sur ce qui s'est ajouté", () => {
  // 10 % sur les 500 € du devis = 50 €. La terrasse ajoutée après n'a été
  // remisée par personne : l'inclure offrirait un rabais que le client n'a pas
  // négocié, et ferait diverger la facture du devis qu'il a sous les yeux.
  const t = ventilerTva(
    [...DEVIS, { montant: "320.00", tauxTva: "20.00", origine: "supplement" as const }],
    "20",
    "10"
  );
  assert.equal(t.reductionMontant, "50.00");
  assert.equal(t.totalHt, "770.00");
  assert.equal(t.totalTva, "154.00");
});

cas("remise et deux taux : le socle du devis maigrit, celui du supplément non", () => {
  const t = ventilerTva(
    [...DEVIS, { montant: "200.00", tauxTva: "10.00", origine: "supplement" as const }],
    "20",
    "10"
  );
  assert.equal(t.reductionMontant, "50.00");
  assert.deepEqual(t.socles[0], { tauxTva: "20.00", ht: "450.00", tva: "90.00" });
  assert.deepEqual(t.socles[1], { tauxTva: "10.00", ht: "200.00", tva: "20.00" });
  assert.equal(t.totalHt, "650.00");
});

// ── L'invariant qui compte pour le client : la somme des socles ─────────────

cas("la somme des socles vaut EXACTEMENT le total HT, remise comprise", () => {
  // Le client additionne les lignes de TVA de sa facture. Si la somme des
  // socles n'égale pas le HT annoncé, il n'arrive pas au même chiffre — et
  // c'est toute la facture dont il doute.
  const jeux = [
    { montants: ["333.33", "333.33", "333.34"], remise: "7" },
    { montants: ["100.01", "0.01", "99.99"], remise: "33.33" },
    { montants: ["1.00", "2.00", "3.00"], remise: "50" },
    { montants: ["870.00"], remise: "15" },
  ];
  for (const jeu of jeux) {
    const lignes = jeu.montants.map((m, i) => ({
      montant: m,
      tauxTva: i % 2 === 0 ? "20.00" : "10.00",
      origine: "devis" as const,
    }));
    const t = ventilerTva(lignes, "20", jeu.remise);
    const sommeHt = t.socles.reduce((a, s) => a.plus(new Decimal(s.ht)), new Decimal(0));
    const sommeTva = t.socles.reduce((a, s) => a.plus(new Decimal(s.tva)), new Decimal(0));
    assert.equal(sommeHt.toFixed(2), t.totalHt, `HT — ${jeu.montants.join("+")} remise ${jeu.remise}`);
    assert.equal(sommeTva.toFixed(2), t.totalTva, `TVA — ${jeu.montants.join("+")}`);
    assert.equal(new Decimal(t.totalHt).plus(t.totalTva).toFixed(2), t.totalTtc);
  }
});

cas("le centime perdu par les arrondis est rattrapé, jamais laissé", () => {
  // **Ce cas a été trouvé en confrontant le contrôle à sa mutation** : couper
  // le rattrapage du reste ne faisait rougir AUCUN test, parce qu'aucun jeu ne
  // le déclenchait. Un contrôle qu'on n'a pas vu rouge ne prouve rien
  // (`CLAUDE.md` §5).
  //
  // Deux socles de 0,05 €, remise de 50 % : la moitié de chacun vaut 0,025 €,
  // qui s'arrondit à 0,03 — deux fois 0,03 font 0,06, pour une remise annoncée
  // de 0,05. Sans rattrapage, le document écrirait « 0,10 − 0,05 = 0,04 », et
  // c'est exactement le genre de ligne qu'un client refait de tête.
  const t = ventilerTva(
    [
      { montant: "0.05", tauxTva: "20.00", origine: "devis" as const },
      { montant: "0.05", tauxTva: "10.00", origine: "devis" as const },
    ],
    "20",
    "50"
  );
  assert.equal(t.brutHt, "0.10");
  assert.equal(t.reductionMontant, "0.05");
  assert.equal(t.totalHt, "0.05");
  const sommeHt = t.socles.reduce((a, s) => a.plus(new Decimal(s.ht)), new Decimal(0));
  assert.equal(sommeHt.toFixed(2), "0.05");
});

cas("« brut − remise = net » se vérifie sur le papier, toujours", () => {
  // L'invariant que le CLIENT contrôle : les trois chiffres du bloc de totaux
  // doivent se soustraire juste. Il attrape le centime perdu là où la somme
  // des socles, elle, restait cohérente avec elle-même.
  const jeux: { montants: [string, string][]; remise: string }[] = [
    { montants: [["0.05", "20.00"], ["0.05", "10.00"]], remise: "50" },
    { montants: [["0.03", "20.00"], ["0.03", "5.50"], ["0.03", "10.00"]], remise: "50" },
    { montants: [["333.33", "20.00"], ["333.33", "10.00"], ["333.34", "5.50"]], remise: "7" },
    { montants: [["19.99", "20.00"], ["0.01", "10.00"]], remise: "33.33" },
  ];
  for (const jeu of jeux) {
    const lignes = jeu.montants.map(([montant, tauxTva]) => ({
      montant,
      tauxTva,
      origine: "devis" as const,
    }));
    const t = ventilerTva(lignes, "20", jeu.remise);
    assert.equal(
      new Decimal(t.brutHt).minus(t.reductionMontant ?? "0").toFixed(2),
      t.totalHt,
      `brut − remise ≠ net — ${JSON.stringify(jeu)}`
    );
  }
});

cas("le TTC vaut toujours HT + TVA, sur mille tirages", () => {
  // Un centime perdu quelque part ne se voit que sur un cas particulier : on
  // en tire mille plutôt que d'en choisir trois qui arrangent.
  let graine = 42;
  const suivant = () => {
    graine = (graine * 1103515245 + 12345) % 2147483648;
    return graine / 2147483648;
  };
  for (let i = 0; i < 1000; i++) {
    const lignes = Array.from({ length: 1 + Math.floor(suivant() * 4) }, () => ({
      montant: (suivant() * 2000).toFixed(2),
      tauxTva: ["20.00", "10.00", "5.50"][Math.floor(suivant() * 3)],
      origine: suivant() > 0.5 ? ("devis" as const) : ("supplement" as const),
    }));
    const remise = suivant() > 0.6 ? (suivant() * 30).toFixed(2) : null;
    const t = ventilerTva(lignes, "20", remise);
    const sommeHt = t.socles.reduce((a, s) => a.plus(new Decimal(s.ht)), new Decimal(0));
    assert.equal(sommeHt.toFixed(2), t.totalHt, `tirage ${i}`);
    assert.equal(
      new Decimal(t.brutHt).minus(t.reductionMontant ?? "0").toFixed(2),
      new Decimal(t.totalHt).toFixed(2),
      `tirage ${i} — brut − remise ≠ net`
    );
    assert.equal(new Decimal(t.totalHt).plus(t.totalTva).toFixed(2), t.totalTtc, `tirage ${i}`);
  }
});

// ── Les taux, tels qu'ils sont saisis et tels qu'ils s'écrivent ─────────────

cas("un taux se normalise, et se borne plutôt que de refuser", () => {
  assert.equal(tauxNormalise("20", "20"), "20.00");
  assert.equal(tauxNormalise("5,5", "20"), "5.50");
  assert.equal(tauxNormalise("200", "20"), "100.00");
  assert.equal(tauxNormalise("-3", "20"), "0.00");
  assert.equal(tauxNormalise(null, "10.00"), "10.00");
  assert.equal(tauxNormalise("n'importe quoi", "10.00"), "0.00");
});

cas("un taux s'écrit sans décimale inutile", () => {
  assert.equal(tauxLisible("20.00"), "20");
  assert.equal(tauxLisible("5.50"), "5,5");
  assert.equal(tauxLisible("10.00"), "10");
});

cas("le taux représentatif est le PLUS ÉLEVÉ — jamais une moyenne", () => {
  const t = ventilerTva(
    [...DEVIS, { montant: "200.00", tauxTva: "10.00", origine: "supplement" as const }],
    "20"
  );
  assert.equal(tauxRepresentatif(t.socles, "20.00"), "20.00");
  // Sans aucune ligne, la facture garde le sien.
  assert.equal(tauxRepresentatif([], "10.00"), "10.00");
});

cas("une facture vide ne rend ni socle ni NaN", () => {
  const t = ventilerTva([], "20");
  assert.equal(t.socles.length, 0);
  assert.equal(t.totalHt, "0.00");
  assert.equal(t.totalTtc, "0.00");
});

cas("un socle vidé par une remise de 100 % ne s'écrit pas", () => {
  // « TVA 20 % sur 0,00 € » n'apprend rien et allonge le bloc des totaux.
  const t = ventilerTva(DEVIS, "20", "100");
  assert.equal(t.totalHt, "0.00");
  assert.equal(t.socles.length, 0);
});

console.log(`\n${echecs === 0 ? "✅ Ventilation de TVA : tout est juste." : `❌ ${echecs} échec(s).`}`);
process.exit(echecs === 0 ? 0 : 1);
