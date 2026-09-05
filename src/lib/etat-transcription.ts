/**
 * DANS QUEL ÉTAT EST LA DICTÉE D'UN CHANTIER — une seule lecture, deux écrans.
 *
 * **Pourquoi cette fonction existe.** L'écran Transcription et l'écran
 * Informations lisaient la même note vocale, chacun avec ses propres `if`
 * enchaînés : l'un décidait ce qu'il affichait, l'autre décidait s'il pouvait
 * proposer un brouillon. Deux lectures de la même question finissent toujours
 * par diverger (`CLAUDE.md` §3), et celle-ci commande ce que le patron croit
 * de sa propre dictée.
 *
 * **Ce que l'état RÉPOND, et rien d'autre :** que s'est-il passé après qu'il a
 * appuyé sur le micro. Ce qu'on en fait à l'écran — une plage, un geste, une
 * couleur — appartient à l'écran.
 *
 * **`non_transcrite` et `jamais_lancee` ne se confondent pas**, et c'est payé.
 * Renvoyer vers la note vocale quelqu'un qui vient d'en enregistrer une, et
 * dont la transcription a rendu un texte de remplacement, c'est l'envoyer
 * refaire ce qu'il vient de faire en lui laissant croire qu'il s'y est mal
 * pris : c'est la transcription qui manque, pas la dictée.
 */

export type EtatTranscription =
  /** Ses mots sont là, transcrits pour de bon. */
  | "ecoutee"
  /** Le prestataire travaille : rien à lire, rien à corriger. */
  | "en_cours"
  /** Le prestataire a rendu une erreur. L'enregistrement, lui, est intact. */
  | "echouee"
  /** Une dictée existe, mais aucune transcription n'en est sortie. */
  | "non_transcrite"
  /** La note est là, sa transcription n'a jamais été lancée. */
  | "jamais_lancee"
  /** Aucune note vocale sur ce chantier. */
  | "aucune_note";

export type NoteLue = {
  transcription: string | null;
  transcriptionStatut: string | null;
} | null;

/**
 * @param simulee Vrai quand le texte enregistré est notre texte de
 * remplacement, et non une transcription — `estTranscriptionSimulee`. Il est
 * passé plutôt que déduit ici : la marque appartient au fournisseur, et une
 * seconde façon de la reconnaître serait une heuristique sur du texte
 * quelconque.
 */
export function etatTranscription(note: NoteLue, simulee: boolean): EtatTranscription {
  if (!note) return "aucune_note";
  // Le texte de remplacement passe AVANT le statut « réussie » : c'est
  // exactement ce statut-là qu'il porte, et le croire a déjà rempli un devis de
  // prestations que personne n'avait dictées.
  if (simulee) return "non_transcrite";
  if (note.transcriptionStatut === "reussie" && !!note.transcription) return "ecoutee";
  if (note.transcriptionStatut === "en_cours") return "en_cours";
  if (note.transcriptionStatut === "echouee") return "echouee";
  return "jamais_lancee";
}

/** Ses mots sont disponibles : c'est la seule condition pour proposer la suite. */
export function transcriptionDisponible(etat: EtatTranscription): boolean {
  return etat === "ecoutee";
}
