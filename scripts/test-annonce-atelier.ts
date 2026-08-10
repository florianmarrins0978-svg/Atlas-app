import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { avertissementAtelier } from "./annonce-atelier.mjs";

// **La lenteur du mode développement, dite au lieu d'être subie.**
//
// Le 10 août 2026, le patron a tapé `npm run essai` dans son espace GitHub et
// regardé « toujours en compilation » pendant plus de trois minutes, sur la plus
// petite route du dépôt. Rien n'était cassé : c'est l'atelier, qui compile
// chaque écran à l'ouverture, sur un disque distant lent. Chaque écran suivant
// lui aurait coûté la même attente.
//
// Troisième fois que cette lenteur lui coûte une soirée — et les deux premières
// avaient précisément produit `npm run banc`. Le dépôt savait, et se taisait.
//
// Ce que cette suite tient :
//
//   1. l'avertissement nomme la commande qui règle vraiment le problème — un
//      avertissement qui décrit la panne sans donner la sortie ne sert à rien ;
//   2. il ne se déclenche QUE sur un espace distant : en local, `next dev`
//      compile en quelques centaines de millisecondes et le rechargement à
//      chaud est ce qu'on veut. Détourner vers le banc y serait un mauvais
//      conseil, et un mauvais conseil coûte plus cher que le silence ;
//   3. `essai.mjs` l'affiche réellement — un message juste que personne
//      n'imprime ne prévient personne.

const ESSAI = path.join(__dirname, "essai.mjs");

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

console.log("=== L'atelier se dit, au lieu de faire attendre ===\n");

cas("hors d'un espace distant, on ne dit rien", () => {
  assert.equal(
    avertissementAtelier({}),
    null,
    "en local, l'atelier est le bon outil : l'en détourner serait un mauvais conseil"
  );
});

cas("sur un espace distant, la sortie est nommée — pas seulement la panne", () => {
  const texte = avertissementAtelier({ CODESPACE_NAME: "reimagined-space-yodel" });
  assert.ok(texte, "aucun avertissement sur un espace distant");
  assert.match(texte, /npm run banc/, "l'avertissement ne donne pas la commande qui règle le problème");
  assert.match(texte, /ATELIER/, "l'avertissement ne dit pas ce qui a été lancé");
});

cas("essai.mjs l'affiche vraiment", () => {
  // Commentaires retirés : un commentaire qui nomme la fonction ne l'appelle
  // pas, et c'est exactement ainsi qu'un contrôle voisin est resté vert sur du
  // code amputé (voir `scripts/test-ouvrir-port.ts`).
  const code = readFileSync(ESSAI, "utf8")
    .split("\n")
    .filter((l) => !l.trimStart().startsWith("//"))
    .join("\n");
  assert.match(code, /import\s*\{\s*avertissementAtelier\s*\}/, "essai.mjs n'importe pas l'avertissement");
  assert.match(code, /avertissementAtelier\(\)/, "essai.mjs ne l'appelle pas");
  assert.match(code, /console\.log\(AVERTISSEMENT_ATELIER\)/, "essai.mjs ne l'imprime pas");
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} Annonce de l'atelier — ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
