"use server";

import { getCurrentCtx } from "@/server/session-ctx";
import {
  planifierChantier,
  deplanifierChantier,
  supprimerChantier,
  SuppressionChantierRefusee,
  CreneauIndisponible,
} from "@/server/repositories/chantiers";

/**
 * Poser un chantier : la date, la demi-journée, et l'équipe.
 *
 * **Les trois ensemble, jamais la date seule.** Le patron choisit une ligne
 * dans la journée ouverte — ce geste dit à la fois quand et qui. Le serveur
 * revalide le créneau : entre l'affichage et l'appui, un client a pu le
 * prendre, et deux chantiers tomberaient sur la même équipe au même moment.
 *
 * Rend `{ succes: false, erreur }` plutôt que de laisser remonter l'exception :
 * l'écran doit pouvoir DIRE lequel des créneaux vient de partir, sinon le
 * patron réessaie le même et ne comprend pas pourquoi rien ne se passe.
 */
export type ResultatPose = { succes: true } | { succes: false; erreur: string };

export async function planifierChantierAction(
  chantierId: string,
  datePlanifiee: string,
  choix?: { moment: "matin" | "apres_midi"; rangEquipe: number | null }
): Promise<ResultatPose> {
  const ctx = await getCurrentCtx();
  try {
    await planifierChantier(ctx, chantierId, datePlanifiee, choix);
    return { succes: true };
  } catch (e) {
    if (e instanceof CreneauIndisponible) return { succes: false, erreur: e.message };
    throw e;
  }
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
