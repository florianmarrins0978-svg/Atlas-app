"use server";

import { getCurrentCtx } from "@/server/session-ctx";
import { changerMotDePasse, deconnecterPartout } from "@/server/repositories/compte";
import { messageRefus } from "@/lib/mot-de-passe";

/**
 * Le mot de passe, et la déconnexion générale.
 *
 * **Aucune garde de rôle** : « Connexion » appartient à l'ensemble « Moi », et
 * c'est exactement ce qu'un salarié gardera — sa règle du 13 août 2026, *« un
 * salarié peut changer ses notifications ou son mot de passe »*.
 *
 * **Les refus sont des VALEURS.** Le message d'une exception levée par une
 * action serveur n'arrive jamais jusqu'à l'artisan : Next.js le remplace en
 * production par un identifiant opaque, et le banc sert une version bâtie
 * (`HANDOVER.md`, piège 0 ter). Un mot de passe actuel erroné est un refus
 * attendu, pas une panne — il se rend, il ne se lève pas.
 */
export type ResultatChangement = { ok: true } | { ok: false; raison: string };

export async function changerMotDePasseAction(
  actuel: string,
  nouveau: string,
  confirmation: string
): Promise<ResultatChangement> {
  const ctx = await getCurrentCtx();
  try {
    const r = await changerMotDePasse(ctx, actuel, nouveau, confirmation);
    return r.ok ? { ok: true } : { ok: false, raison: messageRefus(r.refus) };
  } catch (erreur) {
    // Journalisé AVANT de rendre : un défaut muet se répare à l'aveugle, et
    // c'est ce que `AGENTS.md` interdit.
    console.error("[reglages/connexion] changement de mot de passe interrompu", erreur);
    return { ok: false, raison: "Impossible de changer le mot de passe pour l'instant. Réessayez." };
  }
}

/**
 * « Me déconnecter partout », y compris l'appareil qui appuie.
 *
 * L'écran renvoie ensuite vers `/api/session-perimee`, qui efface les cookies
 * et ramène à la connexion. **Sans cette redirection, l'appareil resterait sur
 * une page dont la moindre action serait désormais refusée** — l'écran
 * paraîtrait figé, et c'est le piège du 10 août 2026 : un cookie mort que rien
 * n'efface.
 */
export async function deconnecterPartoutAction(): Promise<ResultatChangement> {
  const ctx = await getCurrentCtx();
  try {
    await deconnecterPartout(ctx);
    return { ok: true };
  } catch (erreur) {
    console.error("[reglages/connexion] déconnexion générale interrompue", erreur);
    return { ok: false, raison: "Impossible de vous déconnecter partout pour l'instant. Réessayez." };
  }
}
