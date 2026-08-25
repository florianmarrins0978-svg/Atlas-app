import assert from "node:assert/strict";
import { ouvrableParLeClient, phraseAdresseLocale } from "../src/lib/adresse-du-client";
import { originePublique } from "../src/server/origine-publique";

// L'adresse qu'on met dans un message à un client.
//
// **Sa capture du 24 août 2026 : « Connexion au serveur impossible. »** Le
// client ouvre le SMS de sa fiche de chantier et tombe sur `localhost` — son
// propre téléphone. Le rapport existait ; c'est l'adresse qui ne désignait
// qu'une machine.
//
// Ce qui est éprouvé ici, et pourquoi ces cas-là :
//
//   1. **les adresses qui ne sortent pas d'un réseau** — `localhost` est la
//      plus visible, mais `192.168.x.x` est la plus traître : elle s'ouvre au
//      bureau et nulle part ailleurs, donc l'essai réussit et le client échoue ;
//   2. **une adresse publique passe** — un contrôle qui refuserait tout serait
//      pire qu'absent : il barrerait tous les envois sans qu'on comprenne ;
//   3. `ATLAS_URL_PUBLIQUE` commande, parce que c'est le seul moyen qu'a un
//      déploiement derrière un mandataire muet de dire son adresse.

let echecs = 0;
function cas(nom: string, verifier: () => void) {
  try {
    verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${e instanceof Error ? e.message : e}`);
  }
}

/** Des en-têtes, comme Next.js les rend. */
function entetes(paires: Record<string, string>) {
  return { get: (nom: string) => paires[nom.toLowerCase()] ?? null };
}

console.log("=== L'adresse qu'on donne à un client ===");

cas("CE QUI A ÉTÉ PAYÉ : localhost ne part pas chez un client", () => {
  assert.equal(ouvrableParLeClient("http://localhost:3000"), false);
  assert.equal(ouvrableParLeClient("http://localhost"), false);
  assert.equal(ouvrableParLeClient("http://127.0.0.1:3000"), false);
  assert.equal(ouvrableParLeClient("http://[::1]:3000"), false);
  assert.equal(ouvrableParLeClient("http://atlas.localhost:3000"), false);
});

cas("LA PLUS TRAÎTRE : une adresse de réseau local s'ouvre au bureau, pas chez le client", () => {
  // Celle-ci réussit tous les essais faits sur place — et échoue chez tout le
  // monde. C'est le cas qu'un contrôle limité à `localhost` laisserait passer.
  assert.equal(ouvrableParLeClient("http://192.168.1.42:3000"), false);
  assert.equal(ouvrableParLeClient("http://10.0.0.7:3000"), false);
  assert.equal(ouvrableParLeClient("http://172.20.3.9:3000"), false);
  assert.equal(ouvrableParLeClient("http://169.254.4.5"), false);
  assert.equal(ouvrableParLeClient("http://mac-de-florian.local:3000"), false);
});

cas("ET LES ADRESSES PUBLIQUES PASSENT — sinon le contrôle barrerait tout", () => {
  // **Sans ces cas, celui du dessus serait vert avec `return false` partout.**
  assert.equal(ouvrableParLeClient("https://atlas.fr"), true);
  assert.equal(
    ouvrableParLeClient("https://reimagined-space-yodel-jr4j6-3000.app.github.dev"),
    true,
    "l'espace de travail du patron est refusé : plus aucun rapport ne partirait"
  );
  // 172.32 n'est PAS dans la plage privée : elle s'arrête à 172.31.
  assert.equal(ouvrableParLeClient("https://172.32.0.1"), true);
  assert.equal(ouvrableParLeClient("https://11.0.0.1"), true);
});

cas("une adresse absente ou illisible ne vaut pas mieux qu'une mauvaise", () => {
  assert.equal(ouvrableParLeClient(""), false);
  assert.equal(ouvrableParLeClient(null), false);
  assert.equal(ouvrableParLeClient(undefined), false);
  assert.equal(ouvrableParLeClient("/entretien/abc"), false, "un chemin seul ne s'ouvre nulle part");
  assert.equal(ouvrableParLeClient("javascript:alert(1)"), false);
  assert.equal(ouvrableParLeClient("file:///tmp/rapport.html"), false);
});

cas("la phrase dit le GESTE, et rassure sur ce qui est en jeu", () => {
  // `CLAUDE.md` §3 ter : pas de mécanisme dans ce qu'il lit. Et surtout, elle
  // doit dire que son travail est sauf — sinon il recoche toute sa fiche, ou
  // pire, il rappuie sur un bouton qui a déjà engagé sa comptabilité.
  const PHRASE_ADRESSE_LOCALE = phraseAdresseLocale("votre rapport");
  assert.match(PHRASE_ADRESSE_LOCALE, /adresse web/i, "elle ne dit pas quoi faire");
  assert.match(PHRASE_ADRESSE_LOCALE, /rien n'est perdu/i, "elle ne dit pas que le travail est sauf");

  // **Les trois documents, et l'ACCORD qui va avec.** « votre facture est
  // enregistré » est exactement la faute que le patron relève ; la phrase se
  // termine donc par un verbe qui ne s'accorde pas.
  for (const quoi of ["votre rapport", "votre devis", "votre facture"]) {
    assert.match(phraseAdresseLocale(quoi), new RegExp(`${quoi} vous attend ici`));
  }
  // **Les bornes de mot ne sont pas une coquetterie** : sans elles, `/port/`
  // trouve « ra-pport » et ce contrôle accuse la phrase d'un jargon qu'elle n'a
  // pas. Une erreur qui envoie chercher au mauvais endroit coûte plus cher que
  // pas d'erreur du tout (`AGENTS.md`) — et celle-ci a rougi le jour même où
  // elle a été écrite.
  assert.doesNotMatch(
    PHRASE_ADRESSE_LOCALE,
    /\b(port|proxy|mandataire|localhost|redirection|serveur)\b/i,
    "elle parle comme un programme"
  );
});

cas("l'origine vient de ce que le navigateur a demandé", () => {
  assert.equal(
    originePublique(entetes({ "x-forwarded-host": "atlas.app.github.dev", "x-forwarded-proto": "https" })),
    "https://atlas.app.github.dev"
  );
  // Plusieurs mandataires : le premier est celui que le navigateur a demandé.
  assert.equal(
    originePublique(entetes({ "x-forwarded-host": "atlas.fr, interne.local", "x-forwarded-proto": "https, http" })),
    "https://atlas.fr"
  );
  assert.equal(originePublique(entetes({ host: "localhost:3000" })), "http://localhost:3000");
  assert.equal(originePublique(entetes({ host: "atlas.fr" })), "https://atlas.fr");
  assert.equal(originePublique(entetes({})), "");
});

cas("ATLAS_URL_PUBLIQUE COMMANDE — c'est la réponse d'un mandataire muet", () => {
  const avant = process.env.ATLAS_URL_PUBLIQUE;
  try {
    process.env.ATLAS_URL_PUBLIQUE = "https://atlas.fr/";
    assert.equal(
      originePublique(entetes({ host: "localhost:3000" })),
      "https://atlas.fr",
      "la variable ne l'emporte pas sur l'hôte demandé"
    );
    // La barre de fin ne doit pas se retrouver doublée dans le lien.
    assert.equal(ouvrableParLeClient(originePublique(entetes({ host: "localhost:3000" }))), true);
  } finally {
    if (avant === undefined) delete process.env.ATLAS_URL_PUBLIQUE;
    else process.env.ATLAS_URL_PUBLIQUE = avant;
  }
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} Adresse du client — ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
