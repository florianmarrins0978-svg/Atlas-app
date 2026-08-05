"use server";

import { revalidatePath } from "next/cache";
import { getCurrentCtx } from "@/server/session-ctx";
import { deriverDicteeVersDevis, resumerTapis, type ResultatTapis } from "@/server/orchestrateur/tapis-roulant";
import { verifierLimite, LIMITES } from "@/server/rate-limit";
import { logger } from "@/server/logger";

// Le tapis roulant, déclenché depuis l'écran de la dictée.
//
// Ce fichier n'expose qu'une fonction asynchrone : un fichier « use server »
// qui exporte autre chose annule TOUS ses exports, sans que ni `tsc` ni
// `eslint` ne le voient (voir HANDOVER.md, piège 7). Les types vivent donc dans
// `tapis-roulant.ts` et sont importés par ceux qui en ont besoin.

export async function preparerDevisDepuisDicteeAction(
  chantierId: string
): Promise<{ succes: true; resultat: ResultatTapis; resume: string } | { succes: false; erreur: string }> {
  const ctx = await getCurrentCtx();

  // Un tapis roulant enchaîne une extraction (donc un appel payant chez un
  // prestataire) et plusieurs écritures. Deux appuis impatients ne doivent pas
  // en déclencher deux.
  const limite = await verifierLimite(`tapis:${ctx.entrepriseId}`, LIMITES.confirmationProposition);
  if (!limite.autorise) {
    return { succes: false, erreur: limite.message };
  }

  try {
    const resultat = await deriverDicteeVersDevis(ctx, chantierId);

    // Tout ce que le tapis a pu toucher : les écrans suivants doivent montrer
    // l'état d'après, pas celui d'avant.
    for (const chemin of ["", "/informations", "/prix", "/export", "/transcription"]) {
      revalidatePath(`/chantiers/${chantierId}${chemin}`);
    }

    return { succes: true, resultat, resume: resumerTapis(resultat) };
  } catch (err) {
    // Ne jamais rendre au patron une trace technique : elle ne lui apprend
    // rien et peut porter des données. Le détail part au journal.
    logger.error("Le tapis roulant a échoué", { chantierId, erreur: err instanceof Error ? err.message : String(err) });
    return { succes: false, erreur: "La préparation du devis n'a pas pu aboutir. Votre dictée est intacte." };
  }
}
