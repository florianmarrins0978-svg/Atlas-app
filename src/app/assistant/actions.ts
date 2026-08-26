"use server";

import { getCurrentCtx } from "@/server/session-ctx";
import { poserQuestion, type MessageAssistant, type ReponseAssistant } from "@/server/ai/services/assistant-service";
import { verifierLimite, LIMITES } from "@/server/rate-limit";
import { getRole } from "@/server/autorisation";
import { peutVoirLesMontants } from "@/lib/acces-roles";

// Le client ne transmet que l'identifiant du chantier courant (déduit de
// l'URL) — jamais les données elles-mêmes. Tout le contexte réel (chantier,
// client, prestations, etc.) est reconstitué côté serveur par les outils.
export async function poserQuestionAction(
  chantierId: string | null,
  historique: MessageAssistant[],
  question: string
): Promise<ReponseAssistant> {
  const ctx = await getCurrentCtx();

  /**
   * **L'assistant n'est pas pour un salarié, et le refus est ICI.**
   *
   * Il reconstitue au serveur le chantier, le client, les prestations et les
   * PRIX (`assistant-service`) : sans cette ligne, tout ce que les rôles
   * ferment se rouvrirait en le DEMANDANT — la porte la plus difficile à
   * surveiller, puisqu'elle n'a pas d'adresse à garder.
   *
   * **Rendu en valeur, jamais levé** : le message d'une exception d'action
   * serveur n'arrive jamais jusqu'à l'artisan (`HANDOVER.md`, piège 0 ter).
   */
  const role = await getRole(ctx);
  if (!role || !peutVoirLesMontants(role)) {
    return { succes: false, erreur: "L'assistant n'est pas disponible pour votre compte." };
  }

  // Limité par entreprise : contrôle de coût sur les appels IA (facturés par
  // requête chez la plupart des fournisseurs), pas seulement anti-abus.
  const limite = await verifierLimite(`assistant:${ctx.entrepriseId}`, LIMITES.assistant);
  if (!limite.autorise) {
    return { succes: false, erreur: limite.message };
  }

  return poserQuestion(ctx, chantierId, historique, question);
}
