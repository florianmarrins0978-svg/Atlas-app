"use server";

import { getCurrentCtx } from "@/server/session-ctx";
import { exigerEditeur } from "@/server/editeur";
import { rangerIdee, repondreAIdee } from "@/server/repositories/idees";
import { estTriIdee } from "@/lib/idees";
import { logger } from "@/server/logger";

/**
 * LES IDÉES REÇUES — les deux gestes de l'éditeur, et de lui seul
 * (`exigerEditeur`, puis `withEditeur` dans le dépôt).
 */

/** Appelé à la fermeture du tiroir « Marquée prévue, Annuler ». */
export async function rangerIdeeAction(id: string, tri: string): Promise<{ succes: boolean; erreur?: string }> {
  const ctx = await getCurrentCtx();
  await exigerEditeur(ctx, "ranger une idée");
  if (!estTriIdee(tri)) return { succes: false, erreur: "Ce geste n'existe pas." };
  try {
    const touchee = await rangerIdee(ctx, id, tri);
    return touchee ? { succes: true } : { succes: false, erreur: "Cette idée n'existe plus." };
  } catch (erreur) {
    logger.error("idee_rangement_panne", { erreur });
    return { succes: false, erreur: "L'idée n'a pas pu être rangée. Réessayez dans un instant." };
  }
}

export async function repondreIdeeAction(id: string, reponse: string): Promise<{ ok: true } | { ok: false; message: string }> {
  const ctx = await getCurrentCtx();
  await exigerEditeur(ctx, "répondre à une idée");
  try {
    return await repondreAIdee(ctx, id, reponse);
  } catch (erreur) {
    logger.error("idee_reponse_panne", { erreur });
    return { ok: false, message: "La réponse n'a pas pu partir. Réessayez dans un instant." };
  }
}
