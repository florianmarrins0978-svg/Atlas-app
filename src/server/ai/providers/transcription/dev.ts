import type { FournisseurTranscription, ResultatTranscription } from "./interface";
import { erreurIA } from "../../errors";

// Décision technique documentée (voir rapport du lot IA-01) : aucun fournisseur
// réel de transcription n'est accessible depuis cet environnement de
// développement (openai.ts bloqué par le réseau sandbox). Cet adaptateur sert
// de fournisseur par défaut en développement et dans les tests — jamais
// d'appel réseau, jamais de fausse transcription présentée comme réelle.
// Marque le texte de remplacement pour qu'il soit reconnaissable à coup sûr,
// sans jamais deviner : c'est NOTRE constante, importée là où il faut la
// reconnaître, jamais une heuristique sur du texte quelconque.
//
// Pourquoi c'est indispensable : ce texte était traité comme une vraie
// transcription, découpé en segments, et chaque segment ressortait sous forme
// de PRESTATION dans le devis du patron. Un devis ne se remplit jamais de
// quelque chose que personne n'a dit.
export const PREFIXE_TRANSCRIPTION_SIMULEE = "[Transcription simulée —";

/** Vrai si ce texte n'est pas une transcription mais notre texte de remplacement. */
export function estTranscriptionSimulee(texte: string | null | undefined): boolean {
  return !!texte && texte.trimStart().startsWith(PREFIXE_TRANSCRIPTION_SIMULEE);
}

export const fournisseurTranscriptionDev: FournisseurTranscription = {
  nom: "dev",
  // mimeType est exigé par la signature de l'interface FournisseurTranscription.transcrire —
  // non utilisé par ce fournisseur de développement (simulation basée uniquement
  // sur la taille des octets reçus), ne peut pas être supprimé sans rompre la
  // conformité de type de l'objet exporté.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async transcrire(octets: Buffer, _mimeType: string): Promise<ResultatTranscription> {
    if (octets.length === 0) {
      return { succes: false, erreur: erreurIA("reponse_invalide", "Fichier audio vide.") };
    }
    return {
      succes: true,
      texte: `${PREFIXE_TRANSCRIPTION_SIMULEE} fournisseur de développement, ${octets.length} octets reçus]`,
    };
  },
};
