"use server";

import { getCurrentCtx } from "@/server/session-ctx";
import { planifierChantier, deplanifierChantier } from "@/server/repositories/chantiers";

export async function planifierChantierAction(chantierId: string, datePlanifiee: string) {
  const ctx = await getCurrentCtx();
  return planifierChantier(ctx, chantierId, datePlanifiee);
}

export async function deplanifierChantierAction(chantierId: string) {
  const ctx = await getCurrentCtx();
  return deplanifierChantier(ctx, chantierId);
}
