import assert from "node:assert/strict";
import { devisAPreparer } from "../src/lib/devis-a-preparer";

// **« Je dois cliquer sur Lucie, arriver directement sur la page du devis et
// que les infos déjà enregistrées. »** — le patron, 21 août 2026.
//
// Cette suite tient la règle qui décide si le devis doit se fabriquer tout seul
// en arrivant. Elle sait échouer : remettre `nombreDeLignes === 0` en
// `nombreDeLignes >= 0` rougit le troisième cas, et retirer la garde du devis
// envoyé rougit le quatrième.

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

console.log("=== Le devis se prépare-t-il tout seul ? ===\n");

cas("SON CAS : il a dicté, fermé l'application, et le devis est vide", () => {
  assert.equal(
    devisAPreparer({ aUneNoteVocale: true, nombreDeLignes: 0, statutDevis: "brouillon" }),
    true,
    "sa dictée resterait lettre morte, et il tomberait sur une feuille vide"
  );
});

cas("sans dictée, un devis vide est SON choix — on n'y touche pas", () => {
  // C'est le bouton « Je rédige mon devis » : il veut une feuille blanche, et
  // lancer une chaîne qui n'a rien à lire l'attendrait pour rien.
  assert.equal(devisAPreparer({ aUneNoteVocale: false, nombreDeLignes: 0, statutDevis: "brouillon" }), false);
});

cas("une seule ligne suffit à prouver que la chaîne a déjà tourné", () => {
  // La chaîne écrit toujours quelque chose quand elle aboutit — au pire les
  // prestations à 0 €, prix à poser (`devis-depuis-dictee.ts` §3 bis). Repartir
  // de la dictée écraserait alors ce qu'il vient peut-être de corriger.
  assert.equal(devisAPreparer({ aUneNoteVocale: true, nombreDeLignes: 1, statutDevis: "brouillon" }), false);
  assert.equal(devisAPreparer({ aUneNoteVocale: true, nombreDeLignes: 12, statutDevis: "brouillon" }), false);
});

cas("un devis PARTI ne se refabrique jamais", () => {
  // Le client a reçu ce document. Le réécrire derrière son dos donnerait deux
  // versions du même numéro — et c'est la version du client qui fait foi.
  assert.equal(devisAPreparer({ aUneNoteVocale: true, nombreDeLignes: 0, statutDevis: "envoye" }), false);
});

console.log(
  echecs === 0
    ? "\n✅ Le devis se prépare tout seul — 0 échec(s).\n"
    : `\n❌ Le devis se prépare tout seul — ${echecs} échec(s).\n`
);
process.exit(echecs === 0 ? 0 : 1);
