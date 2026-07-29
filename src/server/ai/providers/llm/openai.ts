import type { FournisseurLLM, ResultatLLM } from "./interface";
import { erreurIA } from "../../errors";

// Stub documenté — non implémenté dans ce lot. À compléter le jour où un
// modèle OpenAI (GPT-4o, etc.) est retenu pour un usage LLM texte. Respecter
// la même interface que les autres fournisseurs (voir anthropic.ts).
export const fournisseurLLMOpenAI: FournisseurLLM = {
  nom: "openai",
  async genererTexte(_systeme: string, _message: string): Promise<ResultatLLM> {
    return { succes: false, erreur: erreurIA("fournisseur_indisponible", "Fournisseur LLM OpenAI non implémenté.") };
  },
};
