"use server";

import { revalidatePath } from "next/cache";
import { getCurrentCtx } from "@/server/session-ctx";
import { exigerEditeur } from "@/server/editeur";
import {
  creerTermeMetier,
  modifierTermeMetier,
  supprimerTermeMetier,
} from "@/server/repositories/termes-metier";

/**
 * Le vocabulaire du métier — écriture réservée à l'éditeur.
 *
 * **La garde est ici, pas seulement sur la page.** Une page cachée protège ce
 * qu'on regarde ; elle ne protège pas ce qu'on appelle. Une action serveur
 * s'invoque depuis n'importe quel écran de l'application, par n'importe quel
 * compte connecté : sans `exigerEditeur` en tête, un client aurait pu réécrire
 * le vocabulaire de tous les autres.
 */
export async function creerTermeAction(data: {
  nature: "mot" | "regle";
  intitule: string;
  definition: string;
  consigne?: string;
}) {
  const ctx = await getCurrentCtx();
  await exigerEditeur(ctx, "ajouter un terme au vocabulaire du métier");

  const intitule = data.intitule.trim();
  const definition = data.definition.trim();
  // Un terme sans définition n'apprend rien au modèle : il occupe le budget de
  // la consigne et chasse ceux qui, eux, disent quelque chose.
  if (!intitule || !definition) {
    throw new Error("Un terme a besoin d'un intitulé et d'une définition.");
  }

  const terme = await creerTermeMetier({ ...data, intitule, definition });
  revalidatePath("/reglages/vocabulaire");
  return terme;
}

export async function modifierTermeAction(
  id: string,
  data: { intitule?: string; definition?: string; consigne?: string | null; ordre?: number; actif?: boolean }
) {
  const ctx = await getCurrentCtx();
  await exigerEditeur(ctx, "modifier le vocabulaire du métier");
  const terme = await modifierTermeMetier(id, data);
  revalidatePath("/reglages/vocabulaire");
  return terme;
}

export async function supprimerTermeAction(id: string) {
  const ctx = await getCurrentCtx();
  await exigerEditeur(ctx, "supprimer un terme du vocabulaire du métier");
  await supprimerTermeMetier(id);
  revalidatePath("/reglages/vocabulaire");
}
