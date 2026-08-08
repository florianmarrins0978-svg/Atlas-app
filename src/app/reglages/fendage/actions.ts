"use server";

import { revalidatePath } from "next/cache";
import { getCurrentCtx } from "@/server/session-ctx";
import { poserPrixFendage } from "@/server/repositories/grille-fendage";

/**
 * Poser — ou effacer — le prix d'une case de la grille de fendage.
 *
 * Pas de garde d'éditeur ici, contrairement au vocabulaire : ce sont les prix de
 * l'entreprise connectée, et l'isolation par entreprise (`withEntreprise`) fait
 * qu'un compte ne peut toucher que les siens. La case est validée dans le dépôt
 * — une clé inventée ne crée rien.
 *
 * Un prix vide efface la case : elle redevient une question posée, ce qui est
 * exactement ce qu'on veut quand on se rend compte qu'un prix était faux.
 */
export async function poserPrixFendageAction(cle: string, prix: string) {
  const ctx = await getCurrentCtx();
  await poserPrixFendage(ctx, cle, prix, "saisi");
  revalidatePath("/reglages/fendage");
}
