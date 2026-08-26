import { z } from "zod";
import type { Outil } from "./types";
import { CHAMP_CHANTIER_VISE, chantierVise } from "./chantier-vise";
import { getNoteVocale } from "../../repositories/notes-vocales";

export const lireTranscription: Outil = {
  nom: "LireTranscription",
  description: "Lit le texte de la transcription de la note vocale d'un chantier, si elle est disponible. " +
    "Sans chantierId, celui qui est ouvert ; sinon, celui que RechercherChantier a rendu.",
  schema: z.object({ ...CHAMP_CHANTIER_VISE }),
  async executer(contexte, parametres) {
    const vise = chantierVise(contexte, parametres);
    if (!vise.ok) return vise.reponse;
    const { ctx } = contexte;
    const chantierId = vise.chantierId;
    const note = await getNoteVocale(ctx, chantierId);
    if (!note) return { disponible: false, raison: "Aucune note vocale pour ce chantier." };
    if (note.transcriptionStatut !== "reussie" || !note.transcription) {
      return { disponible: false, statut: note.transcriptionStatut };
    }
    return { disponible: true, transcription: note.transcription };
  },
};
