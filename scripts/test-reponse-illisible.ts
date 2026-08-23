import assert from "node:assert/strict";
import { estReponseIllisible, PHRASE_REPONSE_ILLISIBLE } from "../src/lib/reponse-illisible";

// **« An unexpected response was received from the server. »**
//
// Le patron, capture à l'appui le 12 août 2026 à 14 h 04 : un panneau rouge en
// anglais, une pile d'appel dans `node_modules`, et rien qui dise quoi faire.
//
// Ce que cette suite tient surtout, c'est le REFUS. Habiller en « le serveur se
// prépare » une erreur qui vient du code enverrait chercher au mauvais endroit
// — et c'est la faute que ce dépôt paie le plus cher (`AGENTS.md`). Une phrase
// rassurante posée sur un vrai défaut vaut moins que pas de phrase du tout.

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

console.log("=== Une réponse du serveur qu'on n'a pas pu lire ===");

cas("le message exact du panneau qu'il a photographié", () => {
  assert.ok(estReponseIllisible("An unexpected response was received from the server."));
});

cas("la casse ne compte pas — elle a déjà changé d'une version à l'autre", () => {
  assert.ok(estReponseIllisible("AN UNEXPECTED RESPONSE WAS RECEIVED FROM THE SERVER"));
  assert.ok(estReponseIllisible("an unexpected response was received from the server"));
});

cas("les autres façons dont la connexion se coupe en route", () => {
  assert.ok(estReponseIllisible("TypeError: Failed to fetch"), "Chrome");
  assert.ok(estReponseIllisible("NetworkError when attempting to fetch resource."), "Firefox");
  assert.ok(estReponseIllisible("Load failed"), "Safari — celui de son iPhone");
});

cas("un vrai défaut du code n'est JAMAIS habillé en attente", () => {
  // Chacun de ces messages, pris pour une lenteur de serveur, enverrait le
  // patron recharger une page qui ne guérira pas — et masquerait le défaut.
  for (const vrai of [
    "Cannot read properties of undefined (reading 'nom')",
    "chantier introuvable",
    "Invalid Server Actions request.",
    "permission denied for table devis",
    "Hydration failed because the server rendered HTML didn't match the client",
    "La coordonnée n'a pas pu être enregistrée. Réessayez.",
  ]) {
    assert.equal(estReponseIllisible(vrai), false, `« ${vrai} » a été pris pour une lenteur`);
  }
});

cas("ce qui n'est pas une chaîne ne fait rien apparaître", () => {
  // Une promesse peut être rejetée avec n'importe quoi. Le veilleur lit
  // `e.reason` tel quel : s'il trébuchait ici, il tomberait dans un écouteur
  // global, c'est-à-dire à l'endroit le plus difficile à diagnostiquer.
  for (const rien of [undefined, null, 0, {}, [], new Date(0)]) {
    assert.equal(estReponseIllisible(rien), false, `${String(rien)} a déclenché la phrase`);
  }
});

cas("la phrase dit le geste, et elle est en français", () => {
  assert.match(PHRASE_REPONSE_ILLISIBLE, /rechargez/i, "elle ne dit pas quoi faire");
  assert.ok(
    !/[a-z]/i.test(PHRASE_REPONSE_ILLISIBLE.replace(/[^\x20-\x7e]/g, "")) ||
      /serveur|Atlas|mise à jour/.test(PHRASE_REPONSE_ILLISIBLE),
    "elle doit parler d'Atlas et du serveur, pas d'un cadre technique"
  );
  assert.ok(
    !/error|failed|unexpected/i.test(PHRASE_REPONSE_ILLISIBLE),
    "elle recopie un mot du message anglais : c'est ce qu'on remplace"
  );
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} Réponse illisible — ${echecs} échec(s).`);
if (echecs > 0) process.exit(1);
