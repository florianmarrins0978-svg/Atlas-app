import assert from "node:assert/strict";
import { lignesVendables, repartir } from "../src/lib/lignes-vendables";

// **Le défaut le plus répété de ce projet, enfin tenu par un contrôle.**
//
// Le patron, le 7 août 2026 : *« l'agent ne comprend toujours pas qu'il faut
// séparer les tâches. Tout ce que je dicte arrive sur la même ligne du devis. »*
// Puis, comme on lui répondait par une explication : *« on avait déjà travaillé
// sur ce défaut-là hier et je croyais que tu l'avais corrigé. »* Il avait
// raison : le défaut avait été DIAGNOSTIQUÉ et non réparé.
//
// Puis, très précisément : *« l'abattage, le broyage et l'évacuation, c'est sur
// une ligne, et la fente, ça doit être séparé. »* Et le lendemain : *« à chaque
// fois qu'il sépare les tâches, il met un point-virgule. Il faut le retirer. »*
//
// Ce que cette suite tient, et qu'aucun test vert ne tenait avant elle :
//
//   1. la fente fait sa propre ligne ;
//   2. l'abattage, le broyage et l'évacuation n'en font qu'une ;
//   3. **aucun point-virgule**, nulle part ;
//   4. le billonnage ne crée pas de quatrième ligne ;
//   5. la répartition charge la ligne détachable au lieu de la brader.

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

/** Ce qu'il a dicté le 7 août 2026, tel qu'un modèle le lit. */
const DICTEE = [
  "Abattage d'un chêne mort",
  "Broyage des branches",
  "Évacuation du gros bois",
  "Coupe en 50 cm",
  "Fendage du bois",
];

console.log("=== Séparer ce qui se vend seul, réunir le reste ===\n");

cas("la fente est sur sa propre ligne", () => {
  const { lignes } = lignesVendables(DICTEE);
  const fente = lignes.find((l) => /fend/i.test(l.libelle));
  assert.ok(fente, `aucune ligne de fente : ${lignes.map((l) => l.libelle).join(" | ")}`);
  assert.equal(fente.membres.length, 1, "la fente a été réunie à autre chose");
  assert.equal(fente.detachable, true);
});

cas("l'abattage, le broyage et l'évacuation n'en font qu'une", () => {
  const { lignes } = lignesVendables(DICTEE);
  const principale = lignes.find((l) => !l.detachable);
  assert.ok(principale, "aucune ligne principale");
  assert.deepEqual(principale.membres, [
    "Abattage d'un chêne mort",
    "Broyage des branches",
    "Évacuation du gros bois",
  ]);
});

cas("le devis compte DEUX lignes, pas cinq et pas une", () => {
  // Cinq, c'était le réflexe de départ : une par verbe dicté. Une, c'était le
  // défaut qu'il a signalé trois fois. Deux, c'est ce qu'il a demandé.
  const { lignes } = lignesVendables(DICTEE);
  assert.equal(lignes.length, 2, `${lignes.length} ligne(s) : ${lignes.map((l) => l.libelle).join(" | ")}`);
});

cas("AUCUN point-virgule, nulle part", () => {
  // Sa demande du 8 août. Le contrôle porte sur toutes les lignes et non sur la
  // seule principale : c'est en séparant qu'on est tenté d'en remettre un.
  for (const ligne of lignesVendables(DICTEE).lignes) {
    assert.doesNotMatch(ligne.libelle, /;/, `« ${ligne.libelle} » porte encore un point-virgule`);
  }
});

cas("les travaux réunis s'empilent, un par ligne", () => {
  // Un point-virgule fait une phrase, et une phrase se lit comme UNE prestation.
  // Empilés, les travaux se comptent d'un coup d'œil sur le devis du client.
  const principale = lignesVendables(DICTEE).lignes.find((l) => !l.detachable)!;
  assert.equal(
    principale.libelle,
    "Abattage d'un chêne mort\nBroyage des branches\nÉvacuation du gros bois"
  );
});

console.log("\n=== Le billonnage ne fait pas de quatrième ligne ===");

cas("« coupe en 50 » disparaît quand un abattage l'accompagne", () => {
  // `docs/EXEMPLE-DICTEE.md`, 5 août 2026 : « le devis compte trois lignes, pas
  // quatre : le billonnage est compris dans l'abattage ».
  const { lignes, absorbes } = lignesVendables(DICTEE);
  const texte = lignes.map((l) => l.libelle).join(" ");
  assert.doesNotMatch(texte, /coupe en 50/i, "le billonnage a fait sa propre ligne");
  assert.deepEqual(absorbes, ["Coupe en 50 cm"]);
});

cas("mais il reste quand il EST le chantier", () => {
  // Sans abattage dicté, billonner du bois déjà à terre est un vrai travail.
  // Le faire disparaître effacerait la seule prestation de la dictée — et le
  // patron se retrouverait avec un devis vide, le défaut du 7 août.
  const { lignes, absorbes } = lignesVendables(["Billonnage en 50 cm du bois au sol"]);
  assert.equal(lignes.length, 1, "le seul travail dicté a disparu");
  assert.deepEqual(absorbes, []);
});

cas("ce qui est absorbé est SIGNALÉ, jamais escamoté", () => {
  // Une prestation qui disparaît sans un mot, c'est exactement ce qui lui a
  // fait perdre « on le coupe en 50, on le fend » sur son devis.
  assert.deepEqual(lignesVendables(DICTEE).absorbes, ["Coupe en 50 cm"]);
});

console.log("\n=== Les cas où il n'y a rien à séparer ===");

cas("une fente seule n'est pas « détachable » : elle EST le chantier", () => {
  const { lignes } = lignesVendables(["Fendage du bois de chauffage"]);
  assert.equal(lignes.length, 1);
  assert.equal(lignes[0].detachable, false, "on proposerait d'alléger une ligne principale qui n'existe pas");
});

cas("une dictée vide ne produit rien", () => {
  assert.deepEqual(lignesVendables([]), { lignes: [], absorbes: [] });
  assert.deepEqual(lignesVendables(["", "   "]), { lignes: [], absorbes: [] });
});

console.log("\n=== La haie fait sa ligne, depuis le 8 août ===");

// **Sa réponse du 8 août au soir**, à la question « la taille de haie doit-elle
// avoir sa propre ligne ? » : *« grille au mètre linéaire »*. Son devis de
// référence du 5 août en comptait bien trois — haie 350 €, abattage 600 €,
// fendage 300 € — quand l'application n'en produisait que deux.
//
// Ce qui a débloqué la haie, c'est un PRIX, pas une envie : tant qu'elle n'avait
// pas de grille, la séparer aurait exigé d'inventer deux montants.

const DICTEE_COMPLETE = [
  "Taille de haie de laurier",
  "Abattage d'un chêne mort",
  "Broyage des branches",
  "Coupe en 50 cm",
  "Fendage du bois",
];

cas("son devis du 5 août compte bien TROIS lignes", () => {
  const { lignes } = lignesVendables(DICTEE_COMPLETE);
  assert.equal(
    lignes.length,
    3,
    `${lignes.length} ligne(s) : ${lignes.map((l) => l.libelle).join(" | ")}`
  );
  assert.deepEqual(lignes.map((l) => l.cle), ["principal", "haie", "fendage"]);
});

cas("la haie ne se mélange pas avec l'arbre", () => {
  const { lignes } = lignesVendables(DICTEE_COMPLETE);
  const haie = lignes.find((l) => l.cle === "haie")!;
  assert.deepEqual(haie.membres, ["Taille de haie de laurier"]);
  assert.equal(haie.detachable, true, "un client peut commander sa haie seule");
  const principale = lignes.find((l) => l.cle === "principal")!;
  assert.ok(!/haie/i.test(principale.libelle), "la haie est restée collée au chêne");
});

cas("une haie seule EST le chantier, pas une option", () => {
  const { lignes } = lignesVendables(["Taille de haie de laurier, 20 ml"]);
  assert.equal(lignes.length, 1);
  assert.equal(lignes[0].detachable, false, "on proposerait d'alléger une ligne principale qui n'existe pas");
});

console.log("\n=== La répartition : charger les lignes détachables ===");

// Son explication, mot pour mot : *« s'il met le prix de deux hommes-jour plus
// le broyeur sur la même ligne, donc 800 + 200, et la fente sur une seule ligne
// à 100, le client qui ne veut pas la fente va trouver ça cher ; et s'il fait
// faire le reste par un autre artisan et qu'il nous prend juste pour la fente,
// 100 € ce n'est pas assez cher. »*
//
// L'ordre des montants suit celui des lignes vendables : principale, haie,
// fente. `null` veut dire « pas de prix dans sa grille » — la ligne reste à
// zéro, on ne devine pas.

cas("le total ne bouge pas, la répartition oui", () => {
  const r = repartir("1100.00", [null, "250.00"], 0);
  assert.ok(r);
  assert.deepEqual(r.montants, ["850", "250.00"]);
  assert.equal(r.montants.reduce((s, m) => s + Number(m), 0), 1100);
});

cas("deux lignes détachables prennent chacune SON prix de grille", () => {
  // Le cas de son devis du 5 août : la haie ET la fente, chacune sa grille.
  const r = repartir("1250.00", [null, "350.00", "300.00"], 0);
  assert.ok(r);
  assert.deepEqual(r.montants, ["600", "350.00", "300.00"]);
});

cas("le montant d'une détachable vient de la grille, pas d'un pourcentage", () => {
  // Deux totaux différents, la même fente : c'est SON prix, pas une part.
  assert.equal(repartir("1100.00", [null, "250.00"], 0)!.montants[1], "250.00");
  assert.equal(repartir("2000.00", [null, "250.00"], 0)!.montants[1], "250.00");
});

cas("une ligne sans prix de grille reste à zéro", () => {
  // On ne devine pas : la ligne s'écrit à 0 €, visible comme un prix à poser.
  const r = repartir("1100.00", [null, null], 0);
  assert.ok(r);
  assert.deepEqual(r.montants, ["1100", "0"]);
});

cas("une détachable qui vaut le chantier entier ne se répartit pas", () => {
  // Elle laisserait une ligne principale à zéro, ou négative — un devis que le
  // patron enverrait sans le voir.
  assert.equal(repartir("250.00", [null, "250.00"], 0), null);
  assert.equal(repartir("200.00", [null, "250.00"], 0), null);
});

cas("l'écart d'arrondi est DIT, jamais tu", () => {
  // « 350, 400, 420, 560 » : la règle des prix ronds l'emporte sur l'exactitude
  // à l'euro. Mais un total qui bouge sans explication est le défaut qu'on
  // répare, pas un détail de présentation.
  const r = repartir("1104.00", [null, "250.00"], 0)!;
  assert.equal(r.montants[0], "850");
  assert.match(r.detail, /arrondi/i, `l'écart n'est pas expliqué : « ${r.detail} »`);
  assert.match(r.detail, /1104\.00/, "le total d'avant n'est pas rappelé");
});

cas("un montant illisible ne produit pas de répartition fantaisiste", () => {
  assert.equal(repartir("beaucoup", [null, "250.00"], 0), null);
  assert.equal(repartir("1100.00", [null, "cher"], 0)!.montants[1], "0");
  assert.equal(repartir("1100.00", [null, "250.00"], 9), null);
});

console.log(`\n${echecs === 0 ? "✅ Toutes les vérifications passent." : `❌ ${echecs} échec(s).`}`);
process.exit(echecs === 0 ? 0 : 1);
