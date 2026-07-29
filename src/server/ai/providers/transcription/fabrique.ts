import type { FournisseurTranscription } from "./interface";
import { fournisseurTranscriptionDev } from "./dev";
import { fournisseurTranscriptionOpenAI } from "./openai";
import { fournisseurTranscriptionDeepgram } from "./deepgram";
import { fournisseurTranscriptionGoogle } from "./google";
import { getConfigIA } from "../../config";

export function getFournisseurTranscription(): FournisseurTranscription {
  switch (getConfigIA().transcriptionProvider) {
    case "openai":
      return fournisseurTranscriptionOpenAI;
    case "deepgram":
      return fournisseurTranscriptionDeepgram;
    case "google":
      return fournisseurTranscriptionGoogle;
    default:
      return fournisseurTranscriptionDev;
  }
}
