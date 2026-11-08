"use server";

import { getCurrentCtx } from "@/server/session-ctx";
import { exigerFacturation } from "@/server/garde-action";
import { inscrireLeClient } from "@/server/repositories/avance-immediate";
import { verifierLimite, LIMITES } from "@/server/rate-limit";
import { logger } from "@/server/logger";
import { saisieInscriptionLue } from "@/lib/urssaf/branchement";

/**
 * « L'INSCRIRE À L'URSSAF », depuis la fiche du client (lot 3, migration 0180).
 *
 * **Les droits de la facturation** : l'inscription ne sert qu'à faire partir
 * ses factures par l'Urssaf. **Limitée en fréquence**, comme tout appel à
 * l'Urssaf. **Le refus se rend en valeur**, avec la liste de ce qui manque,
 * jamais en exception (`AGENTS.md`).
 *
 * **Rien de la feuille ne s'écrit au journal** : elle porte l'IBAN du client,
 * qui part à l'Urssaf et nulle part ailleurs.
 */
export async function inscrireALUrssafAction(
  clientId: string,
  brut: unknown
): Promise<{ ok: true } | { ok: false; raison: string; manques?: { champ: string; libelle: string }[] }> {
  const ctx = await getCurrentCtx();
  try {
    await exigerFacturation(ctx, "inscrire un client à l'Urssaf");
  } catch {
    return { ok: false, raison: "Votre rôle ne permet pas d'inscrire un client." };
  }
  const saisie = saisieInscriptionLue(brut);
  if (!saisie) return { ok: false, raison: "Cette feuille ne se lit pas. Rechargez l'écran." };
  const limite = await verifierLimite(`urssaf:${ctx.entrepriseId}`, LIMITES.urssaf);
  if (!limite.autorise) return { ok: false, raison: limite.message };
  try {
    const r = await inscrireLeClient(ctx, clientId, saisie);
    if (r.ok) return r;
    return { ok: false, raison: r.raison, manques: r.manques?.map((m) => ({ champ: m.champ, libelle: m.libelle })) };
  } catch (erreur) {
    logger.error("Client non inscrit à l'Urssaf", { erreur: erreur instanceof Error ? erreur.name : "inconnue" });
    return { ok: false, raison: "L'inscription n'a pas abouti. Réessayez." };
  }
}
