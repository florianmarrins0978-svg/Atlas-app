"use server";

import { revalidatePath } from "next/cache";
import { getCurrentCtx } from "@/server/session-ctx";
import { ecrireCharte } from "@/server/repositories/charte-personne";
import type { NomCharte } from "@/lib/chartes";

/**
 * Choisir sa charte de couleurs.
 *
 * **Aucune garde de rôle** : « Apparence » appartient à l'ensemble « Moi ».
 * C'est le goût de la personne, et un salarié y a droit comme le patron.
 *
 * **`revalidatePath("/", "layout")` n'est pas un détail.** Les variables de
 * couleur sont posées par le GABARIT, au serveur. Sans cette invalidation, le
 * choix serait bien enregistré et l'écran resterait dans l'ancienne charte
 * jusqu'au prochain rechargement complet — le patron toucherait, rien ne
 * bougerait, et il croirait à une panne. C'est exactement ce qu'il a interdit.
 */
export type ResultatCharte = { ok: true; charte: NomCharte | null } | { ok: false; raison: string };

export async function choisirCharteAction(nom: string): Promise<ResultatCharte> {
  const ctx = await getCurrentCtx();
  try {
    const retenue = await ecrireCharte(ctx.utilisateurId, nom);
    revalidatePath("/", "layout");
    return { ok: true, charte: retenue };
  } catch (erreur) {
    // Journalisé avant de rendre : un défaut muet se répare à l'aveugle.
    console.error("[reglages/apparence] choix de charte refusé", erreur);
    return { ok: false, raison: "Impossible d'enregistrer ce choix pour l'instant. Réessayez." };
  }
}
