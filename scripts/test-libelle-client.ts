import assert from "node:assert/strict";
import { libelleClient } from "../src/lib/libelle-client";
import { lignesVendables } from "../src/lib/lignes-vendables";

// **LES QUATRE LIGNES QU'IL A LUES SUR SON VRAI DEVIS, le 30 août 2026.**
//
// Elles sont recopiées ici à la lettre — espace insécable compris, parce que
// c'est lui qui trahit la double écriture :
//
//   Haie de laurier (800 ml) (800 ml)                Qté 800
//   Érable (40 cm de diamètre, 12 m de haut)         Qté 1
//   Dessouchage — deux souches de 60 cm (2 souche)   Qté 2
//   Tonte de la pelouse (1 200 m²) (1200 m²)         Qté 1200
//
// Ce que cette suite défend, et qu'aucune autre ne défendait : les mesures
// vivent dans les colonnes, et le client ne les relit pas dans le texte.
//
// **Le contrôle qui compte le plus n'est pas le nettoyage, c'est le REFUS de
// nettoyer** : « Érable — démontage en rétention » doit garder sa méthode, et
// une prestation d'avant, sans colonnes, doit garder son texte entier.

let reussites = 0;
let echecs = 0;
function cas(nom: string, verifier: () => void): void {
  try {
    verifier();
    console.log(`  ✓ ${nom}`);
    reussites++;
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

console.log("\n=== Ses quatre lignes du 30 août 2026 ===\n");

cas("la haie : « Haie de laurier (800 ml) (800 ml) » → « Haie de laurier »", () => {
  assert.equal(
    libelleClient({
      libelle: "Haie de laurier (800 ml) (800 ml)",
      quantite: "800.00",
      unite: "ml",
      caracteristiques: { longueurMl: 800 },
    }),
    "Haie de laurier"
  );
});

cas("l'érable : « Érable (40 cm de diamètre, 12 m de haut) » → « Érable »", () => {
  assert.equal(
    libelleClient({
      libelle: "Érable (40 cm de diamètre, 12 m de haut)",
      quantite: null,
      unite: null,
      caracteristiques: { diametreCm: 40, hauteurM: 12 },
    }),
    "Érable"
  );
});

cas("le dessouchage : « Dessouchage — deux souches de 60 cm (2 souche) » → « Dessouchage »", () => {
  assert.equal(
    libelleClient({
      libelle: "Dessouchage — deux souches de 60 cm (2 souche)",
      quantite: "2.00",
      unite: "souche",
      caracteristiques: { diametreCm: 60 },
    }),
    "Dessouchage"
  );
});

cas("la tonte : « Tonte de la pelouse (1 200 m²) (1200 m²) » → « Tonte de la pelouse »", () => {
  // L'espace insécable du premier groupe est celui du modèle ; le second sort
  // d'une colonne. Les deux doivent partir.
  assert.equal(
    libelleClient({
      libelle: "Tonte de la pelouse (1 200 m²) (1200 m²)",
      quantite: "1200.00",
      unite: "m²",
      caracteristiques: {},
    }),
    "Tonte de la pelouse"
  );
});

console.log("\n=== Ce qu'on REFUSE de retirer — le contrôle qui compte ===\n");

cas("une méthode n'est pas une mesure : « démontage en rétention » reste", () => {
  assert.equal(
    libelleClient({
      libelle: "Érable — démontage en rétention",
      quantite: null,
      unite: null,
      caracteristiques: { diametreCm: 40, hauteurM: 12 },
    }),
    "Érable — démontage en rétention"
  );
});

cas("la méthode survit même quand la parenthèse de mesure part", () => {
  assert.equal(
    libelleClient({
      libelle: "Érable — démontage en rétention (40 cm de diamètre)",
      quantite: null,
      unite: null,
      caracteristiques: { diametreCm: 40 },
    }),
    "Érable — démontage en rétention"
  );
});

cas("une mesure que les colonnes NE portent PAS reste écrite", () => {
  // 800 n'est nulle part en colonne : l'effacer perdrait la seule trace de la
  // longueur, et le client lirait « Haie de laurier » sans savoir combien.
  assert.equal(
    libelleClient({ libelle: "Haie de laurier (800 ml)", quantite: null, unite: null }),
    "Haie de laurier (800 ml)"
  );
});

cas("une valeur DIFFÉRENTE de la colonne n'est pas retirée", () => {
  // La colonne dit 80, le texte dit 800 : les deux se contredisent, et ce
  // n'est pas à l'affichage de trancher — `mesures-prestation.ts` le fait, et
  // il refuse. Effacer le texte ferait disparaître la contradiction sans la
  // résoudre.
  assert.equal(
    libelleClient({
      libelle: "Haie de laurier (800 ml)",
      quantite: "80.00",
      unite: "ml",
      caracteristiques: { longueurMl: 80 },
    }),
    "Haie de laurier (800 ml)"
  );
});

console.log("\n=== La compatibilité : rien d'ancien n'est réinterprété ===\n");

cas("une prestation d'avant, sans aucune colonne, garde son texte entier", () => {
  for (const ancien of [
    "Abattage d'un chêne — ⌀ 45 cm, 18 m de haut",
    "Haie (tout genre) (800 ml)",
    "Élagage du tilleul",
  ]) {
    assert.equal(
      libelleClient({ libelle: ancien }),
      ancien,
      `« ${ancien} » ne doit pas bouger sans colonnes`
    );
  }
});

cas("un libellé qui ne dirait QUE sa mesure n'est jamais vidé", () => {
  // Le client doit lire quelque chose : mieux vaut « (800 ml) » qu'une ligne
  // sans nom sur un devis.
  assert.equal(
    libelleClient({ libelle: "(800 ml)", quantite: "800.00", unite: "ml" }),
    "(800 ml)"
  );
});

cas("un libellé vide reste vide, sans planter", () => {
  assert.equal(libelleClient({ libelle: "   ", quantite: "800.00", unite: "ml" }), "");
});

console.log("\n=== Sur la ligne de devis : le client lit propre, le moteur lit brut ===\n");

cas("la ligne vendable nettoie son libellé et GARDE ses membres bruts", () => {
  // **C'est l'invariant qui protège le prix.** `mesuresResolues` relit
  // `membres` quand les colonnes ne suffisent pas ; les nettoyer ferait perdre
  // à la haie sa longueur, donc son prix au mètre linéaire.
  const { lignes } = lignesVendables([
    {
      id: "p1",
      libelle: "Haie de laurier (800 ml) (800 ml)",
      nature: "haie",
      quantite: "800.00",
      unite: "ml",
      caracteristiques: { longueurMl: 800 },
    },
  ]);
  assert.equal(lignes.length, 1);
  assert.equal(lignes[0].libelle, "Haie de laurier", "ce que le client lit");
  assert.equal(
    lignes[0].membres[0],
    "Haie de laurier (800 ml) (800 ml)",
    "ce que les moteurs relisent — INTACT"
  );
});

cas("deux prestations réunies : une par ligne, chacune nettoyée", () => {
  const { lignes } = lignesVendables([
    {
      id: "p1",
      libelle: "Érable (40 cm de diamètre, 12 m de haut)",
      nature: "abattage",
      caracteristiques: { diametreCm: 40, hauteurM: 12 },
    },
    { id: "p2", libelle: "Évacuation des déchets verts", nature: "evacuation" },
  ]);
  const principale = lignes.find((l) => l.cle === "abattage");
  assert.ok(principale, "la ligne d'abattage doit exister");
  assert.equal(principale.libelle, "Érable\nÉvacuation des déchets verts");
});

cas("le regroupement ne change pas — le nettoyage ne touche QUE le texte", () => {
  // La nature vient des colonnes ; nettoyer le libellé ne doit pas déplacer une
  // prestation d'une ligne à l'autre.
  const { lignes } = lignesVendables([
    { id: "p1", libelle: "Érable (40 cm de diamètre)", nature: "abattage", caracteristiques: { diametreCm: 40 } },
    { id: "p2", libelle: "Tonte de la pelouse (1200 m²)", nature: "tonte", quantite: "1200.00", unite: "m²" },
  ]);
  assert.equal(lignes.length, 2, "la tonte ne rejoint pas l'abattage");
  const tonte = lignes.find((l) => l.cle === "tonte");
  assert.equal(tonte?.libelle, "Tonte de la pelouse");
});

console.log(`\n${reussites} réussite(s), ${echecs} échec(s).`);
if (echecs > 0) process.exitCode = 1;
