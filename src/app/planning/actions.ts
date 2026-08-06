"use server";

import { getCurrentCtx } from "@/server/session-ctx";
import {
  planifierChantier,
  deplanifierChantier,
  supprimerChantier,
  SuppressionChantierRefusee,
} from "@/server/repositories/chantiers";

export async function planifierChantierAction(chantierId: string, datePlanifiee: string) {
  const ctx = await getCurrentCtx();
  return planifierChantier(ctx, chantierId, datePlanifiee);
}

export async function deplanifierChantierAction(chantierId: string) {
  const ctx = await getCurrentCtx();
  return deplanifierChantier(ctx, chantierId);
}

/**
 * Retire un chantier du planning et de toutes les listes.
 *
 * Demandé le 6 août 2026 : « je veux pouvoir supprimer un chantier mis au
 * planning ». Suppression douce et refusée dès qu'une facture est émise — la
 * règle et son pourquoi vivent dans le dépôt (`supprimerChantier`), pas ici.
 */
export type ResultatSuppression = { succes: true } | { succes: false; erreur: string };

export async function supprimerChantierAction(chantierId: string): Promise<ResultatSuppression> {
  const ctx = await getCurrentCtx();
  try {
    await supprimerChantier(ctx, chantierId);
    return { succes: true };
  } catch (e) {
    if (e instanceof SuppressionChantierRefusee) {
      return {
        succes: false,
        erreur:
          e.motif === "facture_emise"
            ? "Ce chantier est facturé : sa facture figure au relevé de TVA et ne peut pas disparaître. Une correction passe par un avoir."
            : "Ce chantier n'existe plus.",
      };
    }
    return { succes: false, erreur: "Le chantier n'a pas pu être supprimé." };
  }
}
