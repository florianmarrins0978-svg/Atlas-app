"use server";

import { revalidatePath } from "next/cache";
import { getCurrentCtx } from "@/server/session-ctx";
import { effacerClient } from "@/server/repositories/donnees-client";

/**
 * SUPPRIMER UN CLIENT — sa proposition C, tranchée le 27 août 2026.
 *
 * *« Je pense la C ; lorsqu'un client a des documents il faut mettre la phrase
 * de prévention, et une phrase disant avez-vous sauvegardé ses documents autre
 * part — et s'il dit oui il peut supprimer quand même. »*
 *
 * **Un refus attendu se REND, il ne se lève pas** (`AGENTS.md`, piège 0 ter) :
 * le message d'une exception levée par une action serveur n'arrive jamais
 * jusqu'à lui — Next.js le remplace en production par un identifiant opaque, et
 * son banc sert une version bâtie. « Ce client n'existe plus » est un refus
 * attendu : il descend en valeur de retour.
 *
 * **Aucune confirmation ne se rejoue ici.** L'écran a déjà posé la question de
 * la sauvegarde ; la refaire côté serveur voudrait dire transporter un « oui »
 * dans la requête, qu'un appel direct poserait tout aussi bien. Ce qui protège
 * pour de bon, c'est la loi appliquée en base — la facture émise que la clé
 * étrangère refuse de lâcher —, pas une case cochée.
 */
export async function supprimerClientAction(
  clientId: string
): Promise<
  | { ok: true; disparu: boolean; conserve: { numero: string; pourquoi: string }[] }
  | { ok: false; message: string }
> {
  const ctx = await getCurrentCtx();

  let rapport;
  try {
    rapport = await effacerClient(ctx, clientId);
  } catch (err) {
    // **Une panne imprévue se journalise AVANT de rendre une phrase.** Sans
    // cette ligne, le patron lirait « impossible pour l'instant » et personne,
    // nulle part, ne saurait pourquoi (`AGENTS.md` : rendre le défaut bavard).
    console.error("[supprimerClientAction] échec", { clientId, err });
    return {
      ok: false,
      message: "La suppression n'a pas abouti. Rien n'a été retiré — réessayez.",
    };
  }

  if (!rapport) {
    return { ok: false, message: "Ce client n'existe plus." };
  }

  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);

  return {
    ok: true,
    disparu: rapport.disparu,
    conserve: rapport.pieces.map((p) => ({ numero: p.numero, pourquoi: p.pourquoi })),
  };
}
