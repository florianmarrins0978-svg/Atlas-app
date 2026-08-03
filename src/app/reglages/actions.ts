"use server";

import { getCurrentCtx } from "@/server/session-ctx";
import { creerTarif, modifierTarif, supprimerTarif } from "@/server/repositories/tarifs";
import { exigerProprietaire } from "@/server/autorisation";
import { mettreAJourEntreprise } from "@/server/repositories/entreprises";

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

/**
 * Combien de chantiers l'entreprise mène de front.
 *
 * C'est ce nombre qui autorise deux interventions le même jour — le patron :
 * « si j'ai deux équipes dans ma boîte, je peux avoir deux chantiers le
 * 6 août ». La borne est appliquée dans le dépôt, pas ici : zéro équipe rendrait
 * tout jour indisponible sans qu'aucun écran ne dise pourquoi.
 */
export async function mettreAJourNombreEquipesAction(nombreEquipes: number) {
  const ctx = await getCurrentCtx();
  await exigerProprietaire(ctx, "modifier le nombre d'équipes");
  const e = await mettreAJourEntreprise(ctx, { nombreEquipes });
  return { nombreEquipes: e?.nombreEquipes ?? 1 };
}
