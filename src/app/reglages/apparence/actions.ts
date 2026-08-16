"use server";

import { getCurrentCtx } from "@/server/session-ctx";
import { ecrireCharte } from "@/server/repositories/charte-personne";
import type { NomCharte } from "@/lib/chartes";

/**
 * Choisir sa charte de couleurs.
 *
 * **Aucune garde de rôle** : « Apparence » appartient à l'ensemble « Moi ».
 * C'est le goût de la personne, et un salarié y a droit comme le patron.
 *
 * **PAS de `revalidatePath("/", "layout")`, et c'est délibéré.** Le premier jet
 * en posait un : le gabarit lit la charte au serveur, il semblait donc falloir
 * lui dire de se refaire. C'est inutile — le gabarit est dynamique, chaque
 * navigation le rejoue — et surtout **nuisible** : invalider la racine vide le
 * cache de TOUTE l'application à chaque appui, ce qui, dans la batterie, a
 * suffi à faire tomber une suite voisine par simple ralentissement. Éprouvé :
 * `test-chartes-e2e.ts` vérifie que la couleur suit sans cette ligne.
 */
export type ResultatCharte = { ok: true; charte: NomCharte | null } | { ok: false; raison: string };

export async function choisirCharteAction(nom: string): Promise<ResultatCharte> {
  const ctx = await getCurrentCtx();
  try {
    const retenue = await ecrireCharte(ctx.utilisateurId, nom);
    return { ok: true, charte: retenue };
  } catch (erreur) {
    // Journalisé avant de rendre : un défaut muet se répare à l'aveugle.
    console.error("[reglages/apparence] choix de charte refusé", erreur);
    return { ok: false, raison: "Impossible d'enregistrer ce choix pour l'instant. Réessayez." };
  }
}
