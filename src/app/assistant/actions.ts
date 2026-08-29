"use server";

import { getCurrentCtx } from "@/server/session-ctx";
import { poserQuestion, type MessageAssistant, type ReponseAssistant } from "@/server/ai/services/assistant-service";
import { verifierLimite, LIMITES } from "@/server/rate-limit";
import { getRole } from "@/server/autorisation";
import { peutUtiliserLAssistant } from "@/lib/acces-roles";
import { ajouterAuFilAssistant, lireFilAssistant, viderFilAssistant } from "@/server/repositories/fil-assistant";
import { logger } from "@/server/logger";

/**
 * Le fil déjà écrit, relu à l'ouverture du panneau.
 *
 * **Rend un tableau vide plutôt qu'un refus** quand le compte n'a pas
 * l'assistant : l'écran n'a rien à afficher, et une erreur ici ferait rougir un
 * panneau qui, de toute façon, ne s'ouvre pas.
 */
export async function lireFilAction(): Promise<MessageAssistant[]> {
  const ctx = await getCurrentCtx();
  const role = await getRole(ctx);
  if (!role || !peutUtiliserLAssistant(role)) return [];
  try {
    return await lireFilAssistant(ctx);
  } catch (erreur) {
    // **Un fil qu'on ne sait pas relire ne doit pas fermer l'assistant.** Il
    // repart vierge, ce qui est exactement l'état d'avant ce lot — et la panne
    // se journalise, sinon personne ne saura jamais pourquoi il oublie.
    logger.error("Fil de l'assistant illisible", { erreur });
    return [];
  }
}

/** Repartir de zéro, à son geste. */
export async function viderFilAction(): Promise<void> {
  const ctx = await getCurrentCtx();
  const role = await getRole(ctx);
  if (!role || !peutUtiliserLAssistant(role)) return;
  await viderFilAssistant(ctx);
}

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
  if (!role || !peutUtiliserLAssistant(role)) {
    return { succes: false, erreur: "L'assistant n'est pas disponible pour votre compte." };
  }

  // Limité par entreprise : contrôle de coût sur les appels IA (facturés par
  // requête chez la plupart des fournisseurs), pas seulement anti-abus.
  const limite = await verifierLimite(`assistant:${ctx.entrepriseId}`, LIMITES.assistant);
  if (!limite.autorise) {
    return { succes: false, erreur: limite.message };
  }

  const reponse = await poserQuestion(ctx, chantierId, historique, question);

  /**
   * **Le fil s'écrit APRÈS la réponse, et les deux messages ensemble.**
   *
   * Écrire la question d'abord laisserait, sur une panne du fournisseur, une
   * phrase sans suite : au rechargement, l'assistant relirait sa propre
   * question comme si elle venait d'arriver.
   *
   * **Et un défaut d'écriture ne mange pas la réponse** : elle est déjà
   * calculée, elle a déjà coûté un appel, et il l'attend à l'écran. Ce qui se
   * perd alors est la mémoire, pas le travail — et la perte se journalise.
   */
  if (reponse.succes) {
    try {
      await ajouterAuFilAssistant(ctx, chantierId, [
        { role: "user", contenu: question },
        { role: "assistant", contenu: reponse.texte },
      ]);
    } catch (erreur) {
      logger.error("Le fil de l'assistant n'a pas pu être écrit", { erreur });
    }
  }

  return reponse;
}
