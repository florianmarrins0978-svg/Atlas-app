import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

// **Sa panne du 29 août 2026 au soir, et le contrôle qui l'empêche de revenir.**
//
// Sa fiche publiait le relevé de l'échec, et il tient en cinq lignes :
//
//     code: 1
//     memoire: Mem: 7.8Gi  used 2.1Gi  available 5.7Gi
//     dit:
//     ▲ Next.js 16.3.3 (Turbopack)
//     - Environments: .env.local
//
// **La mémoire n'y était pour rien** — 5,7 Go libres. Il exécutait Next 16.3.3
// alors que le projet épingle 16.3.2, dans `package.json` comme dans le verrou.
// Next embarque des binaires natifs versionnés à l'identique : le compilateur
// meurt à leur chargement, après l'en-tête, sans un mot.
//
// **Et son banc ne pouvait pas s'en sortir** : sa réinstallation automatique
// exige `Cannot find module` dans la sortie. Un paquet ABSENT la déclenche ; un
// paquet PRÉSENT MAIS DÉSACCORDÉ, non. Le veilleur retentait la même
// construction condamnée, indéfiniment.

import {
  versionEpinglee,
  dependancesIncoherentes,
  constructionMuette,
} from "./coherence-dependances.mjs";

let echecs = 0;
function verifier(intitule: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ ${intitule}`);
  } catch (err) {
    echecs++;
    console.error(`❌ ${intitule}`);
    console.error(`   ${(err as Error).message}`);
  }
}

// --- 1. Son cas, avec ses chiffres ---------------------------------------

verifier("SON désaccord est vu : Next 16.3.3 installé, 16.3.2 exigé", () => {
  const { incoherent, motif } = dependancesIncoherentes([
    { nom: "next", exigee: "16.3.2", installee: "16.3.3" },
  ]);
  assert.equal(incoherent, true, "c'est exactement ce qui tuait sa construction");
  assert.match(motif ?? "", /16\.3\.3/, "la version fautive doit être nommée");
  assert.match(motif ?? "", /16\.3\.2/, "celle qu'on attend aussi");
});

verifier("des versions accordées ne déclenchent RIEN", () => {
  const { incoherent, motif } = dependancesIncoherentes([
    { nom: "next", exigee: "16.3.2", installee: "16.3.2" },
    { nom: "eslint-config-next", exigee: "16.3.2", installee: "16.3.2" },
  ]);
  assert.equal(incoherent, false, "réinstaller un espace sain coûterait des minutes à chaque démarrage");
  assert.equal(motif, null);
});

// --- 2. On ne conclut que sur ce qu'on SAIT ------------------------------

verifier("un intervalle de versions n'est pas une incohérence", () => {
  // `^16.3.2` autorise délibérément 16.3.3 : s'en plaindre ferait réinstaller
  // en boucle un projet parfaitement normal.
  assert.equal(versionEpinglee({ dependencies: { next: "^16.3.2" } }, "next"), null);
  assert.equal(versionEpinglee({ dependencies: { next: "~16.3.2" } }, "next"), null);
  assert.equal(versionEpinglee({ dependencies: { next: ">=16" } }, "next"), null);
  assert.equal(versionEpinglee({ dependencies: { next: "16.3.2" } }, "next"), "16.3.2");
});

verifier("une version épinglée se lit aussi dans devDependencies", () => {
  assert.equal(versionEpinglee({ devDependencies: { "eslint-config-next": "16.3.2" } }, "eslint-config-next"), "16.3.2");
});

verifier("un paquet absent ou illisible n'accuse personne", () => {
  assert.equal(dependancesIncoherentes([{ nom: "next", exigee: "16.3.2", installee: null }]).incoherent, false);
  assert.equal(dependancesIncoherentes([{ nom: "next", exigee: null, installee: "16.3.3" }]).incoherent, false);
  assert.equal(versionEpinglee(null, "next"), null);
  assert.equal(versionEpinglee({}, "next"), null);
});

// --- 3. Le second filet : une construction morte sans rien dire ----------

verifier("SA sortie du 29 août est reconnue comme muette", () => {
  const sortie = "▲ Next.js 16.3.3 (Turbopack)\n- Environments: .env.local";
  assert.equal(constructionMuette({ code: 1, sortie }), true);
});

verifier("une VRAIE erreur de compilation n'est pas muette", () => {
  const sortie = "▲ Next.js 16.3.2\nType error: Property 'libelle' does not exist.";
  assert.equal(
    constructionMuette({ code: 1, sortie }),
    false,
    "réinstaller ne répare pas une faute de frappe — et ferait perdre des minutes"
  );
});

verifier("une sortie courte QUI PARLE d'une erreur n'est pas muette", () => {
  assert.equal(constructionMuette({ code: 1, sortie: "Error: something" }), false);
  assert.equal(constructionMuette({ code: 1, sortie: "Cannot find module 'x'" }), false);
  assert.equal(constructionMuette({ code: 1, sortie: "Échec de la compilation" }), false);
});

verifier("une construction RÉUSSIE n'est jamais muette", () => {
  assert.equal(constructionMuette({ code: 0, sortie: "" }), false, "un succès ne se réinstalle pas");
});

verifier("une sortie longue n'est pas muette, même sans mot d'erreur", () => {
  const longue = Array.from({ length: 12 }, (_, i) => `ligne ${i}`).join("\n");
  assert.equal(constructionMuette({ code: 1, sortie: longue }), false);
});

// --- 4. Est-ce BRANCHÉ ? -------------------------------------------------
//
// Une règle juste que personne n'appelle ne répare rien : ce dépôt l'a déjà
// payé (le rappel `avancer` de `prechauffer.mjs`, jamais passé pendant cinq
// jours). Ces contrôles lisent le banc.
const BANC = readFileSync(path.join(__dirname, "banc.mjs"), "utf8");

verifier("le banc vérifie les dépendances AVANT de bâtir", () => {
  const garde = BANC.indexOf("await reinstallerSiDesaccordees()");
  const build = BANC.indexOf('jouerEnRetenant("npx", ["next", "build"]');
  assert.ok(garde > 0, "la vérification a disparu de banc.mjs");
  assert.ok(build > 0, "garde-fou de lecture : la construction a changé de forme");
  assert.ok(
    garde < build,
    "vérifier APRÈS la construction ne sert à rien : elle est déjà morte, et sans rien dire"
  );
});

verifier("une construction muette déclenche aussi la réinstallation", () => {
  assert.match(
    BANC,
    /const morteSansRienDire = constructionMuette\(/,
    "le second filet a disparu : un node_modules abîmé sans écart de version ne serait plus rattrapé"
  );
  assert.match(
    BANC,
    /if \(dependanceManquante \|\| morteSansRienDire\)/,
    "le filet est calculé mais pas utilisé — il ne sert alors à personne"
  );
});

// --- 5. Le projet lui-même est-il cohérent ? -----------------------------

verifier("le dépôt épingle bien Next, sinon ce contrôle ne protège rien", () => {
  const paquet = JSON.parse(readFileSync(path.join(__dirname, "..", "package.json"), "utf8"));
  assert.ok(
    versionEpinglee(paquet, "next"),
    "Next n'est plus épinglé à une version exacte : la comparaison ne peut plus rien voir, " +
      "et la panne du 29 août redeviendrait invisible"
  );
});

console.log(
  echecs === 0
    ? "\n✅ Cohérence des dépendances : toutes les vérifications passent.\n"
    : `\n❌ ${echecs} vérification(s) en échec.\n`
);
process.exit(echecs === 0 ? 0 : 1);
