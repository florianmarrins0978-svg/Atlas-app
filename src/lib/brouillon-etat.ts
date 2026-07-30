// Fraîcheur d'un brouillon d'informations par rapport à la dictée dont il est
// issu. Fonction pure : la comparaison se fait sur la transcription réellement
// enregistrée au moment de la génération (brouillons_informations.
// source_transcription) face à celle qui est disponible aujourd'hui.
//
// Un brouillon obsolète n'est JAMAIS supprimé automatiquement : il peut porter
// des corrections humaines, qui valent plus que la fraîcheur. On se contente de
// l'annoncer, et la régénération reste soumise à la garantie déjà en place
// (remplacement explicite obligatoire si le brouillon a été retouché).

export type EtatFraicheurBrouillon =
  | { obsolete: false }
  | { obsolete: true; raison: "note_supprimee" | "transcription_modifiee"; message: string };

export type EntreesFraicheur = {
  // Transcription ayant servi à générer le brouillon. null pour un brouillon
  // antérieur à l'enregistrement de cette source : on ne peut alors rien
  // affirmer, donc on ne signale rien.
  sourceTranscription: string | null;
  // Transcription actuellement disponible sur le chantier. null si la note a
  // été supprimée, ou si aucune transcription n'a encore abouti.
  transcriptionActuelle: string | null;
};

export function evaluerFraicheurBrouillon({
  sourceTranscription,
  transcriptionActuelle,
}: EntreesFraicheur): EtatFraicheurBrouillon {
  // Sans source connue, aucune comparaison n'est possible : ne jamais inventer
  // une obsolescence qu'on ne sait pas établir.
  if (sourceTranscription === null) return { obsolete: false };

  if (transcriptionActuelle === null) {
    return {
      obsolete: true,
      raison: "note_supprimee",
      message:
        "Ces informations proviennent d'une note vocale qui n'est plus disponible. Vérifiez-les avant de continuer.",
    };
  }

  if (transcriptionActuelle !== sourceTranscription) {
    return {
      obsolete: true,
      raison: "transcription_modifiee",
      message:
        "Ces informations ont été produites à partir d'une transcription plus ancienne. Vérifiez-les ou régénérez le brouillon.",
    };
  }

  return { obsolete: false };
}
