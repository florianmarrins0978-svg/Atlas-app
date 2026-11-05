"use server";

import { getCurrentCtx } from "@/server/session-ctx";
import { exigerEcran } from "@/server/garde-action";
import { verifierLimite, LIMITES } from "@/server/rate-limit";
import { preparerAudioEntrant } from "@/server/audio-entrant";
import { getFournisseurTranscription } from "@/server/ai/providers/transcription/fabrique";
import { indicePourDictee } from "@/server/ai/indice-dictee";
import { envoyerIdee } from "@/server/repositories/idees";
import { logger } from "@/server/logger";
import { LectureSeuleError } from "@/server/db/with-entreprise";
import { CONTACT_ATLAS } from "@/lib/contact-atlas";

/**
 * UNE IDÉE POUR L'APPLI — les deux gestes de l'artisan (sa planche du
 * 5 novembre 2026). **Tous les rôles** y ont droit, le salarié compris : c'est
 * lui qui est sur le chantier. La garde est celle de l'écran
 * (`/reglages/idee`, ouvert à chacun dans `acces-roles.ts`).
 *
 * **Rien ne lève ici** : le message d'une exception levée par une action
 * serveur ne lui parvient jamais (`AGENTS.md`, piège 0 ter). Chaque refus rend
 * sa phrase, et ce qui n'était pas prévu se journalise.
 */

const ECRAN = "/reglages/idee";

/**
 * **Écouter, sans rien garder.** La voix devient du texte et l'enregistrement
 * est oublié : la planche proposait d'écouter la note chez l'éditeur, et cela
 * aurait gardé la voix de chaque utilisateur sur un serveur. Le texte suffit à
 * dire ce qui manque ; c'est le chemin de la question dictée à l'assistant
 * (`dicterQuestionAction`).
 */
export async function transcrireIdeeAction(
  formData: FormData
): Promise<{ ok: true; texte: string } | { ok: false; raison: string }> {
  const ctx = await getCurrentCtx();
  await exigerEcran(ctx, ECRAN, "dicter une idée");

  const limite = await verifierLimite(`televersement:${ctx.entrepriseId}`, LIMITES.televersementFichier);
  if (!limite.autorise) return { ok: false, raison: limite.message };

  const fichier = formData.get("fichier");
  if (!(fichier instanceof File)) return { ok: false, raison: "Aucun enregistrement reçu." };

  try {
    const audio = await preparerAudioEntrant(fichier);
    if (!audio.ok) {
      logger.warn("idee_audio_refuse", { message: audio.message, taille: fichier.size, type: fichier.type });
      return { ok: false, raison: audio.message };
    }
    const transcripteur = getFournisseurTranscription();
    const transcrit = await transcripteur.transcrire(audio.octets, audio.mime, await indicePourDictee(ctx));
    if (!transcrit.succes) {
      logger.warn("idee_transcription_refusee", { fournisseur: transcripteur.nom, type: transcrit.erreur.type });
      return { ok: false, raison: transcrit.erreur.message };
    }
    const texte = transcrit.texte.trim();
    if (!texte) return { ok: false, raison: "Rien n'a été entendu. Réessayez en parlant plus près du téléphone." };
    return { ok: true, texte };
  } catch (erreur) {
    logger.error("idee_dictee_panne", { erreur, taille: fichier.size, type: fichier.type });
    return { ok: false, raison: "La dictée s'est arrêtée en chemin. Vous pouvez écrire votre idée." };
  }
}

/**
 * **Envoyer.** Appelé à la FERMETURE du tiroir « Envoyée, Annuler » : tant
 * qu'il est ouvert, rien n'est parti (`useRetraits`, la règle du retrait).
 */
export async function envoyerIdeeAction(texte: string): Promise<{ succes: boolean; erreur?: string }> {
  const ctx = await getCurrentCtx();
  await exigerEcran(ctx, ECRAN, "envoyer une idée");

  const limite = await verifierLimite(`idee:${ctx.utilisateurId}`, LIMITES.ideeEnvoyee);
  if (!limite.autorise) return { succes: false, erreur: limite.message };

  try {
    const resultat = await envoyerIdee(ctx, texte);
    return resultat.ok ? { succes: true } : { succes: false, erreur: resultat.message };
  } catch (erreur) {
    // **Essai fini ou abonnement arrêté : l'appli n'écrit plus rien**, une idée
    // non plus (`withEntreprise`, lecture seule). On le dit, et l'on donne
    // l'adresse : c'est souvent là qu'on a le plus à dire.
    if (erreur instanceof LectureSeuleError) {
      return { succes: false, erreur: `Votre abonnement est arrêté : l'idée ne peut pas partir d'ici. Écrivez-la à ${CONTACT_ATLAS}.` };
    }
    logger.error("idee_envoi_panne", { erreur, entrepriseId: ctx.entrepriseId });
    return { succes: false, erreur: "L'idée n'a pas pu partir. Réessayez dans un instant." };
  }
}
