import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";

// **Les clés du patron ne doivent pas être annulées par un conteneur d'hier.**
//
// Le 6 août 2026, il avait posé ses clés Anthropic et OpenAI ; l'application
// restait déterministe. Une des trois causes vivait dans
// `.devcontainer/docker-compose.yml`, qui écrivait `LLM_PROVIDER: dev` en dur.
// Corriger le fichier ne suffit pas : **un espace de travail déjà construit
// garde l'ancien réglage** jusqu'à une reconstruction du conteneur — un geste
// introuvable sur un téléphone, et le genre d'obstacle qui a déjà consommé
// quatre tentatives.
//
// `reglage-ia.sh` distingue donc « `dev` parce que le patron l'a voulu » de
// « `dev` parce qu'un vieux fichier l'écrivait ». Cette suite le confronte aux
// quatre états qu'il prétend séparer — sans quoi ce script ne serait jamais vu
// échouer, et la seule preuve de son bon fonctionnement serait qu'il existe.

const SCRIPT = path.join(__dirname, "..", ".devcontainer", "reglage-ia.sh");

let echecs = 0;

function verdict(variables: Record<string, string>): string {
  // Environnement VIDE au départ, PATH mis à part. Sans cela, une variable de
  // la machine qui joue les tests déciderait à la place du cas de test — et le
  // contrôle passerait au vert pour une raison qui n'a rien à voir.
  // `NODE_ENV` n'a aucun effet sur ce script shell : il n'est là que parce que
  // le dépôt le déclare obligatoire dans le typage de l'environnement.
  const env: NodeJS.ProcessEnv = { NODE_ENV: "test", PATH: process.env.PATH ?? "/usr/bin:/bin", ...variables };
  return execFileSync("bash", [SCRIPT], { env, encoding: "utf8" }).trim();
}

function cas(nom: string, variables: Record<string, string>, attendu: string) {
  try {
    const obtenu = verdict(variables);
    assert.equal(obtenu, attendu);
    console.log(`  ✓ ${nom}`);
  } catch (e) {
    echecs++;
    console.error(`  ✗ ${nom}\n    ${(e as Error).message}`);
  }
}

console.log("=== Ce que l'espace d'essai décide au démarrage ===");

cas("aucune clé : mode déterministe, rien ne sort", {}, "sans-cle");

cas("une clé vide ne branche rien", { ANTHROPIC_API_KEY: "", OPENAI_API_KEY: "" }, "sans-cle");

cas(
  "les deux clés, conteneur à jour : branchée",
  { ANTHROPIC_API_KEY: "sk-ant-essai", OPENAI_API_KEY: "sk-essai", ATLAS_CONTENEUR: "2" },
  "branchee"
);

cas(
  "une seule clé suffit à brancher",
  { OPENAI_API_KEY: "sk-essai", ATLAS_CONTENEUR: "2" },
  "branchee"
);

cas(
  "conteneur d'AVANT le correctif : le « dev » figé est neutralisé",
  { ANTHROPIC_API_KEY: "sk-ant-essai", LLM_PROVIDER: "dev", TRANSCRIPTION_PROVIDER: "dev" },
  "neutralise"
);

cas(
  "conteneur à jour : « dev » est un choix, et il est respecté",
  { ANTHROPIC_API_KEY: "sk-ant-essai", LLM_PROVIDER: "dev", ATLAS_CONTENEUR: "2" },
  "coupee"
);

cas(
  "sans clé, un ancien conteneur ne réclame rien",
  { LLM_PROVIDER: "dev" },
  "sans-cle"
);

console.log(`\n${echecs === 0 ? "✅" : "❌"} Réglage de l'IA au démarrage — ${echecs} échec(s).`);
if (echecs > 0) process.exit(1);
