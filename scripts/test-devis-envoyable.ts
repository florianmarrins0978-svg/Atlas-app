import assert from "node:assert/strict";
import { devisEnvoyable, MOTIF_DEVIS_VIDE } from "../src/lib/devis-envoyable";

/**
 * **Son défaut du 23 août 2026 :** *« le devis part à zéro euro chez la
 * cliente, alors qu'il y a un arbre à tailler et un à démonter. Rien
 * n'apparaît chez elle. »*
 */
let ok = 0;
let ko = 0;
function cas(nom: string, f: () => void) {
  try {
    f();
    console.log(`  ✓ ${nom}`);
    ok++;
  } catch (e) {
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
    ko++;
  }
}

console.log("=== Un devis vide ne part pas ===\n");

cas("SON CAS : aucune ligne, l'envoi est refusé", () => {
  assert.equal(devisEnvoyable({ nombreLignes: 0 }), "devis_vide");
});

cas("une ligne suffit à laisser passer", () => {
  assert.equal(devisEnvoyable({ nombreLignes: 1 }), null);
});

cas("un devis à ZÉRO EURO passe, s'il porte une ligne", () => {
  // **Un geste commercial est son droit** : déplacement offert, taille
  // gracieuse. La barrière porte sur ce qui est ÉCRIT, jamais sur ce qui est
  // compté — refuser un devis gratuit lui interdirait quelque chose de
  // parfaitement légitime (`CLAUDE.md` §4 : ne rien inventer).
  assert.equal(devisEnvoyable({ nombreLignes: 2 }), null);
});

cas("l'absence de devis garde son propre motif, plus ancien", () => {
  // Sans quoi deux règles diraient la même chose de deux façons, et l'écran
  // afficherait le mauvais message — celui qui envoie poser des prix sur un
  // chantier qui n'a même pas de devis.
  assert.equal(devisEnvoyable(null), null);
});

cas("le refus nomme la porte suivante", () => {
  assert.match(MOTIF_DEVIS_VIDE, /prix/i, "il ne dit pas où aller : « poser vos prix »");
  assert.match(MOTIF_DEVIS_VIDE, /vide|aucune ligne/i, "il ne dit pas ce qui cloche");
});

console.log(`\n${ok} réussis, ${ko} échecs`);
if (ko > 0) process.exit(1);
