"use server";

import { getCurrentCtx } from "@/server/session-ctx";
import { ecrireIdentite } from "@/server/repositories/compte";
import { poserMaPhoto } from "@/server/repositories/photo-des-personnes";
import { enregistrerObjet, supprimerObjet } from "@/server/storage";
import { preparerPhotoEntrante } from "@/server/photo-entrante";
import { verifierLimite, LIMITES } from "@/server/rate-limit";
import { logger } from "@/server/logger";

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

export async function ecrireIdentiteAction(identite: {
  civilite: string | null;
  prenom: string;
  nom: string;
}): Promise<ResultatCompte> {
  const ctx = await getCurrentCtx();
  try {
    await ecrireIdentite(ctx, identite);
    return { ok: true };
  } catch (erreur) {
    // Journalisé AVANT de rendre : sans cela le défaut serait muet, et c'est le
    // piège que `AGENTS.md` nomme — « devant un défaut muet, la première
    // livraison n'est pas un correctif, c'est de rendre le défaut bavard ».
    console.error("[reglages/compte] renommage refusé", erreur);
    return { ok: false, raison: "Impossible d'enregistrer pour l'instant. Réessayez." };
  }
}

/**
 * Pose SA photo de profil : sa demande du 27 septembre 2026, *« chaque
 * personne doit pouvoir mettre et changer sa photo de profil »*.
 *
 * **Aucune garde de rôle, comme le reste de Mon compte** : c'est SA tête. La
 * cible se lit dans la session (`poserMaPhoto`), jamais dans la demande.
 * L'image passe par la porte commune : le GPS d'une photo prise chez soi ne
 * part pas dans le stockage.
 */
export async function poserMaPhotoAction(
  formData: FormData
): Promise<{ ok: true; photo: string } | { ok: false; raison: string }> {
  const ctx = await getCurrentCtx();
  try {
    const fichier = formData.get("fichier");
    if (!(fichier instanceof File)) return { ok: false, raison: "Aucune photo reçue." };

    const limite = await verifierLimite(`televersement:${ctx.entrepriseId}`, LIMITES.televersementFichier);
    if (!limite.autorise) return { ok: false, raison: limite.message };

    const prete = await preparerPhotoEntrante(fichier, "photo de profil");
    if (!prete.ok) return { ok: false, raison: prete.raison };

    const objet = await enregistrerObjet(
      `entreprises/${ctx.entrepriseId}/personnes`,
      prete.photo.octets,
      prete.photo.extension,
      prete.photo.mimeType
    );
    const { avant } = await poserMaPhoto(ctx, objet.storageKey);
    if (avant) await supprimerObjet(avant);
    return { ok: true, photo: objet.storageKey };
  } catch (err) {
    logger.error("Enregistrement de la photo de profil impossible", {
      erreur: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, raison: "Cette photo n'a pas pu être enregistrée. Réessayez." };
  }
}

/** Retire SA photo, et son fichier avec : une tête qu'on retire disparaît vraiment. */
export async function retirerMaPhotoAction(): Promise<{ ok: true } | { ok: false; raison: string }> {
  const ctx = await getCurrentCtx();
  try {
    const { avant } = await poserMaPhoto(ctx, null);
    if (avant) await supprimerObjet(avant);
    return { ok: true };
  } catch (err) {
    logger.error("Retrait de la photo de profil impossible", {
      erreur: err instanceof Error ? err.message : String(err),
    });
    return { ok: false, raison: "Cette photo n'a pas pu être retirée. Réessayez." };
  }
}
