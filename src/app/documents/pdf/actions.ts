"use server";

import { exigerGestionDevis } from "@/server/garde-action";
import { getCurrentCtx } from "@/server/session-ctx";
import { basculerSautDePage, retirerLesSautsDePage } from "@/server/repositories/devis";
import { cleDeSaut } from "@/lib/sauts-de-page";

/**
 * « Nouvelle page ici », et la croix d'un saut — sa planche du 3 novembre
 * 2026. **Un refus attendu se rend en valeur de retour** (`AGENTS.md`, piège
 * 0 ter) : un devis parti, une clé qui ne désigne rien. Le message d'une
 * exception levée ici ne lui parviendrait jamais.
 */
export async function basculerSautDePageAction(
  devisId: string,
  cle: string
): Promise<{ ok: true; sauts: string[] } | { ok: false; raison: string }> {
  const ctx = await getCurrentCtx();
  await exigerGestionDevis(ctx, "mettre en page un devis");
  const valide = cleDeSaut(cle);
  if (!valide) return { ok: false, raison: "Cette ligne ne se coupe pas." };
  return basculerSautDePage(ctx, devisId, valide);
}

/** « Tout remettre » : la mise en page d'Atlas, sans ses sauts. */
export async function retirerLesSautsDePageAction(devisId: string): Promise<{ ok: true } | { ok: false; raison: string }> {
  const ctx = await getCurrentCtx();
  await exigerGestionDevis(ctx, "mettre en page un devis");
  return retirerLesSautsDePage(ctx, devisId);
}
