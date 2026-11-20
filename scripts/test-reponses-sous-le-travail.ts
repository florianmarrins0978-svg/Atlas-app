import assert from "node:assert/strict";
import { reponsesDuTravail, reponsesSousLesLignes } from "../src/lib/reponses-sous-le-travail";

// **SES RÉPONSES À LA GRILLE, SOUS LE TRAVAIL DU DEVIS** : sa planche du
// 20 novembre 2026 (`appli/soignee/devis-reponses-sous-le-travail.html`), son
// « oui » le même jour. Lues dans leurs cases (la technique nommée dans SA
// grille, les mesures), jamais dans le libellé.

let echecs = 0;
function cas(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${e instanceof Error ? e.message : e}`);
  }
}

console.log("=== Ses réponses, sous le travail ===\n");

cas("son chêne : sa façon d'abattre et son diamètre, la phrase de la planche", () => {
  assert.equal(
    reponsesDuTravail({ methodeLibelle: "Abattage entre 10 et 20 m", caracteristiques: { diametreCm: 80 } }),
    "Abattage entre 10 et 20 m, ⌀ 80 cm"
  );
});

cas("les mêmes mots que le libellé enrichi d'hier, la majuscule en tête", () => {
  // Ce qu'il relisait dans la parenthèse avant §588 : rien ne change de forme.
  const ancien = "Abattage d'un chêne (abattage entre 10 et 20 m, ⌀ 80 cm)";
  const dedans = ancien.slice(ancien.indexOf("(") + 1, -1);
  const sous = reponsesDuTravail({ methodeLibelle: "abattage entre 10 et 20 m", caracteristiques: { diametreCm: 80 } });
  assert.equal(sous?.toLowerCase(), dedans.toLowerCase());
  assert.equal(sous?.charAt(0), "A");
});

cas("la hauteur et le fût se disent comme à la question", () => {
  assert.equal(reponsesDuTravail({ methodeLibelle: null, caracteristiques: { hauteurM: 15, futM: 6 } }), "15 m de haut, fût de 6 m");
});

cas("rien de répondu, rien d'écrit : ni ligne vide, ni la longueur que la quantité dit déjà", () => {
  assert.equal(reponsesDuTravail({ methodeLibelle: null, caracteristiques: null }), null);
  assert.equal(reponsesDuTravail({ methodeLibelle: "  ", caracteristiques: {} }), null);
  assert.equal(reponsesDuTravail({ methodeLibelle: null, caracteristiques: { longueurMl: 50 } }), null);
  assert.equal(reponsesDuTravail({ methodeLibelle: null, caracteristiques: { diametreCm: 0 } }), null, "un tronc de 0 cm n'est pas une mesure");
});

cas("une phrase par travail, et trois chênes abattus pareil n'en font qu'une", () => {
  const prestations = [
    { id: "p1", methodeLibelle: "Abattage entre 10 et 20 m", caracteristiques: { diametreCm: 80 } },
    { id: "p2", methodeLibelle: "Abattage entre 10 et 20 m", caracteristiques: { diametreCm: 80 } },
    { id: "p3", methodeLibelle: "Démontage avec rétention", caracteristiques: { diametreCm: 70 } },
    { id: "p4", methodeLibelle: null, caracteristiques: null },
  ];
  const liens = [
    { lignePrixId: "l1", prestationId: "p1" },
    { lignePrixId: "l1", prestationId: "p2" },
    { lignePrixId: "l1", prestationId: "p3" },
    { lignePrixId: "l2", prestationId: "p4" },
    { lignePrixId: "l3", prestationId: "inconnue" },
  ];
  assert.deepEqual(reponsesSousLesLignes(liens, prestations), {
    l1: ["Abattage entre 10 et 20 m, ⌀ 80 cm", "Démontage avec rétention, ⌀ 70 cm"],
  });
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} Ses réponses sous le travail — ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
