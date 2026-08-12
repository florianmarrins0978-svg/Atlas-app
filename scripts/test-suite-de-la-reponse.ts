import assert from "node:assert/strict";
import { suiteDeLaReponse, type ReponseClient } from "../src/lib/suite-de-la-reponse";

// **Quand le client a répondu, la carte mène là où est le geste.**
//
// ─────────────────────────────────────────────────────────────────────────────
// Le patron, le 12 août 2026 : *« si le chantier il est accepté par le client,
// il faut qu'à la place de "ouvrir le chantier", on puisse ouvrir le devis — et
// le devis validé, pas le devis en construction. Par contre, si le devis n'est
// pas validé et il nous revient pour une modification, il faut qu'on puisse
// ouvrir le devis, mais pour pouvoir le modifier. »*
//
// Les quatre cartes menaient toutes à la fiche du chantier. **Leur propre texte
// disait pourtant autre chose** — « le devis peut être repris et renvoyé » — et
// le lien menait ailleurs : un écran qui annonce un geste et conduit à un autre
// fait douter de tout le reste.
//
// Fonction pure, éprouvée sans base ni navigateur (`CLAUDE.md` §3). Ce qui est
// tenu ici n'est pas l'apparence du lien, c'est **la règle** : accepté mène au
// document figé, tout le reste mène à l'écran qui sait reprendre.

let passed = 0;
let failed = 0;

function test(nom: string, verifier: () => void) {
  try {
    verifier();
    passed++;
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    failed++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

console.log("=== La carte mène là où est le geste ===\n");

const CHANTIER = "3f2b1c9e-0000-4000-8000-000000000001";

test("accepté : le devis VALIDÉ, pas la fiche du chantier", () => {
  const s = suiteDeLaReponse(CHANTIER, "acceptee");
  assert.equal(s.href, `/chantiers/${CHANTIER}/devis-complet`);
  // Le devis parti est immuable (trigger `empecher_modification_devis_envoye`) :
  // cet écran l'affiche donc figé, tel que le client l'a reçu.
  assert.match(s.libelle, /devis validé/i);
  assert.ok(!/chantier/i.test(s.libelle), "le lien ne doit plus parler du chantier");
});

test("correction demandée : là où le devis peut être repris", () => {
  const s = suiteDeLaReponse(CHANTIER, "correction");
  assert.equal(s.href, `/chantiers/${CHANTIER}/export`);
  assert.match(s.libelle, /corriger/i);
});

test("refus : la reprise, que la carte annonçait déjà", () => {
  const s = suiteDeLaReponse(CHANTIER, "refusee");
  assert.equal(s.href, `/chantiers/${CHANTIER}/export`);
  assert.match(s.libelle, /reprendre/i);
});

test("lien périmé sans réponse : le silence se reprend comme un refus", () => {
  const s = suiteDeLaReponse(CHANTIER, null);
  assert.equal(s.href, `/chantiers/${CHANTIER}/export`);
  assert.match(s.libelle, /reprendre/i);
});

test("un devis À CORRIGER ne mène JAMAIS au document figé", () => {
  // **C'est le piège que ce contrôle existe pour empêcher.** Le mener sur
  // `devis-complet` paraîtrait plus direct — « ouvrir le devis pour le
  // modifier » — mais le devis parti refuse la première frappe, et le patron
  // se retrouverait devant un document mort sans comprendre pourquoi. La
  // reprise ouvre une nouvelle version, et c'est SON geste.
  for (const reponse of ["correction", "refusee", null] as ReponseClient[]) {
    const s = suiteDeLaReponse(CHANTIER, reponse);
    assert.ok(
      !s.href.endsWith("/devis-complet"),
      `« ${reponse} » mène au document figé : le patron ne pourrait rien y modifier`
    );
  }
});

test("aucune carte ne mène plus à la fiche nue du chantier", () => {
  // L'ancien comportement : le même lien pour les quatre situations.
  for (const reponse of ["acceptee", "correction", "refusee", null] as ReponseClient[]) {
    const s = suiteDeLaReponse(CHANTIER, reponse);
    assert.notEqual(s.href, `/chantiers/${CHANTIER}`, `« ${reponse} » mène encore à la fiche`);
    assert.ok(s.libelle.length > 8, `libellé trop court pour annoncer un geste : ${s.libelle}`);
  }
});

test("le chantier visé est bien celui de la carte", () => {
  // Un lien juste sur le mauvais chantier serait pire qu'un lien générique.
  const autre = "3f2b1c9e-0000-4000-8000-000000000002";
  assert.ok(suiteDeLaReponse(autre, "acceptee").href.includes(autre));
});

console.log(`\n${failed === 0 ? "✅" : "❌"} ${passed} test(s) réussi(s), ${failed} échoué(s).`);
process.exit(failed === 0 ? 0 : 1);
