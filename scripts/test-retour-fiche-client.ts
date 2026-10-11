import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { retourFicheClient, versFicheClient } from "../src/lib/retour-fiche-client";

// **« Ça ne me fait pas un retour, mais deux retours. »**
//
// ─────────────────────────────────────────────────────────────────────────────
// Le patron, le 20 août 2026, sur la fiche d'un client : *« quand j'appuie sur
// retour […] je reviens directement à la page vos chantiers. Or, je devrais
// rester dans la catégorie mes clients. »*
//
// La fiche renvoyait toujours à l'accueil, quel que soit l'écran d'où l'on
// venait. Depuis la liste des clients, un appui sautait donc DEUX écrans.
//
// **Ce que cette suite tient, et qui n'est pas qu'une histoire de confort :**
// la valeur qui dit d'où l'on vient voyage dans l'adresse, donc elle vient de
// n'importe qui. Sans filtre, la flèche « retour » deviendrait une sortie vers
// un site étranger. Les quatre derniers cas sont là pour ça.

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

const CHANTIER = "/chantiers/1de975a7-7f2c-43c3-98e6-63de23c61f8f";

console.log("=== La flèche de la fiche client ramène d'où l'on vient ===\n");

cas("sans rien : on retourne chez les clients, JAMAIS à l'accueil", () => {
  // C'est le défaut qu'il a signalé : « / » sautait deux écrans d'un coup.
  assert.equal(retourFicheClient(undefined).href, "/clients");
  assert.equal(retourFicheClient(null).href, "/clients");
  assert.equal(retourFicheClient("").href, "/clients");
});

cas("depuis un chantier : on retourne AU chantier, pas chez les clients", () => {
  const r = retourFicheClient(CHANTIER);
  assert.equal(r.href, CHANTIER, "il sortirait du chantier où il était");
  assert.match(r.libelle, /chantier/i);
});

cas("le libellé dit où l'on va — c'est ce que lisent les lecteurs d'écran", () => {
  assert.match(retourFicheClient(undefined).libelle, /clients/i);
});

cas("l'adresse de la fiche transporte l'origine, et la rend telle quelle", () => {
  const url = versFicheClient("abc", CHANTIER);
  assert.equal(url.startsWith("/clients/abc?de="), true, url);
  const de = new URLSearchParams(url.split("?")[1]).get("de");
  assert.equal(de, CHANTIER, "l'origine ne survit pas au voyage");
  assert.equal(retourFicheClient(de).href, CHANTIER);
});

cas("sans origine, l'adresse reste nue — pas de « ?de= » vide à traîner", () => {
  assert.equal(versFicheClient("abc"), "/clients/abc");
});

// ── Ce qui vient de l'adresse vient de n'importe qui ─────────────────────────

cas("une adresse ÉTRANGÈRE est refusée : la flèche n'est pas une porte de sortie", () => {
  for (const mechant of ["https://ailleurs.example", "http://ailleurs.example/x", "//ailleurs.example"]) {
    assert.equal(
      retourFicheClient(mechant).href,
      "/clients",
      `« ${mechant} » a été accepté : un appui sur « retour » quitterait Atlas`
    );
  }
});

cas("« javascript: » est refusé", () => {
  assert.equal(retourFicheClient("javascript:alert(1)").href, "/clients");
});

cas("un chemin interne inattendu retombe sur les clients, sans erreur ni vide", () => {
  for (const autre of ["/reglages", "/chantiers", "/chantiers/pas-un-identifiant", "../..", "/"]) {
    assert.equal(retourFicheClient(autre).href, "/clients", `« ${autre} » a été accepté`);
  }
});

cas("TÉMOIN — un chantier valide passe bien, sinon ce filtre refuserait tout", () => {
  // Sans ce cas, un filtre qui dirait « non » à tout paraîtrait irréprochable.
  assert.equal(retourFicheClient(CHANTIER).href, CHANTIER);
});

// ── L'écran n'a pas le droit de refaire la règle ─────────────────────────────

cas("la fiche client emploie la règle partagée, et ne remet pas « / » en dur", () => {
  const ecran = readFileSync(
    path.join(__dirname, "..", "src", "app", "clients", "[id]", "page.tsx"),
    "utf8"
  );
  assert.match(ecran, /retourFicheClient/, "l'écran ne consulte plus la règle");
  assert.doesNotMatch(
    ecran,
    /retour=\{\{\s*href:\s*"\/"/,
    "le retour vers l'accueil est revenu : c'est exactement le double saut qu'il a signalé"
  );
});

// ─── CE CAS A PERDU SON ÉCRAN, ET IL FAUT SAVOIR CE QUE ÇA COÛTE ────────────
//
// « le chantier dit d'où il part quand il ouvre la fiche » lisait
// `src/app/chantiers/[id]/page.tsx` et y exigeait `versFicheClient(`. Cette
// porte vers `/clients/[id]` vivait dans le tiroir de la fiche du chantier
// (arrangement B du 16 août 2026) ; **cette fiche est retirée le 4 septembre**
// (`ARCHITECTURE.md` §254), et le tiroir avec.
//
// **AUCUN ÉCRAN N'OUVRE PLUS `/clients/[id]` DEPUIS UN CHANTIER**, et ce n'est
// pas un oubli : c'est le prix du retrait, écrit noir sur blanc plutôt que
// découvert par lui. La fiche du client reste à deux touches par la liste des
// clients, et `TODO.md` porte la question — faut-il lui rendre cette porte, et
// où ? Lui seul peut trancher : ajouter un lien à la fiche client serait
// remettre sur un écran qu'il a fait vider le 20 août.
//
// **Le mécanisme, lui, est éprouvé au-dessus** — l'aller (`versFicheClient`) et
// le retour (`retourFicheClient`) se répondent, et refusent une adresse
// étrangère. Réécrire ce cas sur un autre écran aurait été lui prêter une
// promesse qu'il n'a jamais faite (`CLAUDE.md` §5 bis).

console.log(`\n${echecs === 0 ? "✅" : "❌"} Le retour de la fiche client — ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
