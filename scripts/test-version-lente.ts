import assert from "node:assert/strict";
import { panneauVersionLente } from "../src/lib/version-lente";

// **Ce que le panneau « version lente » a le droit de promettre.**
//
// Le 20 août 2026 au soir, le patron : *« L'application est lente, corrige
// ça. »* puis, en regardant Réglages : *« Si il y a marqué version lente. »*
// L'écran disait donc vrai — et terminait par « la version rapide prend le
// relais dès que la construction aboutit ». Elle n'allait pas aboutir : son
// veilleur était tombé, et c'est lui qui construit. Il a attendu, puis il a
// redemandé.
//
// **Ce que cette suite tient, et qui n'est pas une formulation :** on ne dit
// « ça vient tout seul » QUE lorsque quelqu'un travaille vraiment à la version
// rapide. Sabotée — en rendant la phrase d'avant dans les trois cas — elle rend
// deux rouges.

let echecs = 0;
function cas(nom: string, verifier: () => void): void {
  try {
    verifier();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

console.log("=== Le panneau « version lente » ===\n");

cas("veilleur en place : on lui dit d'attendre, et rien d'autre", () => {
  const p = panneauVersionLente({ veilleurPresent: true, constructionEchouee: false });
  assert.equal(p.gesteAttendu, false, "aucun geste ne lui est demandé tant que ça construit");
  assert.match(p.phrase, /prend le relais/);
});

// Le cas de sa soirée, et le seul qui appelle un geste.
cas("veilleur tombé : on ne promet RIEN, on dit quoi faire", () => {
  const p = panneauVersionLente({ veilleurPresent: false, constructionEchouee: false });
  assert.equal(p.gesteAttendu, true, "personne ne construit : il doit rallumer son espace");
  assert.doesNotMatch(
    p.phrase,
    /prend le relais|dès que la construction aboutit/,
    "l'écran promet une version rapide que personne ne construit — c'est ce qui l'a fait attendre pour rien"
  );
  assert.match(p.phrase, /rouvrez votre espace de travail/);
});

cas("veilleur tombé APRÈS un échec : le geste prime sur le récit de l'échec", () => {
  const p = panneauVersionLente({ veilleurPresent: false, constructionEchouee: true });
  assert.equal(p.gesteAttendu, true);
  assert.match(p.phrase, /rouvrez votre espace de travail/);
});

cas("construction tombée, veilleur là : il retente, on ne l'envoie pas rallumer pour rien", () => {
  const p = panneauVersionLente({ veilleurPresent: true, constructionEchouee: true });
  assert.equal(p.gesteAttendu, false, "le veilleur retente tout seul : ce n'est pas un geste dû");
  assert.match(p.phrase, /retentée toute seule/);
  // Mais on ne lui cache pas que c'est long — une demi-heure d'attente muette
  // se lit comme une panne.
  assert.match(p.phrase, /demi-heure|répare plus vite/);
});

cas("dans tous les cas, il sait pourquoi ses écrans sont lents", () => {
  for (const veilleurPresent of [true, false]) {
    for (const constructionEchouee of [true, false]) {
      const p = panneauVersionLente({ veilleurPresent, constructionEchouee });
      assert.match(p.phrase, /une minute la première fois/, JSON.stringify({ veilleurPresent, constructionEchouee }));
      assert.ok(p.phrase.length > 80, "une phrase trop courte n'explique plus rien");
    }
  }
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
