import assert from "node:assert/strict";
import { LIMITES } from "../src/server/rate-limit/types";

// **« Mes parents entrent le bon identifiant et lisent : identifiant ou mot de
// passe incorrect. »**
//
// Le 6 août 2026, le patron donne l'adresse de l'application à ses parents pour
// qu'ils l'essaient. Le mot de passe était bon. Le message mentait, et pour deux
// raisons qui se cumulaient :
//
//   1. **le compteur de tentatives était tenu par email seul**, alors que le
//      banc d'essai partage un compte unique. Les essais du patron
//      s'additionnaient à ceux de ses parents : cinq en quinze minutes, tout le
//      monde bloqué — y compris ceux qui tapaient juste ;
//   2. **le message ne disait pas le blocage.** On préférait le taire pour ne
//      pas révéler qu'un email existe : protection dérisoire (celui qui martèle
//      un compte le sait déjà), payée d'un prix total — l'utilisateur légitime
//      recommence, ce que le message lui dit de faire, et s'enfonce.
//
// Cette suite tient les seuils. Le comportement de bout en bout — deux
// visiteurs, un seul bloqué, et le message qui dit d'attendre — est éprouvé par
// `test-connexion-limite-e2e.ts`, dans un vrai navigateur.

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

console.log("=== Les seuils de connexion ===");

cas("un visiteur a droit à quelques erreurs de frappe, pas à un martèlement", () => {
  assert.equal(LIMITES.connexion.max, 5);
  assert.equal(LIMITES.connexion.fenetreMs, 15 * 60 * 1000);
});

cas("le garde-fou par compte est LARGE — sinon il rebloquerait tout le monde", () => {
  // C'est le point qui a fait perdre la soirée du 6 août : un plafond serré sur
  // le compte partagé verrouille les visiteurs les uns après les autres.
  assert.ok(
    LIMITES.connexionParCompte.max >= 10 * LIMITES.connexion.max,
    `Plafond par compte trop serré (${LIMITES.connexionParCompte.max}) : il redeviendrait le goulot.`
  );
});

cas("aucune fenêtre n'enferme durablement : quinze minutes, pas davantage", () => {
  for (const [nom, limite] of Object.entries(LIMITES)) {
    assert.ok(
      limite.fenetreMs <= 15 * 60 * 1000,
      `${nom} enferme pendant ${limite.fenetreMs / 60000} minutes : un blocage long se vit comme une panne.`
    );
  }
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} Seuils de connexion — ${echecs} échec(s).`);
if (echecs > 0) process.exit(1);
