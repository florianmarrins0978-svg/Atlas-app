"use server";

import { getCurrentCtx } from "@/server/session-ctx";
import { poserQuestion, type MessageAssistant, type ReponseAssistant } from "@/server/ai/services/assistant-service";
import { verifierLimite, LIMITES } from "@/server/rate-limit";
import { getRole } from "@/server/autorisation";
import { peutUtiliserLAssistant } from "@/lib/acces-roles";
import { ajouterAuFilAssistant, lireFilAssistant, viderFilAssistant } from "@/server/repositories/fil-assistant";
import { logger } from "@/server/logger";
import { preparerAudioEntrant } from "@/server/audio-entrant";
import { preparerPhotoEntrante } from "@/server/photo-entrante";
import { getFournisseurTranscription } from "@/server/ai/providers/transcription/fabrique";
import { regarderPhoto } from "@/server/ai/services/regarder-photo";

/**
 * Le fil déjà écrit, relu à l'ouverture du panneau.
 *
 * **Rend un tableau vide plutôt qu'un refus** quand le compte n'a pas
 * l'assistant : l'écran n'a rien à afficher, et une erreur ici ferait rougir un
 * panneau qui, de toute façon, ne s'ouvre pas.
 */
export async function lireFilAction(): Promise<MessageAssistant[]> {
  const ctx = await getCurrentCtx();
  const role = await getRole(ctx);
  if (!role || !peutUtiliserLAssistant(role)) return [];
  try {
    return await lireFilAssistant(ctx);
  } catch (erreur) {
    // **Un fil qu'on ne sait pas relire ne doit pas fermer l'assistant.** Il
    // repart vierge, ce qui est exactement l'état d'avant ce lot — et la panne
    // se journalise, sinon personne ne saura jamais pourquoi il oublie.
    logger.error("Fil de l'assistant illisible", { erreur });
    return [];
  }
}

/** Repartir de zéro, à son geste. */
export async function viderFilAction(): Promise<void> {
  const ctx = await getCurrentCtx();
  const role = await getRole(ctx);
  if (!role || !peutUtiliserLAssistant(role)) return;
  await viderFilAssistant(ctx);
}

/**
 * DICTER SA QUESTION PLUTÔT QUE LA TAPER.
 *
 * **Sa demande du 27 août 2026 : « fais la 1 et la 4 ».** La 1 était *lui
 * parler* — sur un chantier, les mains sales, entre deux tailles de haie.
 *
 * **Elle REMPLIT le champ, elle n'envoie rien.** C'est la règle de
 * `DicterCoordonnees` depuis le 7 août : il relit avant que ça parte. Une
 * question mal entendue qui déclencherait une proposition sur le mauvais
 * client coûterait plus cher que dix secondes de relecture.
 *
 * **Elle ne passe PAS par le modèle**, seulement par la transcription : ce
 * qu'il a dit, tel quel. Faire « améliorer » sa phrase, c'est risquer de
 * changer un nom de client.
 */
export async function dicterQuestionAction(formData: FormData): Promise<{ ok: true; texte: string } | { ok: false; raison: string }> {
  const ctx = await getCurrentCtx();
  const role = await getRole(ctx);
  if (!role || !peutUtiliserLAssistant(role)) {
    return { ok: false, raison: "L'assistant n'est pas disponible pour votre compte." };
  }

  const limite = await verifierLimite(`televersement:${ctx.entrepriseId}`, LIMITES.televersementFichier);
  if (!limite.autorise) return { ok: false, raison: limite.message };

  // **LA PORTE COMMUNE** : le format se lit dans les octets, jamais dans ce que
  // le téléphone annonce (`src/server/audio-entrant.ts`). Ce chemin ne stocke
  // rien — il transcrit —, mais c'est un appel facturé chez le fournisseur.
  const fichier = formData.get("fichier");
  if (!(fichier instanceof File)) return { ok: false, raison: "Aucun enregistrement reçu." };

  /**
   * **RIEN NE LÈVE ICI, ET C'EST LE SUJET.**
   *
   * **Sa capture du 27 août 2026 au soir :** « La dictée n'a pas abouti. Vous
   * pouvez écrire votre question. » — la phrase du `catch` de l'écran, celle
   * qu'on affiche quand on ne sait RIEN. Le message d'une exception levée par
   * une action serveur ne lui parvient jamais (`HANDOVER.md`, piège 0 ter) :
   * une panne qui lève est donc une panne muette, et deviner sa cause, c'est
   * réparer une panne imaginée (`AGENTS.md`).
   *
   * Chaque refus rend donc SA phrase, et ce qui n'était pas prévu se
   * journalise avant de rendre la main. Le prochain rouge dira où regarder.
   */
  try {
    const audio = await preparerAudioEntrant(fichier);
    if (!audio.ok) {
      logger.warn("dictee_assistant_audio_refuse", { message: audio.message, taille: fichier.size, type: fichier.type });
      return { ok: false, raison: audio.message };
    }

    const transcripteur = getFournisseurTranscription();
    const transcrit = await transcripteur.transcrire(audio.octets, audio.mime);
    if (!transcrit.succes) {
      logger.warn("dictee_assistant_transcription_refusee", {
        fournisseur: transcripteur.nom,
        type: transcrit.erreur.type,
      });
      // Le message du fournisseur est repris tel quel : « clé refusée » et
      // « quota dépassé » ne se réparent pas de la même façon.
      return { ok: false, raison: transcrit.erreur.message };
    }

    const texte = transcrit.texte.trim();
    if (!texte) {
      return { ok: false, raison: "Rien n'a été entendu. Réessayez en parlant plus près du téléphone." };
    }
    return { ok: true, texte };
  } catch (erreur) {
    logger.error("dictee_assistant_panne", {
      erreur,
      taille: fichier.size,
      type: fichier.type,
      nom: fichier.name,
    });
    return { ok: false, raison: "La dictée s'est arrêtée en chemin. Le journal du serveur en garde la trace." };
  }
}

/**
 * LUI MONTRER UNE PHOTO — une plaque, un devis de fournisseur, un relevé.
 *
 * **Sa demande du 27 août 2026, point 4.** La photo est LUE (`regarderPhoto`),
 * et c'est cette lecture qui entre dans la conversation — jamais l'image
 * elle-même : `genererAvecOutils` ne sait pas la porter, et le dépôt fait déjà
 * ainsi pour le ticket de caisse depuis le 13 août.
 *
 * **La photo passe par la porte commune**, comme les photos de chantier et les
 * croquis : ses métadonnées — dont les coordonnées GPS du jardin d'un client —
 * sont retirées AVANT tout envoi chez un tiers, et un fichier qu'on ne sait pas
 * nettoyer est refusé (`src/server/photo-entrante.ts`).
 *
 * **Rien n'est stocké.** Elle est lue, puis oubliée ; seule la lecture survit,
 * dans le fil.
 */
export async function regarderPhotoAction(formData: FormData): Promise<{ ok: true; lecture: string } | { ok: false; raison: string }> {
  const ctx = await getCurrentCtx();
  const role = await getRole(ctx);
  if (!role || !peutUtiliserLAssistant(role)) {
    return { ok: false, raison: "L'assistant n'est pas disponible pour votre compte." };
  }

  const limite = await verifierLimite(`assistant:${ctx.entrepriseId}`, LIMITES.assistant);
  if (!limite.autorise) return { ok: false, raison: limite.message };

  // Comme la dictée : rien ne lève, tout rend sa phrase, et l'imprévu se
  // journalise. Une panne muette se devine, et une panne devinée se répare de
  // travers (`AGENTS.md`).
  try {
    const prete = await preparerPhotoEntrante(formData.get("photo"), "photo montrée à l'assistant", {
      // La même borne que le croquis d'arrosage : elle ne protège pas la mémoire
      // du serveur, elle borne une facture de vision et évite un appel qui tombe.
      octets: 8 * 1024 * 1024,
      message: "Cette photo dépasse 8 Mo. Reprenez-la en plus petit.",
    });
    if (!prete.ok) return { ok: false, raison: prete.raison };

    const lu = await regarderPhoto(prete.photo.octets.toString("base64"), prete.photo.mimeType);
    if (!lu.ok) return { ok: false, raison: lu.raison };
    return { ok: true, lecture: lu.lecture };
  } catch (erreur) {
    logger.error("photo_assistant_panne", { erreur });
    return { ok: false, raison: "La photo n'a pas pu être regardée. Le journal du serveur en garde la trace." };
  }
}

// Le client ne transmet que l'identifiant du chantier courant (déduit de
// l'URL) — jamais les données elles-mêmes. Tout le contexte réel (chantier,
// client, prestations, etc.) est reconstitué côté serveur par les outils.
export async function poserQuestionAction(
  chantierId: string | null,
  historique: MessageAssistant[],
  question: string,
  /**
   * Ce qu'une photo montrée a donné à lire (`regarderPhotoAction`).
   *
   * **Elle repasse par le navigateur, et ce n'est pas un relâchement.**
   * L'assistant est réservé au patron, sa question est déjà du texte libre
   * qu'il compose, et **aucun geste ne s'exécute sans qu'il le coche**. Ce
   * champ n'ouvre donc rien de plus que la question elle-même — et il entre
   * dans la conversation comme une DONNÉE, jamais comme une consigne
   * (`assistant-service.ts`, la règle du contenu fourni par un tiers).
   */
  observation?: string
): Promise<ReponseAssistant> {
  const ctx = await getCurrentCtx();

  /**
   * **L'assistant n'est pas pour un salarié, et le refus est ICI.**
   *
   * Il reconstitue au serveur le chantier, le client, les prestations et les
   * PRIX (`assistant-service`) : sans cette ligne, tout ce que les rôles
   * ferment se rouvrirait en le DEMANDANT — la porte la plus difficile à
   * surveiller, puisqu'elle n'a pas d'adresse à garder.
   *
   * **Rendu en valeur, jamais levé** : le message d'une exception d'action
   * serveur n'arrive jamais jusqu'à l'artisan (`HANDOVER.md`, piège 0 ter).
   */
  const role = await getRole(ctx);
  if (!role || !peutUtiliserLAssistant(role)) {
    return { succes: false, erreur: "L'assistant n'est pas disponible pour votre compte." };
  }

  // Limité par entreprise : contrôle de coût sur les appels IA (facturés par
  // requête chez la plupart des fournisseurs), pas seulement anti-abus.
  const limite = await verifierLimite(`assistant:${ctx.entrepriseId}`, LIMITES.assistant);
  if (!limite.autorise) {
    return { succes: false, erreur: limite.message };
  }

  const reponse = await poserQuestion(ctx, chantierId, historique, question, observation);

  /**
   * **Le fil s'écrit APRÈS la réponse, et les deux messages ensemble.**
   *
   * Écrire la question d'abord laisserait, sur une panne du fournisseur, une
   * phrase sans suite : au rechargement, l'assistant relirait sa propre
   * question comme si elle venait d'arriver.
   *
   * **Et un défaut d'écriture ne mange pas la réponse** : elle est déjà
   * calculée, elle a déjà coûté un appel, et il l'attend à l'écran. Ce qui se
   * perd alors est la mémoire, pas le travail — et la perte se journalise.
   */
  if (reponse.succes) {
    try {
      await ajouterAuFilAssistant(ctx, chantierId, [
        { role: "user", contenu: question },
        { role: "assistant", contenu: reponse.texte },
      ]);
    } catch (erreur) {
      logger.error("Le fil de l'assistant n'a pas pu être écrit", { erreur });
    }
  }

  return reponse;
}
