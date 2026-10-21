// La phrase au-dessus de « Accepter », et le contrôle de ce qu'il a lu
// (`src/lib/acceptation-documents.ts`, planche du 17 octobre 2026).
import assert from "node:assert";
import { exigeeMaintenant, memesDocuments, phraseDAcceptation } from "../src/lib/acceptation-documents";
import { VERSIONS_DOCUMENTS } from "../src/server/documents-legaux/versions";

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

// Article 15 : une nouvelle version est notifiée au moins trente jours avant de
// s'imposer. Avant le 18 octobre 2026, elle bloquait l'application le jour de
// sa publication (`docs/A-FAIRE.md` §17).
const LE_15_NOVEMBRE = new Date("2026-11-15T00:00:00Z");
cas("déjà client, pendant le préavis : la nouvelle version n'est pas encore exigée", () => {
  assert.ok(!exigeeMaintenant(LE_15_NOVEMBRE, true, new Date("2026-11-01T00:00:00Z")));
});
cas("déjà client, le jour de l'entrée en vigueur : elle l'est", () => {
  assert.ok(exigeeMaintenant(LE_15_NOVEMBRE, true, LE_15_NOVEMBRE));
});
cas("un nouvel inscrit accepte la dernière version tout de suite, préavis ou pas", () => {
  assert.ok(exigeeMaintenant(LE_15_NOVEMBRE, false, new Date("2026-11-01T00:00:00Z")));
});
cas("sans date d'entrée en vigueur, la version s'impose dès sa publication (les versions d'avant)", () => {
  assert.ok(exigeeMaintenant(null, true, new Date()));
});

// Une version NEUVE qui en remplace une autre doit dire quand elle s'impose ;
// sans cette date, elle bloquerait tout le monde le jour même. Seules les
// versions publiées avant cette règle en sont dispensées, et la liste est
// close : elle ne grandit pas.
const PUBLIEES_AVANT_LA_REGLE = new Set(["cgu:2", "cgu:3"]);
cas("chaque nouvelle version déclare son entrée en vigueur, au moins trente jours après qu'on l'écrit", () => {
  const vues = new Set<string>();
  for (const v of VERSIONS_DOCUMENTS) {
    const premiere = !vues.has(v.type);
    vues.add(v.type);
    if (premiere || PUBLIEES_AVANT_LA_REGLE.has(`${v.type}:${v.version}`)) continue;
    assert.ok(v.enVigueurLe, `${v.type} ${v.version} ne dit pas quand elle s'impose (article 15)`);
  }
});

if (echecs > 0) process.exit(1);
