"use server";

import { getCurrentCtx } from "@/server/session-ctx";
import { poserQuestion, type MessageAssistant, type ReponseAssistant } from "@/server/ai/services/assistant-service";
import { verifierLimite, LIMITES } from "@/server/rate-limit";

// Le client ne transmet que l'identifiant du chantier courant (déduit de
// l'URL) — jamais les données elles-mêmes. Tout le contexte réel (chantier,
// client, prestations, etc.) est reconstitué côté serveur par les outils.
export async function poserQuestionAction(
  chantierId: string | null,
  historique: MessageAssistant[],
  question: string
): Promise<ReponseAssistant> {
  const ctx = await getCurrentCtx();

  // Limité par entreprise : contrôle de coût sur les appels IA (facturés par
  // requête chez la plupart des fournisseurs), pas seulement anti-abus.
  const limite = await verifierLimite(`assistant:${ctx.entrepriseId}`, LIMITES.assistant);
  if (!limite.autorise) {
    return { succes: false, erreur: limite.message };
  }

  return poserQuestion(ctx, chantierId, historique, question);
}
