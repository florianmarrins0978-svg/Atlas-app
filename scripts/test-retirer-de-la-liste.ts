import assert from "node:assert/strict";
import { retireDeLaListe, seRetireSansEffacer } from "../src/lib/chantier-etat";

// Retirer de la liste n'est pas supprimer : sa règle du 29 septembre 2026,
// *« ça ne doit pas impacter le lien cliquable envoyé au client »*.
//
// Ce qui est tenu, sans base : quelles lignes se retirent sans rien effacer,
// et quand une ligne retirée revient (la réponse du client, un nouvel envoi).

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

const RETRAIT = new Date("2026-09-29T10:00:00Z");
const AVANT = "2026-09-26T09:00:00Z";
const APRES = "2026-09-30T09:00:00Z";

console.log("=== Retirer de la liste sans effacer ===");

cas("seul un devis qui attend le client se retire sans effacer", () => {
  assert.equal(seRetireSansEffacer("devis_envoye"), true);
  assert.equal(seRetireSansEffacer("en_attente_client"), true);
  assert.equal(seRetireSansEffacer("a_relancer"), true);
  // Rien n'attend personne : la suppression reste ce qu'elle était.
  assert.equal(seRetireSansEffacer("brouillon"), false);
  assert.equal(seRetireSansEffacer("devis_pret"), false);
  assert.equal(seRetireSansEffacer("devis_caduc"), false);
  assert.equal(seRetireSansEffacer("devis_retourne"), false);
});

cas("retiré pendant qu'il attend, il est caché", () => {
  assert.equal(retireDeLaListe({ statut: "en_attente_client", retireDeLaListeAt: RETRAIT, envoiEnvoyeAt: AVANT }), true);
  assert.equal(retireDeLaListe({ statut: "a_relancer", retireDeLaListeAt: RETRAIT, envoiEnvoyeAt: AVANT }), true);
});

cas("jamais retiré, il se voit", () => {
  assert.equal(retireDeLaListe({ statut: "en_attente_client", retireDeLaListeAt: null, envoiEnvoyeAt: AVANT }), false);
});

cas("le client répond : la ligne revient, avec sa réponse", () => {
  assert.equal(retireDeLaListe({ statut: "devis_a_corriger", retireDeLaListeAt: RETRAIT, envoiEnvoyeAt: AVANT }), false);
  assert.equal(retireDeLaListe({ statut: "devis_retourne", retireDeLaListeAt: RETRAIT, envoiEnvoyeAt: AVANT }), false);
});

cas("un nouvel envoi parti après le retrait remet la ligne", () => {
  assert.equal(retireDeLaListe({ statut: "en_attente_client", retireDeLaListeAt: RETRAIT, envoiEnvoyeAt: APRES }), false);
});

if (echecs > 0) {
  console.error(`\n❌ ${echecs} cas en échec`);
  process.exit(1);
}
console.log("\n✅ Retirer de la liste n'efface rien, et la réponse du client ramène la ligne.");
