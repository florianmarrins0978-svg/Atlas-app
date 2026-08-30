"use server";

import { exigerEcran } from "@/server/garde-action";
import { getCurrentCtx } from "@/server/session-ctx";
import { supprimerNoteVocale } from "@/server/repositories/notes-vocales";
import { verifierLimite, LIMITES } from "@/server/rate-limit";
import { preparerAudioEntrant } from "@/server/audio-entrant";
import { logger } from "@/server/logger";
import { messageDePanne, type EtapeNote } from "@/lib/panne-note-vocale";
import { lancerTranscription } from "@/server/ai/services/transcription-service";
import { completerNoteVocale } from "@/server/ai/services/complement-note-service";


/**
 * **L'enregistrement d'une note ne passe plus par une action serveur.**
 *
 * Il est parti dans `src/app/api/notes-vocales/[chantierId]/route.ts`, le
 * 12 août 2026, après trois signalements du patron : *« L'enregistrement n'a
 * pas pu être transmis — la connexion a été interrompue. »*
 *
 * Une action serveur n'a pas d'adresse : elle a un identifiant fabriqué à la
 * construction et inscrit dans la page. Son banc se reconstruit tout seul, et
 * la fiche du chantier est justement l'écran où l'on STATIONNE avant de dicter
 * — la page appelait donc un identifiant que le nouveau serveur ne connaissait
 * plus. Une URL, elle, ne vieillit pas.
 *
 * **Ne pas la ramener ici.** Le raisonnement complet, et les trois bénéfices
 * qui valent indépendamment de cette cause, sont dans
 * `src/server/services/note-vocale-entrante.ts`.
 */

export async function supprimerNoteVocaleAction(chantierId: string) {
  const ctx = await getCurrentCtx();
  await exigerEcran(ctx, "/chantiers", "supprimer une note vocale");
  await supprimerNoteVocale(ctx, chantierId);
}

// Simple déclencheur — toute la logique métier vit dans le service
// (src/server/ai/services/transcription-service.ts), réutilisable demain
// depuis un upload, une file de traitement, un cron, un webhook ou l'assistant
// conversationnel, sans aucune modification de cette logique.
export async function lancerTranscriptionAction(chantierId: string) {
  const ctx = await getCurrentCtx();
  await exigerEcran(ctx, "/chantiers", "lancer une transcription");
  return lancerTranscription(ctx, chantierId);
}

/**
 * Ajouter à une note vocale qu'on a arrêtée trop tôt.
 *
 * Le patron, le 7 août 2026 : « sans faire exprès j'ai mis fin à ma note vocale
 * mais j'avais encore des choses à dire ». La seule issue était « Remplacer la
 * note » — tout refaire. Le complément s'ajoute désormais à la suite ; le
 * pourquoi de ce choix vit dans `complement-note-service.ts`.
 */
export async function completerNoteVocaleAction(chantierId: string, formData: FormData) {
  // Mêmes refus qu'à l'enregistrement, rendus plutôt que levés pour la même
  // raison : voir `note-vocale-entrante.ts`.
  //
  // **Mais ils ne peuvent pas emprunter le champ `raison` du service.** Celui-ci
  // y met des CODES — « aucune_note », « transcription », « vide » — que l'écran
  // traduit en phrases. Y glisser une phrase toute faite la ferait comparer à
  // « vide », échouer, et retomber sur le libellé générique : le refus
  // redeviendrait muet, ce qu'on est précisément en train de réparer. Les refus
  // d'entrée portent donc leur texte dans `detail`, que l'écran affiche tel quel.
  const refus = (detail: string) => ({ ok: false as const, raison: "refuse" as const, detail });

  const fichier = formData.get("fichier");
  if (!(fichier instanceof File)) return refus("Aucun son n'est arrivé jusqu'au serveur.");

  // Ne lève pas davantage que l'enregistrement, et pour la même raison : une
  // exception n'arrive jamais lisible chez le patron, et sa phrase de secours
  // accuse le réseau alors que la panne est au serveur.
  let etape: EtapeNote = "session";
  try {
    const ctx = await getCurrentCtx();
    await exigerEcran(ctx, "/chantiers", "compléter une note vocale");

    etape = "cadence";
    const limite = await verifierLimite(`televersement:${ctx.entrepriseId}`, LIMITES.televersementFichier);
    if (!limite.autorise) return refus(limite.message);

    // **LA PORTE COMMUNE** — taille, lecture, vide, puis le FORMAT lu dans les
    // octets (`src/server/audio-entrant.ts`). Elle vient après la cadence, qui
    // seule empêche de la faire travailler en rafale.
    etape = "lecture";
    const audio = await preparerAudioEntrant(fichier);
    if (!audio.ok) return refus(audio.message);
    const octets = audio.octets;

    // **Le service rend DÉJÀ un résultat, pas une exception** —
    // `ResultatComplement`, avec ses propres raisons (« aucune_note »,
    // « transcription », « vide ») que l'écran traduit. On le rend tel quel :
    // l'envelopper dans un second `ok` ferait passer un `{ ok: false }` du
    // service pour une réussite.
    etape = "base";
    // Le type envoyé au fournisseur de transcription est celui du format
    // RECONNU. Avant, c'était `fichier.type || "audio/webm"` — donc la chaîne
    // du téléphone, avec un repli qui inventait un format.
    return await completerNoteVocale(ctx, chantierId, octets, audio.mime);
  } catch (err) {
    logger.error("Note vocale : le complément a échoué", {
      chantierId,
      etape,
      // Ce que le TÉLÉPHONE a annoncé : à cet endroit, la panne a pu survenir
      // avant qu'un format soit reconnu.
      typeAnnonce: fichier.type || "aucun",
      tailleOctets: fichier.size,
      motif: err instanceof Error ? err.message : String(err),
    });
    return refus(messageDePanne(etape, err));
  }
}
