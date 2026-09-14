import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parleDUnEcran } from "./rappel-regarder-l-ecran.mjs";

/**
 * **Sa colère du 14 septembre 2026 :** *« ça arrive trop souvent que tu me
 * donnes une info fausse parce que t'es pas vraiment allé regarder les écrans
 * de l'appli ! »*
 *
 * Comme `rappel-panne.mjs`, ce déclencheur doit parler quand il faut ET SE
 * TAIRE le reste du temps : un rappel qui parle à tort s'apprend à être ignoré,
 * et l'on perd alors le garde-fou sans s'en apercevoir. Cette suite lui montre
 * donc autant de messages à laisser passer qu'à relever.
 */

const RACINE = path.join(__dirname, "..");
const HOOK = path.join(__dirname, "rappel-regarder-l-ecran.mjs");

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

console.log("=== Il parle d'un écran : le rappel sort ===");

cas("ses vraies tournures, relevées de ses messages", () => {
  for (const message of [
    "Comment ça la page devis n'existe plus depuis le planning ?",
    "il est où le bouton créer une facture",
    "Où est passé le récapitulatif ?",
    "je vois plus mes chantiers sur l'écran",
    "pourquoi le bouton a disparu",
    "envoie moi une capture de l'écran réglages",
  ]) {
    assert.ok(parleDUnEcran(message), `laissé passer : « ${message} »`);
  }
});

console.log("\n=== Et il SE TAIT le reste du temps ===");

cas("une demande ordinaire ne déclenche rien", () => {
  for (const message of [
    "Pousse sur main",
    "Fait moi un recap que je peux copier coller",
    "corrige les rouges",
    "ok",
    "Diagnostic validé, tu peux corriger la migration 0087",
    "rajoute une règle dans le dépôt",
  ]) {
    assert.ok(!parleDUnEcran(message), `a parlé à tort sur : « ${message} »`);
  }
});

console.log("\n=== Le rappel dit la COMMANDE, pas seulement la règle ===");

cas("il donne « npm run voir », qui est le geste", () => {
  const sortie = execFileSync("node", [HOOK], {
    input: JSON.stringify({ prompt: "il est où le bouton du devis sur l'écran planning ?" }),
    encoding: "utf8",
    env: { ...process.env, CLAUDE_PROJECT_DIR: RACINE },
  });
  const contexte = JSON.parse(sortie).hookSpecificOutput.additionalContext as string;
  assert.match(contexte, /npm run voir/, "le rappel ne donne pas la commande : il se contente d'une consigne");
  assert.match(contexte, /grep/i, "le rappel ne dit pas ce qu'un grep ne prouve pas");
});

cas("et il ne rend RIEN sur un message ordinaire", () => {
  const sortie = execFileSync("node", [HOOK], {
    input: JSON.stringify({ prompt: "pousse sur main" }),
    encoding: "utf8",
    env: { ...process.env, CLAUDE_PROJECT_DIR: RACINE },
  });
  assert.equal(sortie.trim(), "", `le rappel a parlé à tort : ${sortie}`);
});

console.log("\n=== La commande qu'il nomme existe VRAIMENT ===");

cas("« npm run voir » est déclarée, et son script est là", () => {
  // La leçon du 28 août : ce qui n'est pas MONTÉ ne sert à rien. Un rappel qui
  // donnerait une commande inexistante serait pire que pas de rappel.
  const paquet = JSON.parse(readFileSync(path.join(RACINE, "package.json"), "utf8")) as {
    scripts: Record<string, string>;
  };
  assert.ok(paquet.scripts.voir, "le script npm « voir » n'existe pas");
  assert.match(paquet.scripts.voir, /voir-un-ecran/, "« npm run voir » ne mène pas au script qui regarde");
  readFileSync(path.join(RACINE, "scripts", "voir-un-ecran.mts"), "utf8");
});

cas("le déclencheur est branché dans .claude/settings.json", () => {
  const reglages = readFileSync(path.join(RACINE, ".claude", "settings.json"), "utf8");
  assert.match(
    reglages,
    /rappel-regarder-l-ecran\.mjs/,
    "le rappel n'est branché nulle part : il ne se déclenchera jamais"
  );
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} Regarder l'écran — ${echecs} échec(s).`);
if (echecs > 0) process.exit(1);
