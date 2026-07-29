import type { FournisseurTranscription, ResultatTranscription } from "./interface";
import { erreurIA } from "../../errors";

// Décision technique documentée (voir rapport du lot IA-01) : aucun fournisseur
// réel de transcription n'est accessible depuis cet environnement de
// développement (openai.ts bloqué par le réseau sandbox). Cet adaptateur sert
// de fournisseur par défaut en développement et dans les tests — jamais
// d'appel réseau, jamais de fausse transcription présentée comme réelle.
export const fournisseurTranscriptionDev: FournisseurTranscription = {
  nom: "dev",
  async transcrire(octets: Buffer, _mimeType: string): Promise<ResultatTranscription> {
    if (octets.length === 0) {
      return { succes: false, erreur: erreurIA("reponse_invalide", "Fichier audio vide.") };
    }
    return {
      succes: true,
      texte: `[Transcription simulée — fournisseur de développement, ${octets.length} octets reçus]`,
    };
  },
};
