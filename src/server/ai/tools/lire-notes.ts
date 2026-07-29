import { z } from "zod";
import type { Outil } from "./types";
import { getNoteVocale } from "../../repositories/notes-vocales";

export const lireNotes: Outil = {
  nom: "LireNotes",
  description: "Lit les métadonnées de la note vocale du chantier courant (durée, statut de transcription), sans le texte.",
  schema: z.object({}),
  async executer({ ctx, chantierId }) {
    if (!chantierId) return { erreur: "Aucun chantier dans le contexte courant." };
    const note = await getNoteVocale(ctx, chantierId);
    if (!note) return { aUneNote: false };
    return {
      aUneNote: true,
      dureeSecondes: note.dureeSecondes,
      transcriptionStatut: note.transcriptionStatut,
      enregistreeLe: note.createdAt,
    };
  },
};
