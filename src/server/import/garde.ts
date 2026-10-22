import { getCurrentCtx } from "../session-ctx";
import { estProprietaire } from "../autorisation";
import type { Ctx } from "../repositories/context";

/**
 * Importer, c'est créer des fiches clients et ranger des factures : un geste du
 * patron, comme garder un devis reçu (`reglages/fournisseurs/actions.ts`).
 * `null` pour tout le reste, session absente comprise : les routes répondent
 * alors 404, jamais 403 (`garde-route.ts`).
 */
export async function patronQuiImporte(): Promise<Ctx | null> {
  try {
    const ctx = await getCurrentCtx();
    return (await estProprietaire(ctx)) ? ctx : null;
  } catch {
    return null;
  }
}
