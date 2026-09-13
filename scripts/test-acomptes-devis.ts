// Les acomptes du devis — sa demande du 12 septembre 2026, la B choisie sur
// planche (`appli/l-acompte-sur-le-devis.html`).
//
// CE QUE CETTE SUITE TIENT, ET QUI SE CASSERAIT SANS ELLE :
//
//   · LES TAUX SONT CUMULÉS — *« oui je veux des taux cumulés »*. « 50 » à
//     mi-parcours veut dire la moitié du devis réglée à ce moment-là, et ce qui
//     tombe ce jour-là est la différence avec l'acompte d'avant ;
//   · LE RESTE N'EST JAMAIS NÉGATIF. Son essai du soir — 30, 50, 75 lus comme
//     des parts — rendait −1 564,20 € sur un devis qui partait chez un client ;
//   · SES VALEURS D'OFFICE : les Réglages, puis 50, puis 75 ;
//   · LA FIN DU CHANTIER N'EST PAS UN ACOMPTE — *« le 3ᵉ n'est pas en fin de
//     chantier, c'est le solde »* ;
//   · UNE SEULE RÈGLE pour l'écran, le dépôt et le PDF : les phrases des notes
//     disent le cumul en clair, sans le tiret qu'il a fait retirer.

import assert from "node:assert/strict";
import {
  ACOMPTES_MAX,
  MOMENTS_ACOMPTE,
  acompteDOffice,
  acompteSuivantPropose,
  echeancierDevis,
  libelleLigneAcompte,
  phrasesAcomptes,
  tauxCumuleValide,
  tauxCumulesBornes,
} from "../src/lib/acomptes-devis";
import { lignesConditionsDevis, lireConditions } from "../src/lib/conditions-documents";
import { enEuros } from "../src/lib/euros";

let echecs = 0;
function cas(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}`);
    console.log(`    ${(e as Error).message}`);
  }
}

/** Le devis de la planche : 2 370 € HT, TVA 20 %, 2 844,00 € TTC. */
const TTC = "2844.00";

console.log("=== Les acomptes du devis tombent-ils juste ? ===\n");

cas("30 → 50 → 75 sur 2 844 € : 853,20 · 568,80 · 711,00, et il reste 711,00", () => {
  const e = echeancierDevis(
    [{ rang: 1, tauxCumule: "30" }, { rang: 2, tauxCumule: "50" }, { rang: 3, tauxCumule: "75" }],
    TTC
  );
  assert.deepEqual(e.lignes.map((l) => l.montant), ["853.20", "568.80", "711.00"]);
  assert.equal(e.reste, "711.00");
  assert.equal(e.libelleReste, "Reste à régler après acomptes");
});

cas("les acomptes plus le reste font EXACTEMENT le TTC, centimes compris", () => {
  // 1 044,00 € TTC à 33 % : les centimes résiduels ne se perdent pas.
  const e = echeancierDevis([{ rang: 1, tauxCumule: "33" }, { rang: 2, tauxCumule: "66" }], "1044.00");
  const somme = e.lignes.reduce((t, l) => t + Number(l.montant), 0) + Number(e.reste);
  assert.equal(somme.toFixed(2), "1044.00");
});

cas("un seul acompte : le libellé du reste est au singulier", () => {
  const e = echeancierDevis([{ rang: 1, tauxCumule: "30" }], TTC);
  assert.equal(e.lignes[0].montant, "853.20");
  assert.equal(e.reste, "1990.80");
  assert.equal(e.libelleReste, "Reste à régler après acompte");
});

cas("sans acompte : aucune ligne, tout le TTC en reste", () => {
  const e = echeancierDevis([], TTC);
  assert.equal(e.lignes.length, 0);
  assert.equal(e.reste, TTC);
});

// ── La borne : jamais sous le précédent, jamais au-dessus de 100 ────────────

cas("son essai du soir (30/50/75 tapés comme des parts) ne rend plus un reste négatif", () => {
  // Lus cumulés, ces trois-là sont valides tels quels ; mais 30/50/40 ne l'est pas.
  const e = echeancierDevis(
    [{ rang: 1, tauxCumule: "30" }, { rang: 2, tauxCumule: "50" }, { rang: 3, tauxCumule: "40" }],
    TTC
  );
  assert.equal(e.lignes[2].tauxCumule, "50", "le 3ᵉ remonte au cumul d'avant");
  assert.equal(e.lignes[2].montant, "0.00");
  assert.ok(Number(e.reste) >= 0, `reste négatif : ${e.reste}`);
});

cas("un 2ᵉ monté à 120 est ramené à 100 et emporte le 3ᵉ", () => {
  assert.deepEqual(
    tauxCumulesBornes([{ rang: 1, tauxCumule: "30" }, { rang: 2, tauxCumule: "120" }, { rang: 3, tauxCumule: "75" }]),
    ["30", "100", "100"]
  );
  const e = echeancierDevis([{ rang: 1, tauxCumule: "30" }, { rang: 2, tauxCumule: "120" }], TTC);
  assert.equal(e.reste, "0.00");
});

cas("la borne lit les rangs, pas l'ordre du tableau", () => {
  assert.deepEqual(tauxCumulesBornes([{ rang: 2, tauxCumule: "50" }, { rang: 1, tauxCumule: "30" }]), ["30", "50"]);
});

cas("un taux illisible n'est pas un taux ; « 7,5 » l'est ; 150 devient 100", () => {
  assert.equal(tauxCumuleValide("abc"), null);
  assert.equal(tauxCumuleValide(""), null);
  assert.equal(tauxCumuleValide("-5"), null);
  assert.equal(tauxCumuleValide("7,5"), "7.5");
  assert.equal(tauxCumuleValide("150"), "100");
});

// ── Ce qui naît avec le devis, et ce que « + Ajouter » propose ──────────────

cas("d'office : le taux des Réglages ; rien sans réglage, rien à 0", () => {
  assert.deepEqual(acompteDOffice("30.00"), { rang: 1, tauxCumule: "30" });
  assert.equal(acompteDOffice(null), null);
  assert.equal(acompteDOffice("0"), null);
});

cas("« + Ajouter un acompte » : 50 puis 75, cumulés — ses valeurs d'office", () => {
  const un = [{ rang: 1, tauxCumule: "30" }];
  assert.deepEqual(acompteSuivantPropose(un, "30"), { rang: 2, tauxCumule: "50" });
  const deux = [...un, { rang: 2, tauxCumule: "50" }];
  assert.deepEqual(acompteSuivantPropose(deux, "30"), { rang: 3, tauxCumule: "75" });
});

cas("le premier vient des Réglages quand il n'y en a aucun ; 30 sans réglage", () => {
  assert.deepEqual(acompteSuivantPropose([], "40"), { rang: 1, tauxCumule: "40" });
  assert.deepEqual(acompteSuivantPropose([], null), { rang: 1, tauxCumule: "30" });
});

cas("jamais sous le cumul d'avant : un 1er à 60 fait proposer 60, pas 50", () => {
  assert.deepEqual(acompteSuivantPropose([{ rang: 1, tauxCumule: "60" }], "60"), { rang: 2, tauxCumule: "60" });
});

cas("plus rien à proposer : trois acomptes, ou un devis déjà à 100 %", () => {
  assert.equal(ACOMPTES_MAX, 3);
  assert.equal(
    acompteSuivantPropose(
      [{ rang: 1, tauxCumule: "30" }, { rang: 2, tauxCumule: "50" }, { rang: 3, tauxCumule: "75" }],
      "30"
    ),
    null
  );
  assert.equal(acompteSuivantPropose([{ rang: 1, tauxCumule: "100" }], "30"), null);
});

// ── Les mots : sur l'écran, sur le papier, dans les notes ───────────────────

cas("la fin du chantier n'est pas un moment d'acompte", () => {
  assert.deepEqual([...MOMENTS_ACOMPTE], ["à la signature", "à mi-parcours", "à l'avancement"]);
});

cas("les libellés des totaux disent le cumul dès le deuxième", () => {
  const e = echeancierDevis([{ rang: 1, tauxCumule: "30" }, { rang: 2, tauxCumule: "50" }], TTC);
  assert.equal(libelleLigneAcompte(e.lignes[0]), "Acompte 30 % à la signature");
  assert.equal(libelleLigneAcompte(e.lignes[1]), "Acompte à mi-parcours 50 %");
});

cas("les phrases des notes : « , soit », jamais « — soit » (sa demande)", () => {
  const e = echeancierDevis([{ rang: 1, tauxCumule: "30" }, { rang: 2, tauxCumule: "50" }], TTC);
  const phrases = phrasesAcomptes(e);
  // Les euros s'écrivent par `enEuros` — l'espace avant « € » est la sienne.
  assert.equal(phrases[0], `Acompte de 30 % à la signature, soit ${enEuros("853.20")}.`);
  assert.equal(phrases[1], `Acompte à mi-parcours 50 %, soit ${enEuros("568.80")}.`);
  for (const p of phrases) assert.ok(!p.includes("—"), `un tiret dans « ${p} »`);
});

cas("les acomptes posés remplacent la phrase du réglage dans les notes", () => {
  const c = lireConditions({ acomptePourcent: "30" });
  const lignes = lignesConditionsDevis(c, 2844, ["Acompte de 40 % à la signature, soit 1 137,60 €."]);
  assert.equal(lignes.filter((l) => l.startsWith("Acompte")).length, 1);
  assert.ok(lignes[0].includes("40 %"), "c'est l'acompte POSÉ qui s'imprime, pas le réglage");
});

cas("ligne retirée : la phrase du réglage reste — « quoi qu'il arrive »", () => {
  const c = lireConditions({ acomptePourcent: "30" });
  const lignes = lignesConditionsDevis(c, 2844, []);
  assert.equal(lignes[0], "Acompte de 30 % à la commande, soit 853,20 €.");
});

console.log("");
if (echecs) {
  console.log(`${echecs} ÉCHEC(S).`);
  process.exit(1);
}
console.log("Tout est au vert.");
