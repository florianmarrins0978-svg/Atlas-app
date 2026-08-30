import type { FournisseurLLM, ResultatLLM } from "./interface";
import { erreurIA } from "../../errors";

// Stub documenté — non implémenté dans ce lot. À compléter si Google Gemini
// est retenu un jour comme fournisseur LLM alternatif.
export const fournisseurLLMGemini: FournisseurLLM = {
  nom: "gemini",
  // Paramètres exigés par la signature de l'interface FournisseurLLM.genererTexte —
  // non utilisés dans ce stub non implémenté, ne peuvent pas être supprimés
  // sans rompre la conformité de type de l'objet exporté.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async genererTexte(_systeme: string, _message: string, _contexte?: string): Promise<ResultatLLM> {
    return { succes: false, erreur: erreurIA("fournisseur_indisponible", "Fournisseur LLM Gemini non implémenté.") };
  },
};
