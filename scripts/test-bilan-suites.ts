import assert from "node:assert/strict";
import { bilanDuJournal, phraseDEchec, phraseDeBlocage, phraseDeCompte } from "./_bilan-suites.mjs";

/**
 * LE BILAN D'UN MOTEUR DE SUITES SE RELIT, ET IL SAIT DIRE QU'IL NE SAIT PAS.
 *
 * C'est la matière première de la règle du 16 septembre 2026 (« aucun nouveau
 * rouge ») : si la lecture manquait une suite, ce rouge-là deviendrait
 * invisible — donc toléré. Chaque cas ci-dessous est une façon de se tromper
 * que la lecture doit refuser.
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

console.log("=== Ce que les moteurs écrivent se relit ===");

cas("les suites tombées sont nommées, triées, sans doublon", () => {
  const journal = [
    "=== test-b.ts ===",
    phraseDEchec("test-b.ts", "code: 1"),
    "=== test-a.ts ===",
    phraseDEchec("test-a.ts", "signal: SIGTERM"),
    "=== test-c.ts ===",
    "  ✓ tout va bien",
    phraseDeCompte(1, 3),
  ].join("\n");
  assert.deepEqual(bilanDuJournal(journal), { rouges: ["test-a.ts", "test-b.ts"], complet: true });
});

cas("une suite TUÉE parce qu'elle ne rend pas la main est un rouge comme un autre", () => {
  // Un processus qui ne s'arrête pas n'est pas vert : `run-all-tests.ts` le
  // compte en échec, la lecture doit le compter aussi — sinon la batterie
  // annoncerait un rouge de plus que la liste, et le bilan serait incomplet.
  const journal = [phraseDeBlocage("test-lent.ts", 8), "   Ses tests ont peut-être tous réussi.", phraseDeCompte(4, 5)].join("\n");
  assert.deepEqual(bilanDuJournal(journal), { rouges: ["test-lent.ts"], complet: true });
});

cas("un compte qui ne tombe pas juste rend un bilan INCOMPLET", () => {
  // Le moteur navigateur, quand son serveur meurt, compte les suites restantes
  // comme perdues sans les nommer. Ce bilan-là ne doit tolérer AUCUN rouge.
  const journal = [
    phraseDEchec("test-x-e2e.ts", "code: 1"),
    "❌ Le serveur ne répond plus avant test-y-e2e.ts — il s'est arrêté (code 137).",
    phraseDeCompte(10, 20),
  ].join("\n");
  const bilan = bilanDuJournal(journal);
  assert.ok(bilan);
  assert.equal(bilan.complet, false);
  assert.deepEqual(bilan.rouges, ["test-x-e2e.ts"]);
});

cas("sans ligne de compte, ce n'est pas un bilan : null", () => {
  assert.equal(bilanDuJournal("npm ERR! quelque chose a cassé avant les suites"), null);
  assert.equal(bilanDuJournal(""), null);
});

cas("un moteur entièrement vert rend une liste vide et complète", () => {
  assert.deepEqual(bilanDuJournal(`  ✓ a\n  ✓ b\n${phraseDeCompte(58, 58)}`), { rouges: [], complet: true });
});

cas("une ligne ❌ qui n'est pas une suite n'entre pas dans la liste", () => {
  // « ❌ La construction a échoué » n'est pas un `.ts` : c'est un rouge hors
  // suites, et il fera un compte faux — donc un bilan incomplet, ce qui est
  // exactement le comportement voulu.
  const journal = ["❌ La construction a échoué (code 1).", phraseDeCompte(0, 1)].join("\n");
  assert.deepEqual(bilanDuJournal(journal), { rouges: [], complet: false });
});

cas("c'est le DERNIER compte qui conclut quand une sortie en enchaîne plusieurs", () => {
  const journal = [phraseDEchec("test-a.ts", "code: 1"), phraseDeCompte(0, 1), phraseDeCompte(1, 1)].join("\n");
  // Un rouge nommé, mais le dernier compte dit zéro rouge : incohérent, donc incomplet.
  assert.equal(bilanDuJournal(journal)?.complet, false);
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} Le bilan des suites — ${echecs} échec(s).`);
if (echecs > 0) process.exit(1);
