"use server";

import { exigerEcritureSurLePlanning } from "@/server/garde-action";
import { getCurrentCtx } from "@/server/session-ctx";
import { envoyerDatesDuMois } from "@/server/repositories/dates-du-mois";
import { jourIso } from "@/lib/jour";

/**
 * L'ENVOI DES DATES DU MOIS au client d'un contrat (planche 130).
 *
 * **La garde du planning** : ces dates sont celles qu'il vient d'y poser, et
 * qui ne peut pas poser ne les envoie pas. Les refus attendus se RENDENT : le
 * message d'une exception d'action serveur n'arrive jamais jusqu'à lui
 * (`AGENTS.md`).
 */
export async function envoyerDatesDuMoisAction(demande: {
  contratEntretienId: string;
  mois: string;
  canal: "sms" | "email";
  autreDateAutorisee: boolean;
}): Promise<{ ok: true; jeton: string } | { ok: false; refus: string }> {
  const ctx = await getCurrentCtx();
  await exigerEcritureSurLePlanning(ctx, "envoyer les dates du mois");
  try {
    return await envoyerDatesDuMois(ctx, demande, jourIso(new Date()));
  } catch (err) {
    console.error("[envoyerDatesDuMoisAction] échec", { demande, err });
    return { ok: false, refus: "Les dates n'ont pas pu partir. Rien n'a été envoyé. Réessayez." };
  }
}
