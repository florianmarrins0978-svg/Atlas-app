"use server";

import { revalidatePath } from "next/cache";
import { getCurrentCtx } from "@/server/session-ctx";
import { exigerProprietaire } from "@/server/autorisation";
import { reglerLesZones } from "@/server/zones-deplacement";

/**
 * Le réglage des zones, au patron seul, comme le reste d'Équipe. Le refus
 * revient en valeur : une exception d'action serveur n'arriverait pas jusqu'à
 * l'écran (`AGENTS.md`).
 */
export async function reglerLesZonesAction(entree: {
  convention: string;
  zones: { nom: string; km: number }[];
  teinte: string;
}): Promise<{ ok: true; departSitue: boolean } | { ok: false; raison: string }> {
  const ctx = await getCurrentCtx();
  await exigerProprietaire(ctx, "régler les zones de déplacement");
  const reglage = await reglerLesZones(ctx, entree);
  if (!reglage) return { ok: false, raison: "Ces zones ne se lisent pas : chaque borne doit dépasser la précédente." };
  revalidatePath("/reglages/equipe");
  revalidatePath("/termines/comptable/jours-travailles");
  return { ok: true, departSitue: reglage.depart !== null };
}
