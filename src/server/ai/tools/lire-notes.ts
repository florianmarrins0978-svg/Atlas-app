import { z } from "zod";
import type { Outil } from "./types";
import { CHAMP_CHANTIER_VISE, chantierVise } from "./chantier-vise";
import { getNoteVocale } from "../../repositories/notes-vocales";

export const lireNotes: Outil = {
  nom: "LireNotes",
  description: "Lit les métadonnées de la note vocale d'un chantier (durée, statut de transcription), sans le " +
    "texte. Sans chantierId, celui qui est ouvert ; sinon, celui que RechercherChantier a rendu.",
  schema: z.object({ ...CHAMP_CHANTIER_VISE }),
  async executer(contexte, parametres) {
    const vise = chantierVise(contexte, parametres);
    if (!vise.ok) return vise.reponse;
    const { ctx } = contexte;
    const chantierId = vise.chantierId;
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
