import assert from "node:assert/strict";
import { bilanDuJournal, phraseDEchec, phraseDeBlocage, phraseDeCompte, phraseDeNonMesurable } from "./_bilan-suites.mjs";

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
  assert.deepEqual(bilanDuJournal(journal), { rouges: ["test-a.ts", "test-b.ts"], nonMesurables: [], complet: true });
});

cas("une suite TUÉE parce qu'elle ne rend pas la main est un rouge comme un autre", () => {
  // Un processus qui ne s'arrête pas n'est pas vert : `run-all-tests.ts` le
  // compte en échec, la lecture doit le compter aussi — sinon la batterie
  // annoncerait un rouge de plus que la liste, et le bilan serait incomplet.
  const journal = [phraseDeBlocage("test-lent.ts", 8), "   Ses tests ont peut-être tous réussi.", phraseDeCompte(4, 5)].join("\n");
  assert.deepEqual(bilanDuJournal(journal), { rouges: ["test-lent.ts"], nonMesurables: [], complet: true });
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
  assert.deepEqual(bilanDuJournal(`  ✓ a\n  ✓ b\n${phraseDeCompte(58, 58)}`), { rouges: [], nonMesurables: [], complet: true });
});

cas("une ligne ❌ qui n'est pas une suite n'entre pas dans la liste", () => {
  // « ❌ La construction a échoué » n'est pas un `.ts` : c'est un rouge hors
  // suites, et il fera un compte faux — donc un bilan incomplet, ce qui est
  // exactement le comportement voulu.
  const journal = ["❌ La construction a échoué (code 1).", phraseDeCompte(0, 1)].join("\n");
  assert.deepEqual(bilanDuJournal(journal), { rouges: [], nonMesurables: [], complet: false });
});

cas("c'est le DERNIER compte qui conclut quand une sortie en enchaîne plusieurs", () => {
  const journal = [phraseDEchec("test-a.ts", "code: 1"), phraseDeCompte(0, 1), phraseDeCompte(1, 1)].join("\n");
  // Un rouge nommé, mais le dernier compte dit zéro rouge : incohérent, donc incomplet.
  assert.equal(bilanDuJournal(journal)?.complet, false);
});

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * UNE SUITE QUI NE PEUT PAS MESURER N'EST NI VERTE NI ROUGE — 20 septembre 2026.
 *
 * **Sa colère :** *« ça fait deux jours j'ai une session qui essaye de me
 * fusionner une modif, elle y arrive pas alors qu'elle est seule »*. Dix-neuf
 * suites d'outillage rougissent sur son PC Windows — elles réclament `bash`,
 * `gh`, `curl`, `npx`. Elles sont rouges sur `main` aussi, avec ou sans lot,
 * et chaque lot payait ~30 min à réapprendre qu'elles l'étaient déjà.
 *
 * **Ce qui est refusé, et ne doit pas revenir :** une liste « ces suites-là ne
 * comptent pas ». Une liste qui ABAISSE une exigence oublie un jour un
 * fichier, et du danger part sans que rien ne le dise
 * (`.claude/rules/testing.md`).
 *
 * **Ce qui la remplace :** la suite sonde la machine et refuse de conclure.
 * Elle sort alors de `réussies` ET de `rouges` — la compter verte serait
 * exactement le contrôle qui mesure zéro (`CLAUDE.md` §5).
 */
cas("une suite non mesurable n'est ni dans les rouges ni dans les réussies", () => {
  const journal = [
    "=== test-ouvrir-port.ts ===",
    phraseDeNonMesurable("test-ouvrir-port.ts", "« gh » est absent de cette machine"),
    "=== test-a.ts ===",
    "  ✓ tout va bien",
    phraseDeCompte(1, 2, 1),
  ].join("\n");
  assert.deepEqual(bilanDuJournal(journal), {
    rouges: [],
    nonMesurables: ["test-ouvrir-port.ts"],
    complet: true,
  });
});

cas("un rouge et un non mesurable cohabitent sans se confondre", () => {
  const journal = [
    phraseDEchec("test-b.ts", "code: 1"),
    phraseDeNonMesurable("test-c.ts", "« bash » est absent de cette machine"),
    phraseDeCompte(1, 3, 1),
  ].join("\n");
  assert.deepEqual(bilanDuJournal(journal), {
    rouges: ["test-b.ts"],
    nonMesurables: ["test-c.ts"],
    complet: true,
  });
});

cas("un non mesurable que le compte n'annonce pas rend le bilan INCOMPLET", () => {
  // **Le compte est le seul témoin croisé.** Sans lui, une suite pourrait se
  // déclarer « non mesurable » sans que personne ne le voie passer, et
  // l'exemption deviendrait la liste qu'on refuse.
  const journal = [
    phraseDeNonMesurable("test-c.ts", "« bash » est absent de cette machine"),
    phraseDeCompte(2, 3),
  ].join("\n");
  assert.equal(bilanDuJournal(journal)?.complet, false);
});

cas("un journal d'avant ce mécanisme se relit encore, sans non mesurables", () => {
  assert.deepEqual(bilanDuJournal(`  ✓ a\n${phraseDeCompte(1, 1)}`), {
    rouges: [],
    nonMesurables: [],
    complet: true,
  });
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} Le bilan des suites — ${echecs} échec(s).`);
if (echecs > 0) process.exit(1);
