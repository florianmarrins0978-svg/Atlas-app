"use server";

import { poserVerdictParJeton } from "@/server/repositories/verification-comptable";
import { logger } from "@/server/logger";
import { verifierLimite, LIMITES } from "@/server/rate-limit";
import { horsProductionReelle, sourceDuVisiteur } from "@/server/source-visiteur";
import { SOURCE_NON_ETABLIE } from "@/lib/source-visiteur";
import type { VerdictDuComptable } from "@/lib/pour-mon-comptable";

/**
 * LE VERDICT DU COMPTABLE — la seule écriture de sa page, ouverte SANS
 * session. Bornée en cadence par le mécanisme central, comme la réponse au
 * devis et l'accusé de la facture (`factures/[jeton]/actions.ts`).
 */
export async function poserVerdictAction(
  jeton: string,
  mouvementId: string,
  verdict: VerdictDuComptable | null,
  note: string | null
): Promise<{ ok: true } | { ok: false; raison: string }> {
  if (verdict !== null && verdict !== "valide" && verdict !== "rejete") return { ok: false, raison: "Ce choix n'est pas lisible." };
  if (!/^[0-9a-f-]{36}$/i.test(mouvementId)) return { ok: false, raison: "Cette ligne n'est pas dans le dossier." };

  const source = await sourceDuVisiteur(horsProductionReelle());
  const seuils: Array<readonly [string, { max: number; fenetreMs: number }]> = [[`verdict-comptable:${jeton}`, LIMITES.verdictComptable]];
  // Seulement si la source est établie : sans `ATLAS_PROXY_SAUTS`, tous les
  // visiteurs partagent un seul seau (la leçon de F9, `factures/[jeton]`).
  if (source !== SOURCE_NON_ETABLIE) seuils.push([`verdict-comptable:source:${source}`, LIMITES.verdictComptableParSource]);
  for (const [cle, limite] of seuils) {
    if (!(await verifierLimite(cle, limite)).autorise) return { ok: false, raison: "Trop d'appuis d'un coup. Réessayez dans une minute." };
  }

  try {
    return await poserVerdictParJeton(jeton, mouvementId, verdict, typeof note === "string" ? note : null);
  } catch (err) {
    // Une panne imprévue se journalise avant de répondre : le message d'une
    // exception n'arriverait jamais jusqu'au comptable (`HANDOVER.md`).
    logger.error("Le verdict du comptable n'a pas pu s'enregistrer", { erreur: err instanceof Error ? err.message : String(err) });
    return { ok: false, raison: "Ce choix n'a pas pu s'enregistrer. Réessayez." };
  }
}
