// Nom de l'outil réservé par lequel le LLM signale une proposition de
// modification — reconnu par l'orchestrateur (services/assistant-service.ts)
// et simulé par le fournisseur de développement (providers/llm/dev.ts).
// N'exécute jamais rien : décrit uniquement l'intention.
export const NOM_OUTIL_PROPOSITION = "ProposerModifications";

// Structure métier d'une proposition de modification. Le LLM ne fait que
// PROPOSER — jamais exécuter. L'exécution passe systématiquement par les
// Server Actions existantes, après confirmation explicite de l'utilisateur.

/**
 * **LA LISTE FAIT FOI, ET LE TYPE EN DÉCOULE.**
 *
 * **Payé le 28 août 2026.** Six gestes ajoutés la veille — supprimer un
 * chantier, un tarif, poser une absence, régler les documents, composer la
 * fiche d'entretien — vivaient dans le type, avaient leur `case` et leurs
 * contrôles… et **le modèle ne pouvait pas les employer** : l'énumération que
 * l'assistant lui présente était une SECONDE liste, écrite à la main dans
 * `assistant-service.ts`, et personne ne l'avait complétée. Les contrôles
 * construisaient la proposition à la main : ils étaient verts sur une porte
 * fermée.
 *
 * Deux listes finissent toujours par diverger (`CLAUDE.md` §3). Il n'y en a
 * plus qu'une : celle-ci, lisible à l'exécution, et le type se déduit d'elle.
 */
export const TYPES_ACTION_PROPOSEE = [
  "ajouter_prestation",
  "supprimer_prestation",
  "modifier_prestation",
  "ajouter_materiel",
  "supprimer_materiel",
  "modifier_materiel",
  "modifier_duree",
  "modifier_equipe",
  "ajouter_ligne_prix",
  // Reprendre, sur le devis courant, une ligne trouvée dans le devis d'un
  // AUTRE client (sa demande du 25 août 2026). Ne porte que `ligneOrigineId` :
  // le libellé et le montant sont relus en base à l'application, jamais
  // transmis — voir `getLigneDevisPourCopie`.
  "copier_ligne_devis",
  // --- Sa demande du 26 août 2026 : « un vrai agent avec toutes les
  // capacités possibles sur l'appli ». Tous ces gestes restent des
  // PROPOSITIONS : *« très important que ça reste le doigt du patron »*.
  "creer_chantier",
  "modifier_client",
  "modifier_adresse_chantier",
  "noter_chantier",
  "planifier_chantier",
  "deplacer_chantier",
  "retirer_du_planning",
  "creer_tarif",
  "modifier_tarif",
  "preparer_facture",
  // --- Sa demande du 27 août 2026 : « fais la dernière » — les gestes qui
  // manquaient encore.
  //
  // **Les deux suppressions sont ici, et c'est délibéré.** Un geste qui efface
  // est celui qu'on hésite le plus à confier ; mais rien ne s'exécute sans
  // qu'il coche, et le refus métier reste au serveur — un chantier dont la
  // facture est émise ne part pas, quoi qu'on lui demande.
  "supprimer_chantier",
  "supprimer_tarif",
  "poser_absence_equipe",
  "regler_documents",
  "ajouter_prestation_entretien",
  "retirer_prestation_entretien",
] as const;

export type TypeActionProposee = (typeof TYPES_ACTION_PROPOSEE)[number];

export type ActionProposee = {
  type: TypeActionProposee;
  description: string; // résumé lisible affiché à l'utilisateur (ex. "Ajouter prestation : Élagage chêne")
  donnees: Record<string, unknown>; // ex. { id, libelle } ou { nouvelleValeur }
};

// Statut d'une proposition dans son cycle de vie.
export type StatutProposition = "proposee" | "confirmee" | "executee" | "rejetee";

// Catégorie de conflit — distingue une donnée invalide, un conflit métier
// légitime (élément disparu), un refus d'accès et une panne technique.
// Le message affiché à l'utilisateur reste générique et sûr dans tous les
// cas ; la catégorie sert au diagnostic (logs), jamais exposée telle quelle.
export type CategorieConflit = "donnee_invalide" | "conflit_metier" | "acces_refuse" | "technique" | "deja_appliquee" | "introuvable";

// Résultat de l'application d'une proposition après confirmation. Référence
// l'identité serveur de la proposition (jamais son contenu réémis par le
// client) — voir repositories/propositions-ia.ts.
export type ResultatApplicationProposition = {
  propositionId: string;
  type: TypeActionProposee | string;
  description: string;
  statut: "appliquee" | "conflit";
  categorie?: CategorieConflit;
  message?: string; // raison du conflit, affichée à l'utilisateur (jamais de détail technique)
};

// Résultat global d'une confirmation — sépare les résultats par proposition
// d'un éventuel avertissement post-traitement (ex. régénération du devis en
// échec) qui ne doit jamais être présenté comme un succès sans réserve.
export type ResultatConfirmation = {
  resultats: ResultatApplicationProposition[];
  avertissement?: string;
};
