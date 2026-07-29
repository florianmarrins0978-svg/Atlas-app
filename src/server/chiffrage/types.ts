// Structure métier d'un chiffrage. Chaque montant est une chaîne décimale
// (Decimal), jamais un flottant natif. Le moteur ne remplace jamais
// l'utilisateur : il calcule et explique, l'application ne l'applique jamais
// automatiquement à un devis (voir services/moteur-chiffrage.ts).

export type LigneExplication = { libelle: string; detail: string };

export type Chiffrage = {
  coutMainOeuvre: string;
  coutMateriel: string;
  coutDeplacement: string;
  autresCouts: string;
  sousTotal: string;
  margePourcent: string;
  marge: string;
  prixConseille: string;
  tauxTva: string;
  tva: string;
  prixTtc: string;
  explications: LigneExplication[];
  avertissements: string[];
};

export type TypeVariante = "prudent" | "standard" | "premium";

export type ChiffrageAvecVariantes = {
  variantes: Record<TypeVariante, Chiffrage>;
  historique?: { dernierPrix: string; nombreDevis: number; moyenne: string } | null;
};

// Entrées du moteur — toutes déjà connues/validées par ailleurs (jamais
// devinées par le moteur lui-même).
export type EntreesChiffrage = {
  joursEstimes: number | null;
  nombreOuvriers: number | null;
  aUnChefEquipe: boolean;
  parametres: {
    coutJournalierOuvrier: string;
    coutJournalierChefEquipe: string;
    coutDeplacement: string;
    margeCiblePourcent: string;
    tauxTvaDefaut: string;
  };
  nomPrestation?: string;
};
