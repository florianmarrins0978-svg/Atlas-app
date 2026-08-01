"use server";

import { revalidatePath } from "next/cache";
import { getCurrentCtx } from "@/server/session-ctx";
import { marquerReponseVue } from "@/server/repositories/envois-devis";

/**
 * Le patron a pris connaissance d'une réponse du client.
 *
 * Marquer « vu » est un geste, pas un effet de bord de l'affichage : une
 * notification qui disparaît au premier coup d'œil est une notification qu'on
 * peut manquer en faisant défiler l'écran.
 */
export async function marquerReponseVueAction(envoiId: string) {
  const ctx = await getCurrentCtx();
  await marquerReponseVue(ctx, envoiId);
  revalidatePath("/");
}
