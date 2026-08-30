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
   * Fichiers orphelins (remplacés, supprimés). Court volontairement : ces
   * objets ne sont plus référencés par rien.
   *
   * **Elle est de nouveau LA source, et elle ne l'était plus** — lot de
   * clôture, 29 août 2026. `purgerFichiersEnAttente` recopiait le 24 en dur et
   * n'importait même pas ce fichier : régler cette constante ne changeait
   * rien, et personne ne l'aurait vu. Deux sources pour un seul chiffre, c'est
   * la faute que `CLAUDE.md` §3 nomme.
   */
  fichiersOrphelinsHeures: 24,

  /**
   * Journaux techniques : identifiants de session, adresses IP, contextes
   * d'erreur. Assez pour instruire un incident, pas au-delà.
   *
   * ═══════════════════════════════════════════════════════════════════════
   * **AUCUN CODE D'ATLAS N'APPLIQUE CETTE DURÉE, ET C'EST NORMAL.**
   *
   * Les journaux ne vivent pas dans la base : ils partent sur la sortie
   * standard (`logger.ts`), et c'est l'hébergeur qui les garde et les expire.
   * Chercher à les purger depuis le produit reviendrait à effacer ce qu'on ne
   * détient pas.
   *
   * **Ce chiffre est donc une CIBLE à poser chez l'hébergeur**, pas une règle
   * qu'Atlas fait respecter. Il est repris tel quel dans
   * `docs/DEPLOIEMENT-PURGE.md`, avec le geste correspondant.
   *
   * Le dire compte : avant le lot de clôture, ce commentaire laissait croire à
   * un mécanisme, et l'adresse e-mail journalisée à chaque échec de connexion
   * n'avait en réalité **aucune** échéance.
   * ═══════════════════════════════════════════════════════════════════════
   */
  journauxJours: 180,

  /**
   * Délai après fermeture d'un compte, avant effacement complet.
   *
   * ═══════════════════════════════════════════════════════════════════════
   * **⚠ CE MÉCANISME N'EXISTE PAS. Cette durée décrit une opération qui n'est
   * pas codée** — lot de clôture, 29 août 2026.
   *
   * Vérifié : il n'y a dans tout le dépôt aucun chemin de fermeture de compte.
   * Ni `fermerCompte`, ni écran « supprimer mon compte », ni suppression
   * d'entreprise ou d'utilisateur hors des suites de test.
   *
   * Elle est **gardée plutôt que retirée**, et volontairement : elle porte une
   * décision déjà prise — trente jours de grâce plutôt qu'un effacement
   * immédiat — que le jour où le chemin s'écrira, personne n'aura à reprendre.
   * Mais l'écrire sans cet avertissement était une **promesse fausse** : on
   * lisait « 30 jours » et l'on croyait à un délai appliqué.
   *
   * Inscrit dans `TODO.md` : soit le chemin s'écrit, soit cette durée part.
   * ═══════════════════════════════════════════════════════════════════════
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
