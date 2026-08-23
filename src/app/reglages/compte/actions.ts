"use server";

import { getCurrentCtx } from "@/server/session-ctx";
import { renommerCompte } from "@/server/repositories/compte";

/**
 * Le nom du compte, écrit depuis les réglages.
 *
 * **Aucune garde de rôle, et c'est la règle.** « Mon compte » appartient à
 * l'ensemble « Moi » (`src/lib/rubriques-reglages.ts`) : c'est précisément ce
 * qu'un salarié garde quand tout le reste lui sera fermé. Sa règle du 13 août
 * 2026 : *« un salarié peut changer ses notifications ou son mot de passe »*.
 *
 * **Le retour est une valeur, jamais une exception.** Le message d'une erreur
 * levée par une action serveur n'arrive jamais jusqu'au patron — Next.js le
 * remplace en production par un identifiant opaque, et son banc sert une
 * version bâtie (`HANDOVER.md`, piège 0 ter).
 */
export type ResultatCompte = { ok: true } | { ok: false; raison: string };

export async function renommerCompteAction(nom: string): Promise<ResultatCompte> {
  const ctx = await getCurrentCtx();
  try {
    await renommerCompte(ctx, nom);
    return { ok: true };
  } catch (erreur) {
    // Journalisé AVANT de rendre : sans cela le défaut serait muet, et c'est le
    // piège que `AGENTS.md` nomme — « devant un défaut muet, la première
    // livraison n'est pas un correctif, c'est de rendre le défaut bavard ».
    console.error("[reglages/compte] renommage refusé", erreur);
    return { ok: false, raison: "Impossible d'enregistrer pour l'instant. Réessayez." };
  }
}
