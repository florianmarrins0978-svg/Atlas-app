import assert from "node:assert/strict";
import {
  UNITES_PROPOSEES,
  estUniteLibre,
  normaliserUnite,
  uniteProposee,
} from "../src/lib/unites-tarif";
import { chiffrerMainOeuvre } from "../src/lib/tarif-main-oeuvre";

// **« Crée-moi un bandeau déroulant avec infos à choisir, jours/hommes, m² etc. »**
// — le patron, le 13 août 2026.
//
// Ce que cette suite tient, et qui n'est pas l'ergonomie : **une unité proposée
// doit être une unité que le moteur de prix reconnaît.** Le rapprochement se
// fait sur le texte, à la lettre près ; une liste qui proposerait « jours/homme »
// au lieu de « jour/homme » serait pire que la case libre — elle donnerait au
// patron la certitude d'avoir bien choisi, pendant que son tarif de main
// d'œuvre cesserait d'être trouvé, en silence, sur un devis qui part chez son
// client.
//
// Et le contrôle qui protège l'essentiel : **la liste ne ferme rien.** Le stère,
// l'arbre, la tonne de grumes ne s'y trouvent pas et ne s'y trouveront jamais —
// ils doivent rester écrivables.

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

console.log("\n— La liste elle-même —");

cas("aucune unité proposée n'est vide ou mal détourée", () => {
  for (const u of UNITES_PROPOSEES) {
    assert.notEqual(u.valeur, "", "une unité vide se confondrait avec « aucune unité »");
    assert.equal(
      u.valeur,
      normaliserUnite(u.valeur),
      `« ${u.valeur} » porte un espace de bord : enregistrée telle quelle, elle ne serait plus jamais reconnue`
    );
  }
});

cas("aucun doublon dans la liste", () => {
  const vues = UNITES_PROPOSEES.map((u) => u.valeur);
  assert.equal(new Set(vues).size, vues.length, `deux fois la même unité : ${vues.join(", ")}`);
});

cas("les unités attendues par le patron y sont", () => {
  const vues = UNITES_PROPOSEES.map((u) => u.valeur);
  // Sa demande nommait « jours/hommes » et « m² » ; le reste vient de la
  // maquette qu'il a choisie.
  for (const attendue of ["jour/homme", "m²", "ml", "heure", "forfait", "tonne"]) {
    assert.ok(vues.includes(attendue), `« ${attendue} » a disparu du bandeau. Reste : ${vues.join(", ")}`);
  }
});

console.log("\n— Le lien avec le moteur de prix, à la lettre près —");

cas("« jour/homme » proposé EST celui que le chiffrage de la main d'œuvre reconnaît", () => {
  const mainOeuvre = UNITES_PROPOSEES.find((u) => u.quoi === "main d'œuvre");
  assert.ok(mainOeuvre, "plus aucune unité de main d'œuvre dans la liste");
  const chiffre = chiffrerMainOeuvre(
    [{ id: "t1", intitule: "Main d'œuvre", prix: "280.00", unite: mainOeuvre.valeur }],
    2,
    3
  );
  assert.ok(
    chiffre !== null,
    `« ${mainOeuvre.valeur} » n'est pas reconnu comme un tarif de main d'œuvre : le prix ne viendrait plus de sa grille, mais de ses paramètres de chiffrage — deux chiffres qui n'ont rien à voir.`
  );
  assert.equal(chiffre.montant, "1680.00", "2 jours × 3 hommes × 280 € ne tombe plus juste");
});

cas("une unité de surface ne devient jamais de la main d'œuvre", () => {
  // Le pendant du contrôle précédent : ajouter « jour » à la liste ferait
  // silencieusement de tout tarif à la journée un prix d'équipe.
  const chiffre = chiffrerMainOeuvre([{ id: "t1", intitule: "Dépose", prix: "18.00", unite: "m²" }], 2, 3);
  assert.equal(chiffre, null, "un prix au mètre carré s'est fait multiplier par des journées");
});

console.log("\n— Reconnaître ce qui est enregistré —");

cas("une unité de la liste est retrouvée, espaces de bord compris", () => {
  assert.equal(uniteProposee("m²")?.valeur, "m²");
  assert.equal(uniteProposee("  jour/homme ")?.valeur, "jour/homme");
});

cas("« m2 » n'est PAS confondu avec « m² »", () => {
  // C'est tout l'enjeu : le moteur de prix ne les confond pas non plus. Les
  // rapprocher à l'écran laisserait croire que le tarif est reconnu.
  assert.equal(uniteProposee("m2"), null);
  assert.equal(uniteProposee("M²"), null);
});

cas("l'absence d'unité n'est pas un choix de la liste", () => {
  assert.equal(uniteProposee(null), null);
  assert.equal(uniteProposee(""), null);
  assert.equal(uniteProposee("   "), null);
});

console.log("\n— La liberté qui reste —");

cas("le stère, l'arbre et la tonne de grumes restent des unités écrivables", () => {
  for (const sienne of ["stère", "arbre", "forfait déplacement", "botte"]) {
    assert.ok(
      estUniteLibre(sienne),
      `« ${sienne} » n'est plus reconnue comme une unité à lui : la liste s'est refermée`
    );
  }
});

cas("une unité vide n'est pas une unité libre", () => {
  assert.equal(estUniteLibre(""), false);
  assert.equal(estUniteLibre(null), false);
  assert.equal(estUniteLibre("  "), false);
});

cas("une unité de la liste n'est pas comptée comme libre", () => {
  assert.equal(estUniteLibre("m²"), false);
});

console.log(`\n${echecs === 0 ? "✅ Toutes les vérifications passent." : `❌ ${echecs} échec(s).`}`);
process.exit(echecs === 0 ? 0 : 1);
