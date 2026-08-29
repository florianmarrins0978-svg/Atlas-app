"use server";

import { exigerEcran } from "@/server/garde-action";
import { getCurrentCtx } from "@/server/session-ctx";
import { getNoteVocale, enregistrerSuccesTranscription } from "@/server/repositories/notes-vocales";
import { revalidatePath } from "next/cache";

// Le patron écrit lui-même ce qu'il a dicté.
//
// Pourquoi cette action existe : la dictée reste le but, mais elle ne peut pas
// fonctionner tant qu'aucun prestataire de transcription n'est raccordé
// (docs/A-FAIRE.md §1) — une décision qui engage un contrat et les données des
// clients de l'artisan. En attendant, tout ce qui suit la transcription
// (extraction, brouillon, prestations, prix, devis) restait hors de portée, et
// donc jamais éprouvé.
//
// Elle garde son utilité une fois la dictée branchée : un réseau coupé, un
// prestataire en panne ou une transcription fausse ne doivent pas faire perdre
// ce qui a été dit sur le chantier.

const LONGUEUR_MAX = 20_000;

export async function enregistrerTexteDicteAction(chantierId: string, texte: unknown) {
  if (typeof texte !== "string") {
    return { succes: false as const, erreur: "Texte invalide." };
  }

  const propre = texte.trim();
  if (propre.length === 0) {
    return { succes: false as const, erreur: "Le texte est vide." };
  }
  if (propre.length > LONGUEUR_MAX) {
    return { succes: false as const, erreur: "Le texte est trop long." };
  }

  const ctx = await getCurrentCtx();
  await exigerEcran(ctx, "/chantiers", "enregistrer un texte dicté");

  // Le modèle rattache la transcription à une note vocale : sans note, il n'y a
  // rien à mettre à jour. Le dire plutôt que d'échouer silencieusement.
  const note = await getNoteVocale(ctx, chantierId);
  if (!note) {
    return {
      succes: false as const,
      erreur: "Enregistrez d'abord une note vocale : le texte s'y rattache.",
    };
  }

  await enregistrerSuccesTranscription(ctx, chantierId, propre);

  // L'écran des informations lit la transcription pour décider quoi proposer :
  // sans cela, il continuerait d'annoncer qu'aucune dictée ne l'alimente.
  revalidatePath(`/chantiers/${chantierId}/transcription`);
  revalidatePath(`/chantiers/${chantierId}/informations`);

  return { succes: true as const };
}
