"use server";

import { getCurrentCtx } from "@/server/session-ctx";
import { enregistrerNoteVocale, supprimerNoteVocale } from "@/server/repositories/notes-vocales";
import { enregistrerObjet } from "@/server/storage";
import { verifierLimite, LIMITES } from "@/server/rate-limit";
import { verifierTailleFichier, verifierTypeAudio } from "@/server/upload-limits";
import { lancerTranscription } from "@/server/ai/services/transcription-service";

function extensionPour(mimeType: string): string {
  if (mimeType.includes("webm")) return ".webm";
  if (mimeType.includes("ogg")) return ".ogg";
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) return ".m4a";
  if (mimeType.includes("mpeg") || mimeType.includes("mp3")) return ".mp3";
  if (mimeType.includes("wav")) return ".wav";
  if (mimeType.includes("aac")) return ".aac";
  if (mimeType.includes("flac")) return ".flac";
  return ".audio";
}

export async function enregistrerNoteVocaleAction(chantierId: string, formData: FormData) {
  const fichier = formData.get("fichier");
  if (!(fichier instanceof File)) {
    throw new Error("Aucun fichier audio reçu.");
  }
  const validationTaille = verifierTailleFichier(fichier);
  if (!validationTaille.ok) {
    throw new Error(validationTaille.message);
  }
  // Contrôle serveur du format : l'écran filtre déjà via `accept`, mais cet
  // attribut n'est qu'un confort d'interface et ne protège rien.
  const validationType = verifierTypeAudio(fichier.type);
  if (!validationType.ok) {
    throw new Error(validationType.message);
  }
  const dureeSecondes = Number(formData.get("dureeSecondes") ?? 0) || undefined;

  const ctx = await getCurrentCtx();

  const limite = await verifierLimite(`televersement:${ctx.entrepriseId}`, LIMITES.televersementFichier);
  if (!limite.autorise) {
    throw new Error(limite.message);
  }

  const octets = Buffer.from(await fichier.arrayBuffer());
  const mimeType = fichier.type || "audio/webm";
  const objet = await enregistrerObjet(`chantiers/${chantierId}/notes`, octets, extensionPour(mimeType));

  const note = await enregistrerNoteVocale(ctx, chantierId, {
    storageKey: objet.storageKey,
    mimeType,
    tailleOctets: objet.tailleOctets,
    nomOriginal: fichier.name || undefined,
    checksum: objet.checksum,
    dureeSecondes,
  });

  return { storageKey: note.storageKey, dureeSecondes: note.dureeSecondes };
}

export async function supprimerNoteVocaleAction(chantierId: string) {
  const ctx = await getCurrentCtx();
  await supprimerNoteVocale(ctx, chantierId);
}

// Simple déclencheur — toute la logique métier vit dans le service
// (src/server/ai/services/transcription-service.ts), réutilisable demain
// depuis un upload, une file de traitement, un cron, un webhook ou l'assistant
// conversationnel, sans aucune modification de cette logique.
export async function lancerTranscriptionAction(chantierId: string) {
  const ctx = await getCurrentCtx();
  return lancerTranscription(ctx, chantierId);
}
