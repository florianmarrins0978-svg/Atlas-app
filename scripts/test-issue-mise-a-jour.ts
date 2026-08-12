import assert from "node:assert/strict";
import { issueApresMiseAJour } from "../src/lib/issue-mise-a-jour";

// **« J'ai relancé le banc, j'ai essayé, ça ne marche pas. »**
//
// Le patron, le 11 août 2026 au soir, après une livraison. Le code neuf était
// bien tiré — la ligne Version affichait le commit neuf — et l'écran servi
// restait l'ancien. Il pouvait recharger cent fois.
//
// La cause tient en une phrase : **`next start` sert un dossier BÂTI, figé à la
// seconde de sa construction.** Le message, lui, promettait « rechargez la
// page, l'application se recompile » : vrai en développement, faux sur la
// version rapide.
//
// C'est la troisième fois que ce dépôt paie le même malentendu — *le produit
// paraît cassé alors qu'il est simplement vieux*. Les deux premières ont donné
// la ligne Version, puis le bouton « Chercher les dernières corrections ».
//
// Ce que cette suite tient :
//
//   1. en développement, la phrase d'origine reste — elle était exacte ;
//   2. sur la version bâtie, on ne promet plus une recompilation qui n'aura
//      pas lieu ;
//   3. **on ne coupe le serveur que si un veilleur le relèvera.** Sans lui, le
//      remède éteindrait l'application du patron pour lui livrer un correctif.

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

console.log("=== Ce qu'on annonce après avoir tiré du code neuf ===\n");

cas("en développement : la phrase d'origine, et rien n'est coupé", () => {
  const r = issueApresMiseAJour({
    versionBatie: false,
    veilleurPresent: true,
    suffixeVersion: " · c35be23",
  });
  assert.equal(r.couperLeServeur, false, "on couperait un serveur qui se recompile tout seul");
  assert.match(r.message, /se recompile/, "la phrase exacte du mode développement a disparu");
  assert.match(r.message, /c35be23/, "la version n'est pas rappelée : c'est elle qui prouve la mise à jour");
});

cas("version bâtie, veilleur présent : on reconstruit, et on le dit", () => {
  const r = issueApresMiseAJour({
    versionBatie: true,
    veilleurPresent: true,
    suffixeVersion: " · c35be23",
  });
  assert.equal(r.couperLeServeur, true, "le code neuf ne sera jamais servi : la version bâtie est figée");
  assert.doesNotMatch(
    r.message,
    /se recompile/,
    "on promet encore une recompilation que la version bâtie ne fera jamais"
  );
  assert.match(r.message, /reconstruit/, "on ne dit pas ce qui va se passer");
  assert.match(
    r.message,
    /injoignable/,
    "on ne prévient pas que l'application va disparaître une minute : il la croirait plantée"
  );
});

cas("version bâtie, aucun veilleur : on ne coupe RIEN", () => {
  const r = issueApresMiseAJour({
    versionBatie: true,
    veilleurPresent: false,
    suffixeVersion: " · c35be23",
  });
  assert.equal(
    r.couperLeServeur,
    false,
    "on couperait l'application du patron sans personne pour la relever : il resterait devant un écran mort"
  );
  assert.doesNotMatch(r.message, /se recompile/, "promesse impossible sur une version bâtie");
  assert.match(
    r.message,
    /rouvrez l'espace/,
    "on ne dit pas le seul geste qui reste : rouvrir l'espace de travail"
  );
});

cas("le suffixe de version est toujours repris, quel que soit le cas", () => {
  for (const versionBatie of [false, true]) {
    for (const veilleurPresent of [false, true]) {
      const r = issueApresMiseAJour({ versionBatie, veilleurPresent, suffixeVersion: " · abc1234" });
      assert.match(
        r.message,
        /abc1234/,
        `la version manque (bâtie=${versionBatie}, veilleur=${veilleurPresent}) — c'est elle qui prouve la mise à jour`
      );
    }
  }
});

cas("sans version connue, le message reste une phrase lisible", () => {
  const r = issueApresMiseAJour({ versionBatie: true, veilleurPresent: true, suffixeVersion: "" });
  assert.doesNotMatch(r.message, /\s\./, "une ponctuation orpheline traîne là où la version manquait");
  assert.ok(r.message.length > 40, "le message s'est effondré quand le dépôt n'a pas répondu");
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} Issue de la mise à jour — ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
