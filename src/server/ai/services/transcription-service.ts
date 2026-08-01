import type { Ctx } from "../../repositories/context";
import {
  getNoteVocale,
  marquerTranscriptionEnCours,
  enregistrerSuccesTranscription,
  enregistrerEchecTranscription,
} from "../../repositories/notes-vocales";
import { lireObjet } from "../../storage";
import { getFournisseurTranscription } from "../providers/transcription/fabrique";
import { ingererTranscription } from "../../documents/ingestion";

// Logique métier complète du déclenchement d'une transcription — le seul point
// d'entrée, quel que soit le déclencheur (bouton aujourd'hui ; demain : après
// l'upload, une file de traitement, un cron, un webhook, l'assistant
// conversationnel). Ne connaît aucun détail d'interface utilisateur.
// Ne perd jamais le fichier original (lecture seule) et n'invente jamais un
// texte en cas d'échec.
export async function lancerTranscription(ctx: Ctx, chantierId: string) {
  const note = await getNoteVocale(ctx, chantierId);
  if (!note) {
    throw new Error("Aucune note vocale pour ce chantier.");
  }

  // L'audio a pu être purgé une fois la transcription obtenue (docs/RGPD.md
  // §4). Retranscrire n'a alors plus de source, et il faut le dire clairement
  // plutôt que de laisser échouer la lecture du fichier sur un message vague.
  if (!note.storageKey) {
    return enregistrerEchecTranscription(
      ctx,
      chantierId,
      "L'enregistrement a été effacé après transcription : il ne peut plus être retranscrit."
    );
  }

  await marquerTranscriptionEnCours(ctx, chantierId);

  let octets: Buffer;
  try {
    octets = await lireObjet(note.storageKey);
  } catch {
    return enregistrerEchecTranscription(ctx, chantierId, "Fichier audio introuvable.");
  }

  const fournisseur = getFournisseurTranscription();
  const resultat = await fournisseur.transcrire(octets, note.mimeType);

  if (!resultat.succes) {
    return enregistrerEchecTranscription(ctx, chantierId, resultat.erreur.message);
  }
  const noteMiseAJour = await enregistrerSuccesTranscription(ctx, chantierId, resultat.texte);
  try {
    // Base documentaire (lot IA-07) : rend la transcription recherchable par
    // l'assistant. Un échec d'ingestion ne doit jamais faire échouer la
    // transcription elle-même, qui est la valeur principale de cette action.
    await ingererTranscription(ctx, chantierId);
  } catch {
    // Volontairement silencieux : voir commentaire ci-dessus.
  }
  return noteMiseAJour;
}
