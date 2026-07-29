import type { FournisseurLLM } from "./interface";
import { fournisseurLLMDev } from "./dev";
import { fournisseurLLMAnthropic } from "./anthropic";
import { fournisseurLLMOpenAI } from "./openai";
import { fournisseurLLMGemini } from "./gemini";
import { getConfigIA } from "../../config";

export function getFournisseurLLM(): FournisseurLLM {
  switch (getConfigIA().llmProvider) {
    case "anthropic":
      return fournisseurLLMAnthropic;
    case "openai":
      return fournisseurLLMOpenAI;
    case "gemini":
      return fournisseurLLMGemini;
    default:
      return fournisseurLLMDev;
  }
}
