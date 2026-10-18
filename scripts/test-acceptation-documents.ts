// La phrase au-dessus de « Accepter », et le contrôle de ce qu'il a lu
// (`src/lib/acceptation-documents.ts`, planche du 17 octobre 2026).
import assert from "node:assert";
import { memesDocuments, phraseDAcceptation } from "../src/lib/acceptation-documents";

let echecs = 0;
function cas(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`❌ ${nom}\n   ${e instanceof Error ? e.message : e}`);
  }
}

cas("deux documents : la phrase les compte en lettres", () => {
  assert.equal(phraseDAcceptation(2), "En touchant « Accepter », vous acceptez les deux documents ci-dessous.");
});
cas("une nouvelle version seule : au singulier", () => {
  assert.equal(phraseDAcceptation(1), "En touchant « Accepter », vous acceptez le document ci-dessous.");
});
cas("trois documents et plus : en chiffres", () => {
  assert.equal(phraseDAcceptation(3), "En touchant « Accepter », vous acceptez les 3 documents ci-dessous.");
});

cas("la même liste, dans un autre ordre : c'est ce qu'il a lu", () => {
  assert.ok(memesDocuments(["b", "a"], ["a", "b"]));
});
cas("une version publiée pendant qu'il lisait : refusé", () => {
  assert.ok(!memesDocuments(["a"], ["a", "b"]));
});
cas("un document en trop dans le formulaire : refusé", () => {
  assert.ok(!memesDocuments(["a", "b", "c"], ["a", "b"]));
});
cas("un identifiant remplacé : refusé", () => {
  assert.ok(!memesDocuments(["a", "x"], ["a", "b"]));
});
cas("le même identifiant envoyé deux fois ne remplace pas l'autre", () => {
  assert.ok(!memesDocuments(["a", "a"], ["a", "b"]));
});
cas("rien d'affiché, rien d'attendu : rien n'est accepté à l'aveugle ailleurs", () => {
  // L'action redirige avant ce contrôle quand rien n'est attendu ; ce cas dit
  // seulement que deux listes vides sont égales, sans plus.
  assert.ok(memesDocuments([], []));
});

if (echecs > 0) process.exit(1);
