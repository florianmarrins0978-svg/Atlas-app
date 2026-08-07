import assert from "node:assert/strict";
import { chiffrerMainOeuvre } from "../src/lib/tarif-main-oeuvre";
import { arrondirALaDizaine } from "../src/lib/arrondi-prix";

// **« À quoi correspond ce prix ? »** — le patron, le 7 août 2026, devant
// 858,00 € sur son devis, après avoir dicté « deux hommes, camion broyeur et
// fendeuse, une journée ». Et : « il n'est pas allé chercher dans la grille de
// prix, ça ne correspond pas du tout ».
//
// Il avait raison deux fois.
//
//   1. **La grille était ignorée.** Le rapprochement tarifaire se fait par le
//      TEXTE : « Main d'œuvre (jour/homme) » ne se retrouve dans aucun libellé
//      de prestation (« Abattage d'un cèdre mort »), donc aucun tarif n'était
//      retenu. L'application basculait sur ses paramètres de chiffrage — un
//      coût interne majoré d'une marge. Ce que le travail COÛTE, pas ce qu'il
//      se VEND.
//   2. **Rien n'arrondissait.** La règle existait, écrite avec sa phrase du
//      5 août (« en HT on fait des prix ronds : 350, 400, 420, 560 »), et
//      n'était appelée nulle part dans le chiffrage.
//
// Ce que cette suite tient : un tarif au jour se reconnaît à son UNITÉ, pas à
// son intitulé — et il ne se déclenche jamais sur une donnée manquante.

let echecs = 0;
function cas(nom: string, verifier: () => void) {
  try {
    verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

/** La grille réelle du patron, telle qu'elle figure sur son écran Réglages. */
const GRILLE = [
  { id: "t1", intitule: "Main d'œuvre (jour/homme)", prix: "400.00", unite: "jour/homme" },
  { id: "t2", intitule: "Dépose carrelage", prix: "18.00", unite: "m²" },
  { id: "t3", intitule: "Forfait déplacement", prix: "35.00", unite: null },
];

console.log("=== Le cas exact du 7 août : deux hommes, une journée ===");

cas("la grille est appliquée, et le résultat est celui que le patron attend", () => {
  const r = chiffrerMainOeuvre(GRILLE, 1, 2);
  assert.ok(r, "Aucun prix depuis la grille : on retomberait sur les paramètres de chiffrage, et sur les 858 € qu'il conteste.");
  assert.equal(r.montant, "800.00", `2 hommes × 1 jour × 400 € doit faire 800 €, pas ${r.montant}.`);
  assert.equal(r.tarifId, "t1", "Le mauvais tarif a été retenu.");
  assert.match(r.detail, /votre tarif/i, "L'explication ne dit pas que le prix vient de SA grille — c'est précisément sa question.");
});

cas("le prix affiché est rond", () => {
  // Sa règle du 5 août, jamais appliquée jusqu'ici dans le chiffrage.
  assert.equal(arrondirALaDizaine("858.00"), "860");
  assert.equal(arrondirALaDizaine("835.00"), "840");
  assert.equal(arrondirALaDizaine("800.00"), "800", "Un prix déjà rond ne doit pas bouger.");
});

console.log("\n=== Un tarif se reconnaît à son unité, jamais à son intitulé ===");

cas("un tarif au m² n'est jamais multiplié par des journées", () => {
  // Le pire défaut possible ici : 18 €/m² × 1 jour × 2 hommes = 36 €, un prix
  // qui a l'air d'un prix et ne veut rien dire.
  const r = chiffrerMainOeuvre([{ id: "x", intitule: "Dépose carrelage", prix: "18.00", unite: "m²" }], 1, 2);
  assert.equal(r, null, "Un tarif au mètre carré a été pris pour de la main d'œuvre.");
});

cas("les écritures courantes de l'unité sont reconnues", () => {
  for (const unite of ["jour/homme", "Jour / Homme", "jour homme", "j/h", "journée/homme", "HOMME/JOUR"]) {
    const r = chiffrerMainOeuvre([{ id: "u", intitule: "Main d'œuvre", prix: "400.00", unite }], 1, 2);
    assert.ok(r, `« ${unite} » n'est pas reconnu comme un prix de main d'œuvre.`);
    assert.equal(r.montant, "800.00");
  }
});

cas("un tarif à la journée seule ne se multiplie pas par l'équipe", () => {
  // Décider que « 500 €/jour » vaut par homme serait prendre une décision de
  // prix à la place du patron — et doubler sa facture sans le lui dire.
  const r = chiffrerMainOeuvre([{ id: "j", intitule: "Journée d'intervention", prix: "500.00", unite: "jour" }], 2, 3);
  assert.ok(r);
  assert.equal(r.montant, "1000.00", `2 jours × 500 € = 1000 €, pas ${r.montant} : l'équipe ne doit pas entrer dans ce calcul.`);
});

cas("une unité inconnue ne devient jamais de la main d'œuvre", () => {
  for (const unite of ["forfait", "ml", "arbre", "u", "sac", ""]) {
    assert.equal(
      chiffrerMainOeuvre([{ id: "z", intitule: "Quelque chose", prix: "400.00", unite }], 1, 2),
      null,
      `« ${unite} » a été pris pour une unité de main d'œuvre.`
    );
  }
});

console.log("\n=== Ce qui manque interdit le calcul, il ne l'approxime pas ===");

for (const [nom, jours, hommes] of [
  ["sans durée", null, 2],
  ["sans équipe", 1, null],
  ["sans rien", null, null],
  ["durée nulle", 0, 2],
  ["équipe nulle", 1, 0],
  ["durée absurde", Number.NaN, 2],
] as const) {
  cas(`${nom} : aucun prix`, () => {
    assert.equal(
      chiffrerMainOeuvre(GRILLE, jours as number | null, hommes as number | null),
      null,
      "Un prix est sorti d'une donnée absente : c'est exactement ce que docs/AGENT.md §3 interdit."
    );
  });
}

cas("une grille vide ne produit rien", () => {
  assert.equal(chiffrerMainOeuvre([], 1, 2), null);
});

cas("un tarif à zéro ou illisible est ignoré plutôt que retenu", () => {
  // Un tarif à 0 € donnerait un devis « gratuit » qui a l'air décidé.
  assert.equal(chiffrerMainOeuvre([{ id: "a", intitule: "M.O.", prix: "0", unite: "jour/homme" }], 1, 2), null);
  assert.equal(chiffrerMainOeuvre([{ id: "b", intitule: "M.O.", prix: "n'importe quoi", unite: "jour/homme" }], 1, 2), null);
});

cas("une demi-journée est un multiplicateur légitime", () => {
  const r = chiffrerMainOeuvre(GRILLE, 0.5, 2);
  assert.ok(r);
  assert.equal(r.montant, "400.00", "Une demi-journée à deux doit valoir une journée d'homme.");
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} Main d'œuvre depuis la grille — ${echecs} échec(s).`);
if (echecs > 0) process.exit(1);
