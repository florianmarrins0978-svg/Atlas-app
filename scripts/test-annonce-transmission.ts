import assert from "node:assert/strict";
import { annonceTransmission } from "../src/lib/annonce-transmission";

// **« Il faut que la page se remette sur la première page automatiquement,
// avec un petit message. »** — le patron, le 7 août 2026.
//
// Deux formulations lui ont été proposées, et il a choisi la seconde :
//
//   A. « Devis envoyé à Mr Cuisseau »
//   B. « Devis transmis à Mr Cuisseau — en attente de sa réponse »
//
// *« Oui la B. »* — et c'est la seule des deux qui reste vraie : Atlas ouvre la
// messagerie, mais ne voit pas ce qui s'y passe. Le patron a pu changer d'avis
// et revenir. Écrire « envoyé » serait affirmer ce qu'on n'a pas vu.
//
// Ce que cette suite tient : **un devis attend une réponse, une facture non.**
// Le distinguer n'est pas une coquetterie de langue — laisser « en attente de
// sa réponse » sur une facture ferait attendre au patron une réponse qui ne
// viendra jamais, et relancer un client qui n'a rien à répondre.

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

console.log("=== Le devis attend une réponse ===");

cas("la phrase nomme le client et dit ce qui suit", () => {
  const phrase = annonceTransmission({ quoi: "devis", client: "Mr Cuisseau" });
  assert.equal(phrase, "Devis transmis à Mr Cuisseau — en attente de sa réponse.");
});

cas("« transmis », jamais « envoyé »", () => {
  // La distinction qui a été choisie explicitement : Atlas n'a pas vu partir le
  // message, il a seulement ouvert la messagerie.
  const phrase = annonceTransmission({ quoi: "devis", client: "M. Bernard" });
  assert.doesNotMatch(
    phrase,
    /envoyé/i,
    `« ${phrase} » affirme un envoi qu'aucun contrôle n'a constaté : le patron a pu annuler dans sa messagerie.`
  );
});

console.log("\n=== La facture n'attend pas de réponse ===");

cas("aucune attente de réponse sur une facture", () => {
  const phrase = annonceTransmission({ quoi: "facture", client: "Mr Cuisseau" });
  assert.equal(phrase, "Facture transmise à Mr Cuisseau.");
  assert.doesNotMatch(
    phrase,
    /réponse/i,
    `« ${phrase} » ferait attendre au patron une réponse qui ne viendra jamais, et relancer un client qui n'a rien à répondre.`
  );
});

cas("l'accord suit le document", () => {
  // « Facture transmis » est le genre de faute que le patron relève, et il a
  // raison : c'est ce qui fait la différence entre un outil et un brouillon.
  assert.match(annonceTransmission({ quoi: "facture", client: "X" }), /Facture transmise/);
  assert.match(annonceTransmission({ quoi: "devis", client: "X" }), /Devis transmis /);
});

console.log("\n=== Sans nom de client, on ne fabrique personne ===");

for (const [nom, client] of [
  ["client absent", ""],
  ["client réduit à des espaces", "   "],
] as const) {
  cas(`${nom} : la phrase reste vraie et complète`, () => {
    const devis = annonceTransmission({ quoi: "devis", client });
    const facture = annonceTransmission({ quoi: "facture", client });
    assert.equal(devis, "Devis transmis — en attente de sa réponse.");
    assert.equal(facture, "Facture transmise.");
    assert.doesNotMatch(devis, / à\s*(—|\.)/, `Une préposition pend dans le vide : « ${devis} »`);
    assert.doesNotMatch(facture, / à\s*\./, `Une préposition pend dans le vide : « ${facture} »`);
  });
}

cas("les espaces autour du nom ne se voient pas dans la phrase", () => {
  assert.equal(
    annonceTransmission({ quoi: "devis", client: "  Mme Aubry  " }),
    "Devis transmis à Mme Aubry — en attente de sa réponse."
  );
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} Annonce de transmission — ${echecs} échec(s).`);
if (echecs > 0) process.exit(1);
