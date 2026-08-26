import assert from "node:assert/strict";
import { mesuresResolues, reserveDeContradiction } from "../src/lib/mesures-prestation";
import { lireCaracteristiques } from "../src/lib/prestation-structuree";

// **Deux sources pour la même mesure — et le contrat qui dit laquelle vaut.**
//
// Depuis le lot B, une prestation neuve porte ses mesures dans des colonnes ET
// dans son libellé. C'est voulu le temps de la transition. Ce module tient les
// trois promesses qui rendent cette cohabitation sûre :
//
//   1. **une mesure structurée donne EXACTEMENT le même résultat** que l'ancien
//      libellé — sans quoi la migration changerait des prix en silence ;
//   2. **une ancienne prestation, sans structure, continue de fonctionner** ;
//   3. **une contradiction ne se tranche jamais toute seule.**
//
// La troisième porte l'essentiel du risque. Le seul cas où les deux divergent,
// c'est un libellé retouché à la main : le patron corrige « (800 ml) » en
// « (80 ml) » et les colonnes, elles, restent sur 800. Faire gagner la structure
// ignorerait sa correction ; faire gagner le texte rendrait les colonnes
// décoratives. Les deux sont des arbitrages silencieux sur un chiffre qui part
// chez un client.

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

console.log("\n=== La structure donne le MÊME résultat que l'ancien libellé ===\n");

cas("800 ml structurés = « (800 ml) » dans le libellé", () => {
  const parLaStructure = mesuresResolues([{ longueurMl: 800 }], ["Haie (tout genre)"]);
  const parLeTexte = mesuresResolues([], ["Haie (tout genre) (800 ml)"]);
  assert.equal(parLaStructure.longueurMl.valeur, 800);
  assert.equal(parLeTexte.longueurMl.valeur, 800);
  assert.equal(parLaStructure.longueurMl.origine, "structure");
  assert.equal(parLeTexte.longueurMl.origine, "libelle");
});

cas("⌀ 45 cm structuré = « ⌀ 45 cm » dans le libellé", () => {
  assert.equal(mesuresResolues([{ diametreCm: 45 }], []).diametreCm.valeur, 45);
  assert.equal(mesuresResolues([], ["Érable — démontage, ⌀ 45 cm"]).diametreCm.valeur, 45);
});

cas("12 m de haut structurés = « 12 m de haut » dans le libellé", () => {
  assert.equal(mesuresResolues([{ hauteurM: 12 }], []).hauteurM.valeur, 12);
  assert.equal(mesuresResolues([], ["un chêne de 12 m de haut"]).hauteurM.valeur, 12);
});

cas("6 tonnes structurées = « 6 tonnes » dans le libellé", () => {
  assert.equal(mesuresResolues([{ tonnageT: 6 }], []).tonnageT.valeur, 6);
  assert.equal(mesuresResolues([], ["Enlèvement des grumes, 6 tonnes"]).tonnageT.valeur, 6);
});

cas("les deux d'accord : aucune réserve, et la structure est citée", () => {
  // Le cas ORDINAIRE d'une prestation neuve : les colonnes et le libellé
  // viennent du même JSON, ils disent donc la même chose. Rien ne doit changer.
  const m = mesuresResolues([{ longueurMl: 800 }], ["Haie (tout genre) (800 ml)"]);
  assert.equal(m.longueurMl.valeur, 800);
  assert.equal(m.longueurMl.origine, "structure");
  assert.equal(reserveDeContradiction("la haie", m.longueurMl), null);
});

cas("l'écriture décimale de la colonne ne crée pas une fausse contradiction", () => {
  // La colonne est un numeric(10,2) : 45 y devient 45.00. Sans tolérance,
  // chaque prestation neuve se contredirait elle-même et le chiffrage
  // s'arrêterait partout.
  const m = mesuresResolues([{ diametreCm: 45.0 }], ["⌀ 45 cm"]);
  assert.equal(m.diametreCm.origine, "structure");
  assert.equal(m.diametreCm.valeur, 45);
});

console.log("\n=== Une ancienne prestation continue de fonctionner ===\n");

cas("sans aucune structure, le libellé fait foi comme avant", () => {
  const m = mesuresResolues([], ["Abattage d'un chêne — démontage, ⌀ 70 cm"]);
  assert.equal(m.diametreCm.valeur, 70);
  assert.equal(m.diametreCm.origine, "libelle");
});

cas("des caractéristiques nulles ne cassent rien", () => {
  // Toutes les anciennes lignes ont `caracteristiques = NULL`.
  const m = mesuresResolues([null, undefined], ["⌀ 70 cm"]);
  assert.equal(m.diametreCm.valeur, 70);
});

console.log("\n=== Une contradiction ne se tranche jamais toute seule ===\n");

cas("structure 800, libellé 80 : aucune valeur n'est retenue", () => {
  const m = mesuresResolues([{ longueurMl: 800 }], ["Haie (tout genre) (80 ml)"]);
  assert.equal(m.longueurMl.valeur, null, "une des deux valeurs a été choisie en silence");
  assert.equal(m.longueurMl.origine, "contradiction");
});

cas("la réserve nomme LES DEUX valeurs, pour qu'il sache laquelle corriger", () => {
  const m = mesuresResolues([{ diametreCm: 45 }], ["⌀ 70 cm"]);
  const reserve = reserveDeContradiction("le diamètre du tronc", m.diametreCm);
  assert.ok(reserve, "aucune réserve produite");
  assert.match(reserve, /45/);
  assert.match(reserve, /70/);
  assert.match(reserve, /diamètre du tronc/);
});

cas("une contradiction sur une mesure n'empoisonne pas les autres", () => {
  const m = mesuresResolues([{ diametreCm: 45, hauteurM: 12 }], ["⌀ 70 cm, 12 m de haut"]);
  assert.equal(m.diametreCm.origine, "contradiction");
  assert.equal(m.hauteurM.valeur, 12, "la hauteur, elle, était d'accord");
});

console.log("\n=== Aucune source fiable : refus, jamais invention ===\n");

cas("ni structure ni libellé : la mesure reste inconnue", () => {
  const m = mesuresResolues([], ["Abattage d'un érable"]);
  for (const cle of ["diametreCm", "hauteurM", "longueurMl", "tonnageT"] as const) {
    assert.equal(m[cle].valeur, null, `${cle} a été inventé`);
    assert.equal(m[cle].origine, "aucune");
  }
});

console.log("\n=== Le JSONB n'accepte pas n'importe quoi ===\n");

cas("une clé inconnue est ignorée, jamais convertie", () => {
  assert.deepEqual(lireCaracteristiques({ largeurCm: 40, diametreCm: 45 }), { diametreCm: 45 });
});

cas("zéro, négatif et illisible ne sont pas des mesures", () => {
  assert.deepEqual(lireCaracteristiques({ diametreCm: 0, hauteurM: -3, tonnageT: "beaucoup" }), {});
});

cas("ce qui n'est pas un objet rend un objet vide", () => {
  for (const brut of [null, undefined, [1, 2], "45", 45]) {
    assert.deepEqual(lireCaracteristiques(brut), {}, `${JSON.stringify(brut)} a produit une mesure`);
  }
});

console.log(`\n${reussites} réussite(s), ${echecs} échec(s).`);
if (echecs > 0) process.exitCode = 1;
