import type { FournisseurLLM, ResultatLLM } from "./interface";
import { erreurIA } from "../../errors";

// Stub documenté — non implémenté dans ce lot. À compléter le jour où un
// modèle OpenAI (GPT-4o, etc.) est retenu pour un usage LLM texte. Respecter
// la même interface que les autres fournisseurs (voir anthropic.ts).
export const fournisseurLLMOpenAI: FournisseurLLM = {
  nom: "openai",
  // Paramètres exigés par la signature de l'interface FournisseurLLM.genererTexte —
  // non utilisés dans ce stub non implémenté, ne peuvent pas être supprimés
  // sans rompre la conformité de type de l'objet exporté.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async genererTexte(_systeme: string, _message: string): Promise<ResultatLLM> {
    return { succes: false, erreur: erreurIA("fournisseur_indisponible", "Fournisseur LLM OpenAI non implémenté.") };
  },
};
