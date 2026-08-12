import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// **« Remplace tous les boutons rectangulaires par les boutons arrondis. »**
// Le patron, le 12 août 2026 — après avoir vu, sur la feuille d'envoi de son
// devis, un bouton carré à côté d'une capsule.
//
// **Pourquoi un contrôle plutôt qu'un simple balayage.** Le balayage a été fait
// une fois ; il ne tiendra pas tout seul. Un écran neuf écrit dans six mois
// reprendra le `rounded-[4px]` du voisin — c'est exactement ce qui s'est passé :
// la capsule avait été posée sur `PrimaryButton` le 11 août, et trois écrans qui
// dessinaient leur bouton à la main ne l'ont jamais su. Le patron l'a vu avant
// nous.
//
// **Ce que ce contrôle NE dit pas.** Il ne demande pas d'employer
// `PrimaryButton` : deux boutons sont des `type="submit"` (connexion, documents
// légaux) et le composant partagé impose `type="button"`, ce qui casserait leur
// formulaire. Il ne juge que la FORME, qui est ce que le patron a demandé.
//
// **Et il ne touche pas aux plages.** Cartes, champs et tuiles gardent leurs
// 4 px : la charte les veut presque droits — « au-delà de 6 px, une plage
// devient un galet et l'écran perd sa tenue » (`ARCHITECTURE.md`). Seules les
// balises interactives sont regardées.

const RACINE = "src";

/** Un rayon rectangulaire posé sur un `<button>` ou un `<a>`. */
// Pas de drapeau `s` : la cible TypeScript du projet ne l'accepte pas, et il
// serait de toute façon inutile — une classe niée comme `[^>]` franchit déjà
// les retours à la ligne. Le typecheck l'a dit avant que quiconque ne le lise.
const RECTANGULAIRE = /<(?:button|a)\b[^>]*?rounded-\[(\d+)px\][^>]*>/g;

function fichiers(dossier: string): string[] {
  const sortie: string[] = [];
  for (const entree of readdirSync(dossier)) {
    const chemin = join(dossier, entree);
    if (statSync(chemin).isDirectory()) {
      // Les maquettes `/design/*` sont découplées du produit depuis le 1er août :
      // elles racontent un chemin, elles ne sont pas des écrans du patron.
      if (entree === "design") continue;
      sortie.push(...fichiers(chemin));
    } else if (chemin.endsWith(".tsx")) {
      sortie.push(chemin);
    }
  }
  return sortie;
}

function main() {
  console.log("=== Tous les boutons sont arrondis ===\n");

  const coupables: string[] = [];
  for (const f of fichiers(RACINE)) {
    const t = readFileSync(f, "utf8");
    for (const m of t.matchAll(RECTANGULAIRE)) {
      const ligne = t.slice(0, m.index).split("\n").length;
      coupables.push(`${f}:${ligne} — rayon ${m[1]} px`);
    }
  }

  const nom = "aucun bouton du produit ne garde un rayon rectangulaire";
  try {
    assert.equal(
      coupables.length,
      0,
      `${coupables.length} bouton(s) rectangulaire(s) :\n    ${coupables.join("\n    ")}\n` +
        "  Le patron a demandé la même forme partout le 12 août 2026. Employez " +
        "`rounded-full`, ou `PrimaryButton` quand ce n'est pas un bouton de formulaire."
    );
    console.log(`  ✓ ${nom}`);
  } catch (err) {
    console.error(`  ✗ ${nom}`);
    console.error(`    ${err instanceof Error ? err.message : err}`);
    console.log("\n❌ Boutons arrondis — 1 échec.");
    process.exit(1);
  }

  // **Le contrôle doit savoir ce qu'il compte.** Un motif qui ne trouverait
  // plus rien — parce qu'on aurait changé la façon d'écrire les classes —
  // passerait au vert sur une application entièrement carrée. On vérifie donc
  // qu'il sait encore reconnaître un bouton rectangulaire quand on lui en
  // montre un.
  const temoin = '<button className="rounded-[4px] py-3">Essai</button>';
  const reconnait = [...temoin.matchAll(RECTANGULAIRE)].length === 1;
  const nom2 = "le motif reconnaît encore un bouton rectangulaire (témoin)";
  assert.ok(
    reconnait,
    "Le motif ne reconnaît plus un bouton rectangulaire : ce contrôle passerait au vert quoi qu'il arrive."
  );
  console.log(`  ✓ ${nom2}`);

  console.log("\n✅ Boutons arrondis — 0 échec.");
}

main();
