// Session du téléphone : le rappel du skill impeccable part-il, et seulement là ?
//
// **Ce contrôle garde sa demande du 22 octobre 2026** : les sessions ouvertes
// depuis son téléphone emploient le skill impeccable d'office ; celles de son
// PC, où il tape `/impeccable` lui-même, n'en reçoivent rien.
//
// Les deux façons de la perdre :
//  - **il se tait sur le téléphone** : la règle redevient une prose oubliée ;
//  - **il parle sur le PC** : il charge deux fois ce qu'il charge déjà, et
//    l'on apprend à ignorer le rappel.
// Le câblage se vérifie aussi, en jouant le vrai script avec son vrai contrat :
// un script juste que rien n'appelle ne protège personne.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { RAPPEL, sessionDuTelephone } from "./rappel-impeccable.mjs";

const SCRIPT = path.join(__dirname, "rappel-impeccable.mjs");

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

function jouer(entree: string | undefined) {
  const env = { ...process.env };
  if (entree === undefined) delete env.CLAUDE_CODE_ENTRYPOINT;
  else env.CLAUDE_CODE_ENTRYPOINT = entree;
  return spawnSync(process.execPath, [SCRIPT], {
    input: JSON.stringify({ prompt: "écris la migration des véhicules" }),
    env,
    encoding: "utf8",
  });
}

console.log("=== Le rappel « impeccable d'office » sur le téléphone ===");

cas("une session du téléphone le reçoit, quel que soit le message", () => {
  // Le message choisi n'a rien d'un écran : c'est le « peu importe le prompt ».
  const r = jouer("remote_mobile");
  assert.equal(r.status, 0);
  const sortie = JSON.parse(r.stdout);
  assert.equal(sortie.hookSpecificOutput.hookEventName, "UserPromptSubmit");
  assert.ok(sortie.hookSpecificOutput.additionalContext.includes("impeccable:impeccable"));
});

cas("une session du PC, du web ou sans repère n'en reçoit rien", () => {
  for (const entree of ["cli", "remote", "claude-vscode", "sdk-ts", undefined]) {
    const r = jouer(entree);
    assert.equal(r.status, 0, `échec du script pour « ${entree} »`);
    assert.equal(r.stdout, "", `parle à tort pour « ${entree} »`);
  }
  assert.ok(!sessionDuTelephone({}), "un environnement vide passe pour le téléphone");
});

cas("le rappel ne fait pas recharger le skill à chaque message", () => {
  // Le charger trente fois remplirait la conversation de la même page.
  assert.ok(RAPPEL.includes("pas déjà chargé"));
  assert.ok(RAPPEL.includes("ne pas le recharger"));
});

cas("il est BRANCHÉ sur chaque message", () => {
  const config = JSON.parse(
    readFileSync(path.join(__dirname, "..", ".claude", "settings.json"), "utf8")
  );
  assert.ok(
    JSON.stringify(config.hooks?.UserPromptSubmit ?? []).includes("rappel-impeccable.mjs"),
    "`.claude/settings.json` ne l'appelle pas sur UserPromptSubmit : le script serait juste, et muet"
  );
});

cas("la règle qu'il rappelle existe bien dans CLAUDE.md", () => {
  const regles = readFileSync(path.join(__dirname, "..", "CLAUDE.md"), "utf8");
  assert.ok(regles.includes("## 3 quater."), "CLAUDE.md n'a plus de §3 quater");
  assert.ok(regles.includes("remote_mobile"), "CLAUDE.md ne dit plus comment le téléphone se reconnaît");
});

console.log(echecs === 0 ? "\n✅ Le rappel impeccable tient." : `\n❌ ${echecs} cas en échec.`);
process.exit(echecs === 0 ? 0 : 1);
