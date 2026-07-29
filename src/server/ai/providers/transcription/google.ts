import type { FournisseurTranscription, ResultatTranscription } from "./interface";
import { erreurIA } from "../../errors";

// Stub documenté — non implémenté dans ce lot.
export const fournisseurTranscriptionGoogle: FournisseurTranscription = {
  nom: "google",
  // Paramètres exigés par la signature de l'interface FournisseurTranscription.transcrire —
  // non utilisés dans ce stub non implémenté, ne peuvent pas être supprimés
  // sans rompre la conformité de type de l'objet exporté.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async transcrire(_octets: Buffer, _mimeType: string): Promise<ResultatTranscription> {
    return { succes: false, erreur: erreurIA("fournisseur_indisponible", "Fournisseur de transcription Google non implémenté.") };
  },
};
