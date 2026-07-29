import type { ErreurIA } from "../../errors";
import type { ZodTypeAny } from "zod";

export type ResultatLLM = { succes: true; texte: string } | { succes: false; erreur: ErreurIA };

// --- Extension additive (Lot IA-02) : usage d'outils --------------------
// N'affecte pas genererTexte() ni ses appelants existants (extraction).

export type MessageConversation =
  | { role: "user" | "assistant"; contenu: string }
  | { role: "outil"; outil: string; resultat: unknown };

export type DefinitionOutil = {
  nom: string;
  description: string;
  schema: ZodTypeAny;
};

export type ResultatLLMAvecOutils =
  | { succes: true; type: "texte"; texte: string }
  | { succes: true; type: "appel_outil"; outil: string; parametres: unknown }
  | { succes: false; erreur: ErreurIA };

export interface FournisseurLLM {
  nom: string;
  genererTexte(systeme: string, message: string): Promise<ResultatLLM>;
  // Optionnel : un fournisseur qui ne le supporte pas (stub) reste valide.
  genererAvecOutils?(
    systeme: string,
    historique: MessageConversation[],
    outils: DefinitionOutil[]
  ): Promise<ResultatLLMAvecOutils>;
}
