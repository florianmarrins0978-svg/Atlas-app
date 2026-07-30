"use server";

import { getCurrentCtx } from "@/server/session-ctx";
import { creerTarif, modifierTarif, supprimerTarif } from "@/server/repositories/tarifs";
import { exigerProprietaire } from "@/server/autorisation";

export async function creerTarifAction(intitule: string, prix: string) {
  const ctx = await getCurrentCtx();
  await exigerProprietaire(ctx, "créer un tarif");
  return creerTarif(ctx, { intitule, prix });
}

export async function modifierTarifAction(id: string, data: { intitule?: string; prix?: string; unite?: string }) {
  const ctx = await getCurrentCtx();
  await exigerProprietaire(ctx, "modifier un tarif");
  return modifierTarif(ctx, id, data);
}

export async function supprimerTarifAction(id: string) {
  const ctx = await getCurrentCtx();
  await exigerProprietaire(ctx, "supprimer un tarif");
  return supprimerTarif(ctx, id);
}
