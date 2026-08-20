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

/**
 * Qui REGARDE les photos — et ce n'est pas forcément qui rédige.
 *
 * **Pourquoi une seconde fabrique plutôt qu'un paramètre.** Sa règle du 20 août
 * 2026 : *« l'architecture doit rester indépendante du fournisseur afin qu'un
 * moteur spécialisé puisse être ajouté ou remplacé ultérieurement sans
 * reconstruire le module »*. Les deux usages n'ont ni les mêmes exigences, ni
 * les mêmes coûts, ni la même sensibilité : la dictée porte des mots de
 * chantier, la photo porte le jardin de quelqu'un. Il faut pouvoir couper l'un
 * sans couper l'autre, et brancher demain un service spécialisé sans toucher au
 * reste.
 *
 * **Sans `VISION_PROVIDER`, c'est le fournisseur de raisonnement** (voir
 * `src/server/env.ts`) : une installation existante ne change pas de
 * comportement, et sa clé actuelle suffit.
 *
 * **Sans aucune clé, c'est `dev` — qui ne porte PAS `lireImages`.** Le moteur
 * annonce alors que l'analyse automatique n'est pas disponible, comme la
 * lecture des tickets. Aucun appel réseau, aucune donnée qui sort : c'est
 * l'état des suites et de la CI, et il doit le rester.
 */
export function getFournisseurVision(): FournisseurLLM {
  switch (getConfigIA().visionProvider) {
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
