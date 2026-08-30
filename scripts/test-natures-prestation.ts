import assert from "node:assert/strict";
import {
  NATURES,
  caracteristiqueDeLaQuantite,
  nature,
  natureDuLibelle,
  naturesDuLibelle,
  normaliserUnite,
} from "../src/lib/natures-prestation";

// **Le référentiel des natures, et surtout ses BORDS.**
//
// Ce qui compte ici n'est pas qu'il reconnaisse un abattage — c'est :
//   * qu'il reconnaisse la TONTE, absente des six vocabulaires d'avant, et
//     dont l'absence a produit le devis du 26 août 2026 ;
//   * qu'il rende `null` sur ce qu'il ne connaît pas, au lieu du premier motif
//     qui répond de loin ;
//   * qu'il ne traduise une quantité en mesure que lorsque l'unité concorde.

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

console.log("\n=== Ce que le référentiel sait nommer ===\n");

cas("la tonte est une nature à part entière", () => {
  assert.equal(natureDuLibelle("Tonte de la pelouse (1200 m²)"), "tonte");
  assert.equal(nature("tonte")?.chiffrage, "aucune", "identifiée n'est pas chiffrable — les deux ne se confondent pas");
});

cas("les natures d'avant sont toutes conservées", () => {
  const attendu: [string, string][] = [
    ["Érable — démontage en rétention", "abattage"],
    ["Abattage d'un chêne mort", "abattage"],
    ["Taille de haie de laurier", "haie"],
    ["Taille du tilleul", "elagage"],
    ["Dessouchage de deux souches", "dessouchage"],
    ["Fendage du bois", "fendage"],
    ["Enlèvement des grumes", "grumes"],
    ["Broyage des branches", "broyage"],
    ["Évacuation des déchets", "evacuation"],
    ["Coupe en 50 cm", "billonnage"],
  ];
  for (const [libelle, cle] of attendu) {
    assert.equal(natureDuLibelle(libelle), cle, `« ${libelle} » devrait être ${cle}`);
  }
});

cas("une taille de haie n'est jamais un élagage", () => {
  // L'ordre de la liste est ce qui le garantit : la haie passe avant l'élagage.
  assert.equal(natureDuLibelle("Taille de haie de laurier (800 ml)"), "haie");
});

cas("un dessouchage annoncé avec des grumes reste un dessouchage", () => {
  assert.equal(natureDuLibelle("Enlèvement des grumes et dessouchage"), "dessouchage");
});

cas("ce que le produit ne connaît pas reste inconnu", () => {
  // **Le cœur de la correction.** Avant, tout ce qui n'était pas reconnu
  // tombait dans `principal` — c'est-à-dire sur la ligne d'abattage.
  for (const inconnu of ["Désherbage des massifs", "Pose d'un bassin", "Divers", "Déplacement"]) {
    assert.equal(natureDuLibelle(inconnu), null, `« ${inconnu} » ne doit être rattaché à rien`);
  }
});

cas("un texte vide ne rattache rien", () => {
  assert.equal(natureDuLibelle("   "), null);
  assert.deepEqual(naturesDuLibelle(""), []);
});

console.log("\n=== Toutes les natures, pas seulement la première ===\n");

cas("une ligne qui porte deux travaux les montre tous les deux", () => {
  // C'est ce qui distingue « ça parle d'abattage » de « ça ne parle QUE
  // d'abattage » — la question à laquelle le garde-fou de l'apprentissage doit
  // répondre.
  const vues = naturesDuLibelle("Abattage d'un chêne et dessouchage de la souche");
  assert.ok(vues.includes("abattage") && vues.includes("dessouchage"), `vu : ${vues.join(", ")}`);
});

console.log("\n=== Chiffrage et identité ne se confondent pas ===\n");

cas("une nature identifiée peut n'avoir aucun moteur de prix", () => {
  assert.equal(nature("tonte")?.chiffrage, "aucune");
  assert.equal(nature("plantation")?.chiffrage, "aucune");
  assert.equal(nature("abattage")?.chiffrage, "grille");
});

cas("les accessoires sont exactement ceux de sa règle du 7 août", () => {
  const accessoires = NATURES.filter((n) => n.accessoire).map((n) => n.cle).sort();
  assert.deepEqual(accessoires, ["billonnage", "broyage", "evacuation"]);
});

cas("l'abattage n'est pas détachable, la fente l'est", () => {
  assert.equal(nature("abattage")?.detachable, false);
  assert.equal(nature("fendage")?.detachable, true);
  assert.equal(nature("dessouchage")?.detachable, true, "sa réponse du 8 août : « le dessouchage oui »");
  assert.equal(nature("grumes")?.detachable, true, "« et les grumes aussi »");
  assert.equal(nature("evacuation")?.detachable, false, "l'évacuation du menu bois reste avec l'abattage");
});

console.log("\n=== La quantité dictée devient une mesure — quand l'unité concorde ===\n");

cas("800 ml de haie SONT la longueur qui fait son prix", () => {
  assert.deepEqual(caracteristiqueDeLaQuantite("haie", "800.00", "ml"), { longueurMl: 800 });
});

cas("6 tonnes de grumes SONT le tonnage", () => {
  assert.deepEqual(caracteristiqueDeLaQuantite("grumes", "6", "tonne"), { tonnageT: 6 });
});

cas("une unité qui ne concorde pas ne traduit RIEN", () => {
  // 800 m² de haie n'est pas une longueur. Convertir serait inventer.
  assert.equal(caracteristiqueDeLaQuantite("haie", "800", "m²"), null);
  assert.equal(caracteristiqueDeLaQuantite("grumes", "6", "ml"), null);
});

cas("une nature inconnue ne traduit rien", () => {
  assert.equal(caracteristiqueDeLaQuantite(null, "800", "ml"), null);
  assert.equal(caracteristiqueDeLaQuantite("desherbage", "800", "ml"), null);
});

cas("une quantité aberrante ne traduit rien", () => {
  assert.equal(caracteristiqueDeLaQuantite("haie", "0", "ml"), null);
  assert.equal(caracteristiqueDeLaQuantite("haie", "-5", "ml"), null);
  assert.equal(caracteristiqueDeLaQuantite("haie", "environ", "ml"), null);
});

cas("la tonte se mesure sans que rien ne la chiffre", () => {
  // 1 200 m² est une donnée juste, et aucune grille ne s'en sert : la quantité
  // reste dans sa colonne, la ligne sort « à chiffrer ». Traduire vers une
  // caractéristique inventerait un chiffrage.
  assert.equal(nature("tonte")?.uniteDeMesure, "m²");
  assert.equal(caracteristiqueDeLaQuantite("tonte", "1200", "m²"), null);
});

console.log("\n=== Le mot du patron, quel qu'il soit ===\n");

cas("« mètre linéaire », « m.l. » et « ml » sont la même unité", () => {
  for (const dit of ["ml", "m.l.", "mètre linéaire", "mètres linéaires", "ML"]) {
    assert.equal(normaliserUnite(dit), "ml", `« ${dit} »`);
  }
});

cas("« tonnes » et « t » sont la même unité", () => {
  assert.equal(normaliserUnite("tonnes"), "tonne");
  assert.equal(normaliserUnite("t"), "tonne");
});

cas("une unité de comptage n'est pas transformée", () => {
  // « souche » et « arbre » ne se convertissent en rien : ce sont des objets
  // comptés, pas des mesures.
  assert.equal(normaliserUnite("souches"), "souche");
  assert.equal(normaliserUnite("arbre"), "arbre");
});

console.log(`\n${reussites} réussite(s), ${echecs} échec(s).`);
if (echecs > 0) process.exitCode = 1;
