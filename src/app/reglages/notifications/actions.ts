"use server";

import { getCurrentCtx } from "@/server/session-ctx";
import { exigerProprietaire } from "@/server/autorisation";
import { ecrireReglagesRappels } from "@/server/repositories/rappels";
import type { ReglagesRappels } from "@/lib/rappels";

/**
 * Les deux rappels, réglés depuis « Notifications ».
 *
 * **Réservé au propriétaire, et c'est discutable — donc expliqué.** Ces rappels
 * portent sur les devis et les factures de l'entreprise : un salarié qui les
 * couperait priverait le patron d'une alerte qui n'est pas la sienne. La
 * rubrique vit pourtant dans l'ensemble « Moi » du sommaire, parce que c'est là
 * qu'il l'a placée sur sa planche — le jour où un salarié aura ses propres
 * alertes, elles se régleront à côté de celles-ci, pas à leur place.
 *
 * **Le retour est une valeur, jamais une exception** : le message d'une erreur
 * levée par une action serveur n'arrive jamais jusqu'au patron
 * (`HANDOVER.md`, piège 0 ter).
 */
export type ResultatRappels = { ok: true; reglages: ReglagesRappels } | { ok: false; raison: string };

export async function ecrireRappelsAction(saisie: Partial<ReglagesRappels>): Promise<ResultatRappels> {
  const ctx = await getCurrentCtx();
  try {
    await exigerProprietaire(ctx, "régler les rappels");
  } catch {
    return { ok: false, raison: "Seul le patron peut régler ces rappels." };
  }

  try {
    const reglages = await ecrireReglagesRappels(ctx, saisie);
    return { ok: true, reglages };
  } catch (erreur) {
    // Journalisé AVANT de rendre : un défaut muet se répare à l'aveugle.
    console.error("[reglages/notifications] écriture refusée", erreur);
    return { ok: false, raison: "Impossible d'enregistrer pour l'instant. Réessayez." };
  }
}
