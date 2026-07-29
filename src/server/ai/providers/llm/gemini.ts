import type { FournisseurLLM, ResultatLLM } from "./interface";
import { erreurIA } from "../../errors";

// Stub documenté — non implémenté dans ce lot. À compléter si Google Gemini
// est retenu un jour comme fournisseur LLM alternatif.
export const fournisseurLLMGemini: FournisseurLLM = {
  nom: "gemini",
  async genererTexte(_systeme: string, _message: string): Promise<ResultatLLM> {
    return { succes: false, erreur: erreurIA("fournisseur_indisponible", "Fournisseur LLM Gemini non implémenté.") };
  },
};
