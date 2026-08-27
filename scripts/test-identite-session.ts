// Ce qui identifie une session, et depuis quand elle existe — M11 + coupure.
//
// ─────────────────────────────────────────────────────────────────────────────
// **CE QUE CETTE SUITE PROUVE, ET POURQUOI ELLE NE PEUT PAS ÊTRE VERTE À TORT.**
//
// `@auth/core` régénère `iat` ET `jti` à chaque réémission du jeton — mesuré sur
// la version installée (`scripts/sonde-jeton-session.mts`). Aucun des deux ne
// peut donc porter « une session logique », et la coupure globale, qui comparait
// `iat`, **se contournait** : un cookie coupé se faisait réémettre un jeton par
// `GET /api/auth/session` et rentrait.
//
// Ce fichier tient la règle qui répare cela. Elle est **pure** : ni base, ni
// réseau, ni navigateur. Le parcours réel, lui, est tenu par
// `scripts/test-coupure-sessions-e2e.ts`, qui a été vu ROUGE sur le code d'avant.

import assert from "node:assert/strict";
import type { MarquesSession } from "../src/lib/identite-session";
import {
  marquerSession,
  instantDAuthentification,
  sessionCoupee,
} from "../src/lib/identite-session";

let echecs = 0;
function essai(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}`);
    console.log(`    ${(e as Error).message}`);
  }
}

/** Un tirage prévisible, pour que la suite ne dépende pas du hasard. */
function tirages(...valeurs: string[]) {
  let i = 0;
  return () => valeurs[Math.min(i++, valeurs.length - 1)];
}

function main() {
  console.log("=== L'identité d'une session, et son ancienneté ===\n");

  // ─── 1. Deux authentifications = deux sessions ────────────────────────────

  essai("DEUX CONNEXIONS donnent deux sessionId différents", () => {
    const a = marquerSession<MarquesSession>({}, true, 1000, tirages("session-A"));
    const b = marquerSession<MarquesSession>({}, true, 1000, tirages("session-B"));
    assert.notEqual(a.sessionId, b.sessionId, "deux connexions partagent une identité de session");
  });

  essai("…et chacune porte SON instant d'authentification", () => {
    const a = marquerSession<MarquesSession>({}, true, 1000, tirages("A"));
    const b = marquerSession<MarquesSession>({}, true, 2000, tirages("B"));
    assert.equal(a.authentifieLe, 1000);
    assert.equal(b.authentifieLe, 2000);
  });

  // ─── 2. La réémission ne change RIEN ──────────────────────────────────────

  essai("UNE RÉÉMISSION garde le même sessionId", () => {
    const ouverture = marquerSession<MarquesSession>({}, true, 1000, tirages("session-A"));
    const reemis = marquerSession(ouverture, false, 9999, tirages("session-VOLEE"));
    assert.equal(reemis.sessionId, "session-A", "la réémission a changé l'identité de la session");
  });

  essai("UNE RÉÉMISSION garde le même instant d'authentification", () => {
    /**
     * **LE CONTRÔLE QUI TIENT TOUTE LA CORRECTION.** Si cet instant avançait, une
     * session coupée redeviendrait valable en se faisant simplement réémettre —
     * c'est exactement le contournement reproduit au navigateur le 25 août 2026.
     */
    const ouverture = marquerSession<MarquesSession>({}, true, 1000, tirages("A"));
    const reemis = marquerSession(ouverture, false, 9999, tirages("A"));
    assert.equal(reemis.authentifieLe, 1000, "LA RÉÉMISSION A RAJEUNI LA SESSION");
  });

  essai("dix réémissions n'usent pas davantage les marques", () => {
    let jeton = marquerSession<MarquesSession>({}, true, 1000, tirages("A"));
    for (let i = 0; i < 10; i++) jeton = marquerSession(jeton, false, 5000 + i, tirages("AUTRE"));
    assert.equal(jeton.sessionId, "A");
    assert.equal(jeton.authentifieLe, 1000);
  });

  essai("un jeton d'AVANT cette version ne se fait pas marquer en passant", () => {
    /**
     * Le piège qu'il fallait éviter : poser les marques à la volée sur un vieux
     * jeton lui donnerait un `authentifieLe` valant *maintenant* — le
     * rajeunissement qu'on referme. Il reste nu, et le repli sur `iat` s'en
     * charge.
     */
    const ancien = marquerSession<MarquesSession>({}, false, 9999, tirages("NEUF"));
    assert.equal(ancien.sessionId, undefined);
    assert.equal(ancien.authentifieLe, undefined);
  });

  // ─── 3. L'instant comparé à la coupure ────────────────────────────────────

  console.log("");

  essai("l'instant retenu est celui de l'AUTHENTIFICATION, pas de la signature", () => {
    assert.equal(instantDAuthentification({ authentifieLe: 1000, emisLe: 9999 }), 1000);
  });

  essai("un jeton d'avant retombe sur son instant de signature", () => {
    assert.equal(instantDAuthentification({ emisLe: 4242 }), 4242);
  });

  essai("un jeton sans rien ne rend rien — et n'est pas coupé d'office", () => {
    assert.equal(instantDAuthentification({}), undefined);
    assert.equal(sessionCoupee(undefined, new Date(9_000_000)), false);
  });

  // ─── 4. La coupure ────────────────────────────────────────────────────────

  essai("UNE SESSION ANTÉRIEURE À LA COUPURE EST REFUSÉE", () => {
    assert.equal(sessionCoupee(1000, new Date(2_000_000)), true);
  });

  essai("une session ouverte APRÈS la coupure est valable", () => {
    // Le patron se déconnecte partout, puis se reconnecte : il doit entrer.
    assert.equal(sessionCoupee(3000, new Date(2_000_000)), false);
  });

  essai("sans coupure, rien n'est refusé", () => {
    assert.equal(sessionCoupee(1000, null), false);
  });

  essai("LE CONTOURNEMENT NE MARCHE PLUS — même après dix réémissions", () => {
    /**
     * Le parcours de l'attaquant, joué sur la règle : il vole un cookie, le
     * patron coupe, l'attaquant se fait réémettre autant qu'il veut.
     */
    const volee = marquerSession<MarquesSession>({}, true, 1000, tirages("VOLEE"));
    const coupure = new Date(2_000_000); // le patron coupe à t=2000 s
    let apres = volee;
    for (let i = 0; i < 10; i++) apres = marquerSession(apres, false, 5000 + i, tirages("X"));
    assert.equal(
      sessionCoupee(instantDAuthentification(apres), coupure),
      true,
      "LA SESSION VOLÉE EST REVENUE : la réémission l'a rajeunie"
    );
  });

  console.log("");
  console.log(`Identité de session — ${echecs} échec(s).`);
  process.exit(echecs > 0 ? 1 : 0);
}

main();
