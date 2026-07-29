export type StatutEtape = "reussie" | "ignoree" | "echouee";

export type EtapeWorkflow = {
  nom: string;
  statut: StatutEtape;
  resultat?: unknown;
  sources: string[];
  avertissements: string[];
  donneesManquantes: string[];
};

export type ResultatWorkflow = {
  etapes: EtapeWorkflow[];
  statut: "termine" | "arrete";
  raisonArret?: string;
  prochaineAction?: string;
  // Reprend exactement la forme produite par construirePropositionDevis
  // (aucune duplication) — absent si le workflow s'est arrêté avant.
  propositionFinale?: { texteIntroduction: string; propositions: Record<string, unknown>[] };
};
