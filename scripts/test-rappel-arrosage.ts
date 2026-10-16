// Un message qui parle d'arrosage : le rappel part-il, et se tait-il quand il le doit ?
//
// **Ce contrôle garde un garde-fou.** Depuis le 16 octobre 2026, les règles
// d'arrosage ne se chargent qu'à l'ouverture d'un fichier d'arrosage
// (`ARCHITECTURE.md` §465). Le déclencheur les fait lire dès le message, pour
// qu'une planche neuve ne se dessine jamais sans elles.
//
// Deux façons de le perdre, et ces cas tiennent les deux bouts :
//
//  - **Il se tait quand il faut parler** : une de ses phrases n'est plus
//    reconnue, et la planche part sans ses règles.
//  - **Il parle quand il faut se taire** : il se déclenche sur la fiche de
//    sécurité, une facture ou une blague, et finit ignoré.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { parleDArrosage, RAPPEL } from "./rappel-arrosage.mjs";

let echecs = 0;
function cas(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.log(`  ✗ ${nom}`);
    console.log(`    ${(e as Error).message}`);
  }
}

console.log("=== Le rappel des règles d'arrosage ===");

cas("les phrases QU'IL A RÉELLEMENT ÉCRITES déclenchent le rappel", () => {
  // Toutes citées dans `.claude/rules/arrosage.md`, relevées de ses messages
  // des 21 et 22 août 2026. Une phrase inventée prouverait que le contrôle
  // passe, pas qu'il sera entendu.
  const siennes = [
    "c'est l'utilisateur qui placera la nourrice où il veut",
    "ne prends pas en compte la pluviométrie",
    "il y a quatre arroseurs qui ne sont pas alimentés",
    "où sont les pièces pour la nourrice 3 voies ?",
    "un arroseur de trop fait que le réseau ne peut pas se lever !",
    "il m'a déjà donné 4 arroseurs en 5004 buse 3 sur un seul réseau avec 3 bar et du Ø25 — est-ce correct ?",
    "passé un certain nombre de mètres linéaires, il faut passer du PEHD Ø25 à celui en Ø32 ; j'aimerais que mon outil arrosage puisse faire la même chose",
  ];
  for (const phrase of siennes) {
    assert.ok(parleDArrosage(phrase), `« ${phrase} » ne déclenche rien : la planche partira sans ses règles`);
  }
});

cas("les hasards de la dictée ne font pas rater le rappel", () => {
  assert.ok(parleDArrosage("FAIS MOI UNE PLANCHE D'ARROSAGE"), "les majuscules font rater le rappel");
  assert.ok(parleDArrosage("la tuyère du couloir"), "un accent fait rater le rappel");
  assert.ok(parleDArrosage("les électrovannes en 9 V"), "un pluriel accentué fait rater le rappel");
});

cas("une demande ORDINAIRE ne déclenche rien", () => {
  // Les premières viennent de ses messages du 13 au 16 octobre 2026. La
  // fiche de sécurité porte un CROQUIS : c'est le faux positif le plus probable.
  const ordinaires = [
    "regarde Kleyk dans mon Chrome et compare avec notre fiche de sécurité",
    "Combien de ligne de code comporte lappli ?",
    "Oui vas-y, lance le découpage du planning, mais prend ton temps vérifie chaque chose je veux aucun bug",
    "le croquis de la fiche de sécurité ne s'affiche pas",
    "ajoute une ligne de débit sur la facture",
    "tu abuses, ça fait trois fois que je le demande",
    "Ajoute une colonne au planning",
  ];
  for (const phrase of ordinaires) {
    assert.ok(!parleDArrosage(phrase), `« ${phrase} » déclenche le rappel à tort : à ce rythme il sera ignoré`);
  }
});

cas("le rappel DIT quel fichier lire, et l'essentiel en attendant", () => {
  assert.match(RAPPEL, /\.claude\/rules\/arrosage\.md/, "le rappel ne nomme plus le fichier des règles");
  assert.match(RAPPEL, /nourrice/, "le rappel ne dit plus que la nourrice se place par lui");
  assert.match(RAPPEL, /arrosage-catalogue\.js/, "le rappel ne dit plus d'où viennent les libellés");
});

cas("le fichier que le rappel nomme EXISTE, et se charge sur les fichiers d'arrosage", () => {
  // Un rappel qui envoie lire un fichier disparu est pire que pas de rappel :
  // la session cherche, ne trouve pas, et suppose.
  const regles = readFileSync(".claude/rules/arrosage.md", "utf8");
  assert.match(regles, /^---\npaths:\n(?:\s+- "[^"]+"\n)+---/, "l'en-tête paths: a disparu : les règles ne se chargent plus seules");
  assert.match(regles, /"\*\*\/\*arrosage\*"/, "les fichiers d'arrosage ne chargent plus les règles");
  assert.match(regles, /## 4 ter\. L'ARROSAGE N'A PAS LE DROIT À L'ERREUR/, "les règles d'arrosage ne sont plus dans le fichier nommé");
});

cas("le déclencheur est bel et bien CÂBLÉ dans les réglages", () => {
  const reglages = JSON.parse(readFileSync(".claude/settings.json", "utf8")) as {
    hooks?: { UserPromptSubmit?: { hooks?: { type?: string; command?: string }[] }[] };
  };
  const commandes = (reglages.hooks?.UserPromptSubmit ?? []).flatMap((e) => e.hooks ?? []);
  assert.ok(
    commandes.some((c) => c.type === "command" && (c.command ?? "").includes("rappel-arrosage.mjs")),
    "`.claude/settings.json` n'appelle plus `rappel-arrosage.mjs` : le rappel ne partira jamais"
  );
});

cas("appelé pour de vrai, il rend le contexte attendu", () => {
  const r = spawnSync(process.execPath, ["scripts/rappel-arrosage.mjs"], {
    input: JSON.stringify({ prompt: "fais-moi une planche pour placer les arroseurs" }),
    encoding: "utf8",
  });
  assert.equal(r.status, 0, `le déclencheur sort en erreur : ${r.stderr}`);
  const sortie = JSON.parse(r.stdout) as {
    hookSpecificOutput?: { hookEventName?: string; additionalContext?: string };
  };
  assert.equal(sortie.hookSpecificOutput?.hookEventName, "UserPromptSubmit", "Claude Code ignorera la sortie");
  assert.match(sortie.hookSpecificOutput?.additionalContext ?? "", /arrosage\.md/, "le contexte ajouté ne porte pas le rappel");
});

cas("une demande ordinaire ne fait rien SORTIR, et une entrée illisible non plus", () => {
  for (const entree of [JSON.stringify({ prompt: "Ajoute une colonne au planning" }), "pas du json"]) {
    const r = spawnSync(process.execPath, ["scripts/rappel-arrosage.mjs"], { input: entree, encoding: "utf8" });
    assert.equal(r.status, 0, `le déclencheur sort en erreur : ${r.stderr}`);
    assert.equal(r.stdout, "", "le déclencheur parle alors qu'il devait se taire");
  }
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} Le rappel des règles d'arrosage — ${echecs} échec(s).`);
process.exit(echecs === 0 ? 0 : 1);
