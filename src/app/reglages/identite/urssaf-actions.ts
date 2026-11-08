"use server";

import { getCurrentCtx } from "@/server/session-ctx";
import { exigerProprietaire } from "@/server/autorisation";
import { delierLUrssaf, relierLUrssaf } from "@/server/repositories/avance-immediate";
import { verifierLimite, LIMITES } from "@/server/rate-limit";
import { logger } from "@/server/logger";
import { jourIso } from "@/lib/jour";

/**
 * L'AVANCE IMMÉDIATE, depuis Mon entreprise (lot 3, migration 0180).
 *
 * **Réservé au patron** : les codes de l'Urssaf font verser l'avance de ses
 * clients sur son compte. **Limité en fréquence** comme tout ce qui appelle
 * l'Urssaf (`LIMITES.urssaf`) : un doigt resté appuyé ne doit pas faire couper
 * sa liaison. **Le refus se rend en valeur**, jamais en exception : le message
 * d'une exception d'action serveur n'arrive pas jusqu'à lui (`AGENTS.md`).
 *
 * **Les codes ne s'écrivent jamais au journal**, même en cas de panne : seule
 * la nature de l'erreur y part.
 */
export async function relierLUrssafAction(saisie: {
  clientId: string;
  clientSecret: string;
  idTiersFacturation: string;
  codeNature: string;
}): Promise<{ ok: true; relieeLe: string } | { ok: false; raison: string }> {
  const ctx = await getCurrentCtx();
  try {
    await exigerProprietaire(ctx, "relier l'Urssaf");
  } catch {
    return { ok: false, raison: "Seul le patron peut relier l'Urssaf." };
  }
  const limite = await verifierLimite(`urssaf:${ctx.entrepriseId}`, LIMITES.urssaf);
  if (!limite.autorise) return { ok: false, raison: limite.message };
  try {
    const r = await relierLUrssaf(ctx, saisie);
    return r.ok ? { ok: true, relieeLe: jourIso(new Date()) } : r;
  } catch (erreur) {
    logger.error("Liaison avec l'Urssaf non enregistrée", { erreur: erreur instanceof Error ? erreur.name : "inconnue" });
    return { ok: false, raison: "La liaison n'a pas abouti. Réessayez." };
  }
}

/** Délie l'Urssaf : ses codes s'effacent, les demandes parties gardent leur trace. */
export async function delierLUrssafAction(): Promise<{ ok: true } | { ok: false; raison: string }> {
  const ctx = await getCurrentCtx();
  try {
    await exigerProprietaire(ctx, "délier l'Urssaf");
  } catch {
    return { ok: false, raison: "Seul le patron peut délier l'Urssaf." };
  }
  try {
    await delierLUrssaf(ctx);
    return { ok: true };
  } catch (erreur) {
    logger.error("Liaison avec l'Urssaf non effacée", { erreur: erreur instanceof Error ? erreur.message : String(erreur) });
    return { ok: false, raison: "La liaison n'a pas pu être effacée. Réessayez." };
  }
}
