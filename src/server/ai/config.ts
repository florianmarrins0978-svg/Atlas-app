import { getEnv } from "../env";

// Configuration unique de la couche IA. Aucun autre fichier de la couche IA ne
// doit lire process.env directement — tout passe par cette fonction, qui
// délègue elle-même au module d'environnement centralisé (src/server/env.ts).
export function getConfigIA() {
  const env = getEnv();
  return {
    llmProvider: env.llmProvider,
    transcriptionProvider: env.transcriptionProvider,
    anthropicApiKey: env.anthropicApiKey,
    openaiApiKey: env.openaiApiKey,
    geminiApiKey: env.geminiApiKey,
    deepgramApiKey: env.deepgramApiKey,
    googleApiKey: env.googleApiKey,
    anthropicBaseUrl: env.anthropicBaseUrl,
    openaiBaseUrl: env.openaiBaseUrl,
    // Qui REGARDE les photos, et avec quel modèle — distinct de qui rédige.
    // Voir `src/server/env.ts` : sans valeur, c'est le fournisseur de
    // raisonnement, donc rien ne change pour une installation existante.
    visionProvider: env.visionProvider,
    visionModele: env.visionModele,
  } as const;
}
