import type { FournisseurTranscription, ResultatTranscription } from "./interface";
import { erreurIA } from "../../errors";

// Stub documenté — non implémenté dans ce lot.
export const fournisseurTranscriptionDeepgram: FournisseurTranscription = {
  nom: "deepgram",
  async transcrire(_octets: Buffer, _mimeType: string): Promise<ResultatTranscription> {
    return { succes: false, erreur: erreurIA("fournisseur_indisponible", "Fournisseur de transcription Deepgram non implémenté.") };
  },
};
