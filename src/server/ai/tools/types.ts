import type { ZodTypeAny } from "zod";
import type { Ctx } from "../../repositories/context";

// Contexte d'exécution d'un outil : jamais composé par le client ni par le
// LLM — construit côté serveur à partir de la conversation en cours.
export type ContexteOutil = { ctx: Ctx; chantierId: string | null };

export interface Outil {
  nom: string;
  description: string;
  schema: ZodTypeAny;
  executer(contexte: ContexteOutil, parametres: unknown): Promise<unknown>;
}
