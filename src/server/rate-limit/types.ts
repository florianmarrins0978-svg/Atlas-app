// Seuils centralisés (jamais éparpillés dans les Server Actions/routes).
// Fenêtre glissante simple (comptage par fenêtre fixe) — suffisant pour se
// protéger d'un abus grossier ; pas une garantie de fenêtre glissante exacte.
export const LIMITES = {
  // 5 tentatives / 15 min pour UN visiteur (email + adresse IP). Compté par
  // email seul, ce seuil verrouillait tout le monde à la fois : le banc d'essai
  // partage un compte unique, et les essais du patron s'additionnaient à ceux
  // des personnes à qui il faisait essayer. Le 6 août 2026, ses parents se sont
  // vu répondre « mot de passe incorrect » avec le bon mot de passe.
  connexion: { max: 5, fenetreMs: 15 * 60 * 1000 },
  // Garde-fou de second rang, par email seul et volontairement large : il ne
  // gêne aucun usage normal, et freine une attaque répartie sur beaucoup
  // d'adresses IP, que le seuil ci-dessus laisserait passer.
  connexionParCompte: { max: 300, fenetreMs: 15 * 60 * 1000 },
  assistant: { max: 20, fenetreMs: 60 * 1000 }, // 20 requêtes IA / minute / entreprise
  confirmationProposition: { max: 30, fenetreMs: 60 * 1000 },
  televersementFichier: { max: 20, fenetreMs: 60 * 1000 },
} as const;

export type ResultatLimite = { autorise: true } | { autorise: false; retryAfterMs: number };

export interface MagasinLimite {
  // Incrémente le compteur pour `cle` dans la fenêtre courante et renvoie le
  // résultat. Implémentations : mémoire (dev/test) et Redis (production).
  verifierEtIncrementer(cle: string, max: number, fenetreMs: number): Promise<ResultatLimite>;
}
