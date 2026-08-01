// Durées de conservation — voir docs/RGPD.md §4.
//
// Le principe qui commande tout : **ce qui n'est pas conservé ne peut pas
// fuir.** C'est la mesure de sécurité la moins coûteuse et la plus efficace du
// produit, et la seule qui protège aussi contre les erreurs à venir.
//
// Les règles vivent ici, séparées de la base, pour être exercées sans elle et
// relues sans lire du SQL. Une durée qu'on ne peut pas relire facilement est
// une durée que personne ne vérifie.

/** Millisecondes dans un jour. */
const JOUR = 86_400_000;

export const RETENTION = {
  /**
   * Audio d'une note vocale, après obtention de la transcription.
   *
   * La donnée la plus sensible du produit : dictée librement sur un chantier,
   * elle peut capter des propos qui n'ont rien à y faire. Une fois le texte
   * obtenu, l'audio n'apporte plus rien.
   *
   * Sept jours plutôt que zéro : une transcription ratée ou contestée doit
   * pouvoir être reprise depuis la source. Passé ce délai, personne n'y
   * reviendra jamais.
   */
  audioApresTranscriptionJours: 7,

  /**
   * Fichiers orphelins (remplacés, supprimés) — déjà en place avant ce lot.
   * Court volontairement : ces objets ne sont plus référencés par rien.
   */
  fichiersOrphelinsHeures: 24,

  /**
   * Journaux techniques : identifiants de session, adresses IP, contextes
   * d'erreur. Assez pour instruire un incident, pas au-delà.
   */
  journauxJours: 180,

  /**
   * Délai après fermeture d'un compte, avant effacement complet. Laisse le
   * temps de revenir sur une suppression regrettée, sans conserver
   * indéfiniment.
   */
  compteFermeJours: 30,
} as const;

/**
 * L'audio de cette note doit-il être purgé ?
 *
 * Trois conditions, toutes nécessaires :
 * - l'audio existe encore ;
 * - la transcription a réussi — sans elle, purger détruirait la seule source ;
 * - le délai de reprise est écoulé.
 */
export function audioAPurger(
  note: {
    storageKey: string | null;
    transcription: string | null;
    transcriptionStatut: string;
    updatedAt: Date;
  },
  maintenant: Date = new Date()
): boolean {
  if (!note.storageKey) return false;
  if (note.transcriptionStatut !== "reussie") return false;
  if (!note.transcription || note.transcription.trim() === "") return false;

  const ecoule = maintenant.getTime() - note.updatedAt.getTime();
  return ecoule >= RETENTION.audioApresTranscriptionJours * JOUR;
}

/** Date avant laquelle un enregistrement transcrit n'a plus à conserver son audio. */
export function seuilPurgeAudio(maintenant: Date = new Date()): Date {
  return new Date(maintenant.getTime() - RETENTION.audioApresTranscriptionJours * JOUR);
}

/**
 * Ce qu'un effacement de client peut retirer, et ce qu'il doit conserver.
 *
 * Le droit à l'effacement n'est pas absolu : il cède devant une obligation
 * légale de conservation. Une facture se conserve dix ans (Code de commerce
 * L123-22), et une facture sans nom de client n'est pas une facture valable —
 * ce champ-là ne peut donc pas être anonymisé.
 *
 * Un devis **accepté** vaut engagement contractuel : il se conserve avec la
 * pièce comptable qu'il fonde. Un devis **non accepté** n'engage rien et
 * s'efface.
 */
export const CONSERVATION_LEGALE = {
  /** Pièces comptables — Code de commerce L123-22. */
  facturesAns: 10,
  /** Devis accepté : preuve de l'engagement, jusqu'à prescription. */
  devisAccepteAns: 5,
} as const;

export function echeanceConservation(
  depuis: Date,
  annees: number = CONSERVATION_LEGALE.facturesAns
): Date {
  const d = new Date(depuis.getTime());
  d.setUTCFullYear(d.getUTCFullYear() + annees);
  return d;
}

/**
 * Phrase à remettre à la personne qui demande l'effacement.
 *
 * Un effacement qui tairait ce qu'il conserve serait un mensonge : la réponse
 * doit dire ce qui reste, pourquoi, et jusqu'à quand.
 */
export function motifConservation(
  nbPiecesConservees: number,
  echeance: Date | null
): string | null {
  if (nbPiecesConservees === 0) return null;
  const jusquA = echeance
    ? ` jusqu'au ${echeance.toISOString().slice(0, 10)}`
    : "";
  const pieces = nbPiecesConservees === 1 ? "1 pièce comptable" : `${nbPiecesConservees} pièces comptables`;
  return `${pieces} conservée${nbPiecesConservees > 1 ? "s" : ""}${jusquA} — obligation comptable (Code de commerce L123-22).`;
}
