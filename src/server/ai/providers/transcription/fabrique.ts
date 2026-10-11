import type { FournisseurTranscription } from "./interface";
import { fournisseurTranscriptionDev } from "./dev";
import { fournisseurTranscriptionOpenAI } from "./openai";
import { fournisseurTranscriptionDeepgram } from "./deepgram";
import { fournisseurTranscriptionGoogle } from "./google";
import { fournisseurTranscriptionEssai } from "./essai";
import { getConfigIA } from "../../config";

export function getFournisseurTranscription(): FournisseurTranscription {
  switch (getConfigIA().transcriptionProvider) {
    case "openai":
      return fournisseurTranscriptionOpenAI;
    case "deepgram":
      return fournisseurTranscriptionDeepgram;
    case "google":
      return fournisseurTranscriptionGoogle;
    // **Les suites navigateur, et elles seules.** Il rend un texte ordinaire,
    // non marqué, pour que la chaîne dictée → devis puisse être éprouvée sans
    // clé — voir `essai.ts`. La production le refuse ailleurs (`env.ts`).
    case "essai":
      return fournisseurTranscriptionEssai;
    default:
      return fournisseurTranscriptionDev;
  }
}
