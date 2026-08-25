import assert from "node:assert/strict";
import {
  RESERVES_MONTREES,
  phraseDuReste,
  reservesLisibles,
} from "../src/lib/brouillon-reserves";

/**
 * LES RÉSERVES DU BROUILLON — ce qui se montre, et ce qui se dit.
 *
 * *Sa demande du 25 août 2026, capture à l'appui : « le à confirmer est trop
 * long, synthétise-le. Moins de mots ! »*
 *
 * Ce que cette suite tient :
 *
 *   1. **la liste est plafonnée** — quatorze lignes de gris avant ses
 *      prestations, il ne les lit pas ;
 *   2. **ce qui est coupé se DIT.** Une liste tronquée en silence se lit comme
 *      une liste complète : il chiffrerait sans la réserve qu'on lui cache ;
 *   3. **le texte n'est PAS raccourci ici.** Couper une phrase à six mots ferait
 *      disparaître la question qu'elle pose. La brièveté se joue à l'écriture,
 *      dans la consigne donnée au modèle.
 */

let reussis = 0;
function cas(nom: string, verifier: () => void) {
  try {
    verifier();
    reussis++;
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    console.error(`  ✗ ${nom}\n    ${e instanceof Error ? e.message : String(e)}`);
    process.exitCode = 1;
  }
}

console.log("=== Les réserves du brouillon ===");

cas("une liste courte passe entière, et ne dit rien de plus", () => {
  const r = reservesLisibles(["Durée du chantier", "Taille de l'équipe"]);
  assert.deepEqual(r.montrees, ["Durée du chantier", "Taille de l'équipe"]);
  assert.equal(r.reste, 0);
  assert.equal(phraseDuReste(r.reste), null);
});

cas("au-delà du plafond, seules les premières s'affichent", () => {
  const huit = Array.from({ length: 8 }, (_, i) => `Réserve ${i + 1}`);
  const r = reservesLisibles(huit);
  assert.equal(r.montrees.length, RESERVES_MONTREES);
  // L'ordre du modèle est gardé : il place l'important devant.
  assert.equal(r.montrees[0], "Réserve 1");
  assert.equal(r.montrees[RESERVES_MONTREES - 1], `Réserve ${RESERVES_MONTREES}`);
});

cas("CE QUI EST COUPÉ SE DIT — jamais un silence", () => {
  // Le contrôle qui compte. Une liste tronquée sans un mot se lit comme
  // complète, et c'est ainsi qu'une réserve disparaît sans que personne ne le
  // sache (`CLAUDE.md` §4 ter).
  const r = reservesLisibles(Array.from({ length: 8 }, (_, i) => `Réserve ${i + 1}`));
  assert.equal(r.reste, 3);
  assert.equal(phraseDuReste(r.reste), "+ 3 autres");
  assert.equal(phraseDuReste(1), "+ 1 autre", "le singulier doit s'accorder : il relève ce genre de chose");
});

cas("le texte d'une réserve n'est JAMAIS raccourci", () => {
  // Payé en réfléchissant : couper à six mots aurait donné « Il est mentionné
  // 'des herbages, des massifs' » — l'entrée en matière sans la question.
  const longue =
    "Il est mentionné 'des herbages, des massifs' en lien avec la tonte : " +
    "s'agit-il uniquement de tondre ces zones, ou également de désherber ?";
  assert.equal(reservesLisibles([longue]).montrees[0], longue);
});

cas("rien à montrer ne rend rien, sans casser", () => {
  for (const vide of [[], null, undefined, ["", "   "]]) {
    const r = reservesLisibles(vide as string[] | null | undefined);
    assert.deepEqual(r.montrees, []);
    assert.equal(r.reste, 0);
  }
});

cas("les blancs autour d'une réserve sont retirés, pas la réserve", () => {
  const r = reservesLisibles(["  Durée du chantier  ", "", "Taille de l'équipe"]);
  assert.deepEqual(r.montrees, ["Durée du chantier", "Taille de l'équipe"]);
});

console.log(`\n${reussis} test(s) réussi(s)`);
