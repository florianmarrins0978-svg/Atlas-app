"use server";

import { getCurrentCtx } from "@/server/session-ctx";
import { poserQuestion, type MessageAssistant, type ReponseAssistant } from "@/server/ai/services/assistant-service";
import { verifierLimite, LIMITES } from "@/server/rate-limit";
import { estProprietaire } from "@/server/autorisation";

/**
 * **L'assistant sert le patron, et lui seul.**
 *
 * Sa demande du 25 août 2026 : *« qu'il se comporte comme un vrai assistant au
 * service de l'utilisateur principal seulement le principal »*.
 *
 * Ce n'est pas une préférence d'usage, c'est un cloisonnement : l'assistant
 * lit les tarifs, les marges, l'historique des prix, et il sait désormais
 * chercher une ligne dans le devis de N'IMPORTE QUEL client de l'entreprise
 * (`RechercherLignesDevis`). Ouvert à un salarié, il rendrait par la
 * conversation exactement ce que les réglages lui refusent écran par écran
 * (`rubriques-reglages.ts`, sa règle du 13 août 2026).
 *
 * **Le refus est ICI, au serveur, pas seulement sur le bouton.** Cacher la
 * pastille suffit à ne pas la voir ; il resterait une action serveur appelable.
 * Le rôle est relu en base à chaque demande — jamais transmis par le
 * navigateur.
 */
const REFUS_NON_PROPRIETAIRE =
  "L'assistant est réservé au responsable de l'entreprise.";

// Le client ne transmet que l'identifiant du chantier courant (déduit de
// l'URL) — jamais les données elles-mêmes. Tout le contexte réel (chantier,
// client, prestations, etc.) est reconstitué côté serveur par les outils.
export async function poserQuestionAction(
  chantierId: string | null,
  historique: MessageAssistant[],
  question: string
): Promise<ReponseAssistant> {
  const ctx = await getCurrentCtx();

  if (!(await estProprietaire(ctx))) {
    return { succes: false, erreur: REFUS_NON_PROPRIETAIRE };
  }

  // Limité par entreprise : contrôle de coût sur les appels IA (facturés par
  // requête chez la plupart des fournisseurs), pas seulement anti-abus.
  const limite = await verifierLimite(`assistant:${ctx.entrepriseId}`, LIMITES.assistant);
  if (!limite.autorise) {
    return { succes: false, erreur: limite.message };
  }

  return poserQuestion(ctx, chantierId, historique, question);
}
