import assert from "node:assert/strict";
import { lotInchange, rougesApresComplement, suitesDuComplement } from "./_apres-fusion.mjs";

/**
 * LE COMPLÉMENT NE TIENT QUE POUR LE MÊME LOT, ET NE REJOUE QUE LA RENCONTRE.
 *
 * Sa règle du 17 septembre 2026 : « rejoue juste ce qui a bougé ». Chaque cas
 * ci-dessous est une façon de laisser passer autre chose que ça.
 */

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

console.log("=== Le lot est-il le même ? ===");

const DIFF = `diff --git a/src/a.ts b/src/a.ts
index 1111111..2222222 100644
--- a/src/a.ts
+++ b/src/a.ts
@@ -1,2 +1,2 @@
-const x = 1;
+const x = 2;
`;

cas("le même diff, reposé sur une autre base (index différent) : inchangé", () => {
  const rebase = DIFF.replace("index 1111111..2222222", "index 3333333..4444444");
  assert.equal(lotInchange(DIFF, rebase), true);
});

cas("une ligne de plus dans le lot : changé", () => {
  assert.equal(lotInchange(DIFF, DIFF.replace("+const x = 2;", "+const x = 3;")), false);
  assert.equal(lotInchange(DIFF, DIFF + "+// une ligne\n"), false);
});

cas("un fichier de plus dans le lot : changé", () => {
  assert.equal(lotInchange(DIFF, DIFF + DIFF.replace(/a\.ts/g, "b.ts")), false);
});

cas("des numéros de ligne qui glissent (main a ajouté des lignes plus haut) : inchangé", () => {
  // Une entrée de CHANGELOG ajoutée par main au-dessus de la nôtre déplace le
  // hunk sans rien changer au lot — trouvé au premier complément joué.
  assert.equal(lotInchange(DIFF, DIFF.replace("@@ -1,2 +1,2 @@", "@@ -57,2 +57,2 @@")), true);
});

cas("une ligne de CONTEXTE qui change (main a touché une ligne voisine) : changé — on ne parie pas sur une rencontre", () => {
  const voisin = DIFF.replace("@@ -1,2 +1,2 @@\n-const x = 1;", "@@ -1,3 +1,3 @@\n const y = 0;\n-const x = 1;");
  assert.equal(lotInchange(DIFF, voisin), false);
});

console.log("\n=== Ce qu'on rejoue ===");

cas("les écrans du lot, ceux que main a touchés, et les suites que main a apportées — sans doublon, triés", () => {
  const suites = suitesDuComplement({
    suitesDuLot: ["test-fiche-client-e2e.ts", "test-anneau-dictee-e2e.ts"],
    suitesDuDelta: ["test-accueil-e2e.ts", "test-fiche-client-e2e.ts"],
    fichiersDuDelta: ["src/app/EcranChantiers.tsx", "scripts/test-micro-fiche-client-degage-e2e.ts", "scripts/test-une-suite-base.ts", "scripts\\test-accueil-en-cours-colle-e2e.ts"],
  });
  assert.deepEqual(suites, [
    "test-accueil-e2e.ts",
    "test-accueil-en-cours-colle-e2e.ts",
    "test-anneau-dictee-e2e.ts",
    "test-fiche-client-e2e.ts",
    "test-micro-fiche-client-degage-e2e.ts",
  ]);
});

cas("rien ne bouge d'un écran, rien n'est apporté : rien à rejouer côté navigateur", () => {
  assert.deepEqual(suitesDuComplement({ suitesDuLot: [], suitesDuDelta: [], fichiersDuDelta: ["docs/x.md"] }), []);
});

console.log("\n=== Ce que le verdict complété retient ===");

cas("une suite rejouée verte sort des rouges ; une suite non rejouée garde son rouge", () => {
  const rouges = rougesApresComplement({
    rougesAvant: ["test-outil.ts", "test-ecran-x-e2e.ts", "test-ecran-y-e2e.ts"],
    suitesRejouees: ["test-outil.ts", "test-ecran-x-e2e.ts"],
    rougesMesures: ["test-outil.ts"],
  });
  // outil : rejouée, encore rouge → reste ; x : rejouée, verte → sort ; y : pas rejouée → reste.
  assert.deepEqual(rouges, ["test-ecran-y-e2e.ts", "test-outil.ts"]);
});

cas("un rouge mesuré maintenant entre, même s'il n'était pas rouge avant", () => {
  const rouges = rougesApresComplement({ rougesAvant: [], suitesRejouees: ["test-neuf-e2e.ts"], rougesMesures: ["test-neuf-e2e.ts"] });
  assert.deepEqual(rouges, ["test-neuf-e2e.ts"]);
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} Le complément après fusion — ${echecs} échec(s).`);
if (echecs > 0) process.exit(1);
