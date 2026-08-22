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
// **Corrigé le 13 août 2026, par lui :** *« lorsque je clique sur corriger le
// devis, je dois arriver directement sur la page du devis pour pouvoir le
// corriger. Et aujourd'hui, ce n'est pas le cas. »* La veille, « Corriger le
// devis » menait à l'écran d'envoi, par crainte de reprendre le devis à sa
// place. La crainte visait juste, mais pas ici : **c'est lui qui appuie**, sur
// un bouton qui annonce la correction. Le geste est le sien.
//
// Fonction pure, éprouvée sans base ni navigateur (`CLAUDE.md` §3). Ce qui est
// tenu ici n'est pas l'apparence du lien, c'est **la règle** : accepté ouvre le
// document figé sans y toucher ; une correction ouvre le document APRÈS
// reprise ; un refus ou un silence laisse le choix, sur l'écran d'envoi.

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

test("correction demandée : le DEVIS, et modifiable", () => {
  const s = suiteDeLaReponse(CHANTIER, "correction");
  assert.equal(s.href, `/chantiers/${CHANTIER}/devis-complet`);
  assert.match(s.libelle, /corriger/i);
  // Sans ce drapeau, il tomberait sur le document figé — celui qui refuse la
  // première frappe. C'est lui qui rend la demande du 13 août réalisable.
  assert.equal(
    s.reprendreAvant,
    true,
    "le devis n'est pas repris avant d'ouvrir la page : il arriverait sur un document mort"
  );
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

test("jamais le document FIGÉ sans l'avoir repris d'abord", () => {
  // **Le piège que ce contrôle existe pour empêcher, et il n'a pas changé le
  // 13 août — seule la façon de l'éviter a changé.** Mener sur `devis-complet`
  // est bien ce que le patron demande ; mais un devis parti refuse la première
  // frappe, et il se retrouverait devant un document mort sans comprendre
  // pourquoi. La destination est donc autorisée UNIQUEMENT accompagnée de la
  // reprise. Les deux séparés reproduiraient exactement l'ancien défaut.
  for (const reponse of ["correction", "refusee", null] as ReponseClient[]) {
    const s = suiteDeLaReponse(CHANTIER, reponse);
    if (s.href.endsWith("/devis-complet")) {
      assert.ok(
        s.reprendreAvant,
        `« ${reponse} » ouvre le document figé sans le reprendre : le patron ne pourrait rien y modifier`
      );
    }
  }
});

test("un devis ACCEPTÉ n'est jamais repris d'office", () => {
  // **La limite de la demande du 13 août.** Le document accepté est celui sur
  // lequel les deux se sont mis d'accord : le reprendre en l'ouvrant le
  // remplacerait sans le dire, et le patron perdrait la trace de ce que son
  // client a réellement approuvé.
  const s = suiteDeLaReponse(CHANTIER, "acceptee");
  assert.equal(s.reprendreAvant, false, "ouvrir un devis accepté en ouvrirait une nouvelle version");
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
