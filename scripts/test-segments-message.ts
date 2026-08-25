import assert from "node:assert/strict";
import { segmentsDuModele } from "../src/lib/segments-message";

// Découper son message en texte modifiable et pastilles verrouillées (« les
// mots en doré », 25 août 2026). La règle est pure : la concaténation des
// morceaux doit TOUJOURS redonner le modèle d'origine, sinon l'éditeur
// enregistrerait autre chose que ce qu'il montre.

let echecs = 0;
function cas(nom: string, f: () => void) {
  try {
    f();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

const recompose = (m: string) => segmentsDuModele(m).map((s) => s.valeur).join("");

console.log("=== Découper le message en morceaux ===\n");

cas("le message par défaut se recompose à l'identique", () => {
  const modele = "Bonjour [client],\n\n[document]\n\n[lien]\n\nBien à vous,\n[entreprise]";
  assert.equal(recompose(modele), modele);
});

cas("chaque pastille est repérée comme telle, le reste comme texte", () => {
  const segs = segmentsDuModele("Salut [client] !");
  assert.deepEqual(segs, [
    { type: "texte", valeur: "Salut " },
    { type: "jeton", valeur: "[client]" },
    { type: "texte", valeur: " !" },
  ]);
});

cas("deux pastilles collées ne fusionnent pas", () => {
  const segs = segmentsDuModele("[client][lien]");
  assert.deepEqual(segs, [
    { type: "jeton", valeur: "[client]" },
    { type: "jeton", valeur: "[lien]" },
  ]);
});

cas("un texte sans pastille reste un seul morceau", () => {
  assert.deepEqual(segmentsDuModele("Merci et à bientôt"), [
    { type: "texte", valeur: "Merci et à bientôt" },
  ]);
});

cas("une pastille inconnue n'en est pas une : elle reste du texte", () => {
  // « [prix] » n'est pas une pastille remplie par Atlas : elle partirait telle
  // quelle chez le client, donc elle se traite comme du texte ordinaire.
  assert.deepEqual(segmentsDuModele("Total [prix]"), [{ type: "texte", valeur: "Total [prix]" }]);
});

cas("les retours à la ligne restent dans le texte", () => {
  const segs = segmentsDuModele("a\n\nb");
  assert.deepEqual(segs, [{ type: "texte", valeur: "a\n\nb" }]);
});

if (echecs > 0) {
  console.error(`\n❌ ${echecs} échec(s).`);
  process.exit(1);
}
console.log("\n✅ Découpe du message — 0 échec(s).");
