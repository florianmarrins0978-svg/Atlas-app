import { z } from "zod";
import type { Outil } from "./types";
import { getNoteVocale } from "../../repositories/notes-vocales";

export const lireTranscription: Outil = {
  nom: "LireTranscription",
  description: "Lit le texte de la transcription de la note vocale du chantier courant, si elle est disponible.",
  schema: z.object({}),
  async executer({ ctx, chantierId }) {
    if (!chantierId) return { erreur: "Aucun chantier dans le contexte courant." };
    const note = await getNoteVocale(ctx, chantierId);
    if (!note) return { disponible: false, raison: "Aucune note vocale pour ce chantier." };
    if (note.transcriptionStatut !== "reussie" || !note.transcription) {
      return { disponible: false, statut: note.transcriptionStatut };
    }
    return { disponible: true, transcription: note.transcription };
  },
};
