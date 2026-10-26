import type { FournisseurTranscription } from "./interface";
import { fournisseurTranscriptionDev } from "./dev";
import { fournisseurTranscriptionOpenAI } from "./openai";
import { fournisseurTranscriptionDeepgram } from "./deepgram";
import { fournisseurTranscriptionGoogle } from "./google";
import { fournisseurTranscriptionEssai } from "./essai";
import { getConfigIA } from "../../config";
import { avecCompteurTranscription } from "../../compteur";

// Les services payants passent par le compteur des crédits IA (`compteur.ts`) ;
// `essai` et `dev` ne coûtent rien et restent nus.
const openAICompte = avecCompteurTranscription(fournisseurTranscriptionOpenAI);
const deepgramCompte = avecCompteurTranscription(fournisseurTranscriptionDeepgram);
const googleCompte = avecCompteurTranscription(fournisseurTranscriptionGoogle);

export function getFournisseurTranscription(): FournisseurTranscription {
  switch (getConfigIA().transcriptionProvider) {
    case "openai":
      return openAICompte;
    case "deepgram":
      return deepgramCompte;
    case "google":
      return googleCompte;
    // **Les suites navigateur, et elles seules.** Il rend un texte ordinaire,
    // non marqué, pour que la chaîne dictée → devis puisse être éprouvée sans
    // clé — voir `essai.ts`. La production le refuse ailleurs (`env.ts`).
    case "essai":
      return fournisseurTranscriptionEssai;
    default:
      return fournisseurTranscriptionDev;
  }
}
