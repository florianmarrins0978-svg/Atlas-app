import assert from "node:assert/strict";
import { _reinitialiserEnvPourTests } from "../src/server/env";
import { getConfigIA } from "../src/server/ai/config";
import { decrireEtatIA } from "../src/lib/etat-ia";
import { getFournisseurLLM } from "../src/server/ai/providers/llm/fabrique";
import { getFournisseurTranscription } from "../src/server/ai/providers/transcription/fabrique";

// **« J'ai mis mes clés, pourquoi l'IA n'est-elle toujours pas branchée ? »**
//
// Le 6 août 2026. Le patron avait enregistré ses clés Anthropic et OpenAI ; la
// dictée continuait d'être recopiée mot à mot. Trois causes se cumulaient, et
// aucune n'était visible :
//
//   1. `LLM_PROVIDER` valait `dev` par défaut — poser une clé ne changeait
//      rien du tout ;
//   2. le conteneur d'essai écrivait `dev` en dur et ne transmettait aucune
//      clé (corrigé dans `.devcontainer/docker-compose.yml`) ;
//   3. une variable transmise à vide (`${ANTHROPIC_API_KEY:-}`) passait pour
//      renseignée, parce que `?? défaut` ne rattrape pas la chaîne vide.
//
// Cette suite tient les trois, et deux pièges voisins : un nom de fournisseur
// mal capitalisé, et une ébauche qui se ferait passer pour un fournisseur.
//
// Elle est PURE : aucune base, aucun réseau. Ce qu'elle éprouve est le CHOIX
// du fournisseur — l'appel a sa propre suite (`test-appel-fournisseurs-ia.ts`),
// et la description affichée à l'écran la sienne (`test-etat-ia.ts`).

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

function etatIA() {
  const config = getConfigIA();
  const cles = [
    config.anthropicApiKey ? "ANTHROPIC_API_KEY" : "",
    config.openaiApiKey ? "OPENAI_API_KEY" : "",
    config.geminiApiKey ? "GEMINI_API_KEY" : "",
    config.deepgramApiKey ? "DEEPGRAM_API_KEY" : "",
    config.googleApiKey ? "GOOGLE_API_KEY" : "",
  ].filter(Boolean);
  const [transcription, redaction] = decrireEtatIA(config.transcriptionProvider, config.llmProvider, cles);
  return { transcription, redaction, toutBranche: transcription.nature === "reel" && redaction.nature === "reel" };
}

const CLES = [
  "ANTHROPIC_API_KEY",
  "OPENAI_API_KEY",
  "GEMINI_API_KEY",
  "DEEPGRAM_API_KEY",
  "GOOGLE_API_KEY",
  "LLM_PROVIDER",
  "TRANSCRIPTION_PROVIDER",
] as const;

// Chaque cas contrôle son propre environnement : une variable laissée par le
// cas précédent ferait passer un test qui devrait échouer.
function avec(variables: Partial<Record<(typeof CLES)[number], string>>) {
  process.env.DATABASE_URL ??= "postgresql://essai:essai@localhost:5432/essai";
  for (const nom of CLES) delete process.env[nom];
  for (const [nom, valeur] of Object.entries(variables)) process.env[nom] = valeur;
  _reinitialiserEnvPourTests();
}

console.log("=== Poser une clé suffit à brancher l'IA ===");

cas("les deux clés du patron : OpenAI transcrit, Anthropic rédige", () => {
  avec({ ANTHROPIC_API_KEY: "sk-ant-essai", OPENAI_API_KEY: "sk-essai" });
  assert.equal(getFournisseurTranscription().nom, "openai");
  assert.equal(getFournisseurLLM().nom, "anthropic");
  assert.equal(etatIA().toutBranche, true);
});

cas("la seule clé Anthropic branche la rédaction, pas la transcription", () => {
  avec({ ANTHROPIC_API_KEY: "sk-ant-essai" });
  assert.equal(getFournisseurLLM().nom, "anthropic");
  // Anthropic ne transcrit pas d'audio : la dictée reste déterministe, et
  // l'écran doit le dire au lieu de laisser croire à un branchement complet.
  assert.equal(getFournisseurTranscription().nom, "dev");
  assert.equal(etatIA().toutBranche, false);
});

cas("la seule clé OpenAI tient les deux rôles", () => {
  avec({ OPENAI_API_KEY: "sk-essai" });
  assert.equal(getFournisseurLLM().nom, "openai");
  assert.equal(getFournisseurTranscription().nom, "openai");
  assert.equal(etatIA().toutBranche, true);
});

console.log("\n=== Ce qui doit RESTER déterministe ===");

cas("sans aucune clé, rien ne sort de l'application", () => {
  avec({});
  assert.equal(getFournisseurLLM().nom, "dev");
  assert.equal(getFournisseurTranscription().nom, "dev");
  assert.equal(etatIA().toutBranche, false);
});

cas("une clé VIDE vaut une clé absente — le piège du conteneur", () => {
  // `ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY:-}` déclare la variable à vide
  // quand le secret n'existe pas. Sans ce garde-fou, le fournisseur était
  // choisi puis refusait, et le message parlait d'un fournisseur indisponible.
  avec({ ANTHROPIC_API_KEY: "", OPENAI_API_KEY: "   " });
  assert.equal(getFournisseurLLM().nom, "dev");
  assert.equal(getFournisseurTranscription().nom, "dev");
});

cas("un choix explicite prime sur les clés présentes", () => {
  // C'est ainsi qu'on coupe l'IA sans retirer les clés : indispensable pour
  // rejouer un parcours sans qu'une seule donnée d'essai ne sorte.
  avec({ ANTHROPIC_API_KEY: "sk-ant-essai", OPENAI_API_KEY: "sk-essai", LLM_PROVIDER: "dev", TRANSCRIPTION_PROVIDER: "dev" });
  assert.equal(getFournisseurLLM().nom, "dev");
  assert.equal(getFournisseurTranscription().nom, "dev");
});

console.log("\n=== Les silences qui faisaient chercher ailleurs ===");

cas("une majuscule ne décide pas du produit", () => {
  // `LLM_PROVIDER=Anthropic` tombait dans le cas par défaut de la fabrique :
  // mode déterministe, sans un mot.
  avec({ LLM_PROVIDER: "Anthropic", ANTHROPIC_API_KEY: "sk-ant-essai" });
  assert.equal(getFournisseurLLM().nom, "anthropic");
  assert.equal(etatIA().redaction.nature, "reel");
});

cas("un nom inconnu est dénoncé, pas avalé", () => {
  avec({ LLM_PROVIDER: "antropic", ANTHROPIC_API_KEY: "sk-ant-essai" });
  const etat = etatIA();
  assert.notEqual(etat.redaction.nature, "reel");
  assert.match(etat.redaction.libelle, /antropic/, "Le libellé doit citer la valeur fautive.");
});

cas("un fournisseur choisi sans sa clé nomme la variable qui manque", () => {
  avec({ LLM_PROVIDER: "anthropic" });
  const etat = etatIA();
  assert.equal(etat.redaction.nature, "cle_absente");
  assert.equal(etat.redaction.variableManquante, "ANTHROPIC_API_KEY");
});

cas("une ébauche ne se fait pas passer pour un fournisseur", () => {
  // Gemini n'est pas implémenté : le dire à la configuration, et non au
  // premier appui du patron sur un bouton.
  avec({ LLM_PROVIDER: "gemini", GEMINI_API_KEY: "essai" });
  assert.equal(etatIA().redaction.nature, "non_raccorde");
});

console.log("\n=== Ce qui s'affiche à l'écran Réglages ===");

cas("aucune clé de valeur ne sort du diagnostic", () => {
  avec({ ANTHROPIC_API_KEY: "sk-ant-SECRET-A-NE-PAS-AFFICHER", OPENAI_API_KEY: "sk-SECRET-A-NE-PAS-AFFICHER" });
  // Cet état s'affiche à l'écran et se recopie dans des captures.
  const tout = JSON.stringify(etatIA());
  assert.ok(!tout.includes("SECRET"), `Une valeur de clé a fui dans le diagnostic : ${tout}`);
});

cas("l'écran dit la vérité quand un seul rôle est branché", () => {
  avec({ ANTHROPIC_API_KEY: "sk-ant-essai" });
  const etat = etatIA();
  assert.equal(etat.redaction.nature, "reel", "La rédaction devrait être branchée.");
  assert.equal(etat.transcription.nature, "simule", "La transcription devrait rester déterministe.");
  assert.match(etat.transcription.explication, /Rien ne part chez personne/);
});

console.log(`\n${echecs === 0 ? "✅" : "❌"} Branchement de l'IA — ${echecs} échec(s).`);
if (echecs > 0) process.exit(1);
