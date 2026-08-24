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
  /**
   * « Ouvrir avec Face ID » — large à dessein, et ce n'est pas un relâchement.
   *
   * **Ce seuil ne protège PAS un mot de passe.** Une signature WebAuthn ne se
   * devine pas : la clé privée ne sort jamais de la puce du téléphone, et
   * marteler la porte n'apporte rien à qui n'a pas l'appareil. Ce qu'il borne,
   * c'est le COÛT — un défi tiré, une lecture en base, une vérification de
   * signature à chaque appui.
   *
   * **Et il doit rester TRÈS au-dessus de l'usage réel**, pour deux raisons qui
   * se cumulent. La première : un artisan qui se fait mal reconnaître réappuie —
   * trois fois, quatre fois, sur un chantier, avec de la poussière sur
   * l'objectif. La seconde, et c'est elle qui fixe le chiffre : **à cet instant
   * personne ne s'est nommé**, donc ce seuil ne peut se compter que sur la
   * source. Or sans `ATLAS_PROXY_SAUTS` posé, la source n'est pas établie et
   * **tous les visiteurs partagent le même seau** (`src/lib/source-visiteur.ts`).
   * Un chiffre serré mettrait alors dehors des artisans qui n'ont rien fait, le
   * jour où Atlas en sert plusieurs. Même raisonnement que `rechercheAdresse`.
   */
  cleAppareil: { max: 120, fenetreMs: 60 * 1000 },
  assistant: { max: 20, fenetreMs: 60 * 1000 }, // 20 requêtes IA / minute / entreprise
  confirmationProposition: { max: 30, fenetreMs: 60 * 1000 },
  televersementFichier: { max: 20, fenetreMs: 60 * 1000 },
  // Le diagnostic végétal : un appel de vision par photo, et une photo pèse.
  // Plus serré que le téléversement ordinaire parce que ce seuil-là ne protège
  // pas seulement le service — **il borne une facture**. Reste très au-dessus
  // d'un usage réel : personne ne diagnostique dix arbres en une minute.
  diagnosticVegetal: { max: 10, fenetreMs: 60 * 1000 },
  // L'aide à la saisie d'adresse part à chaque pause dans la frappe : une
  // adresse entière en consomme cinq ou six. Large à dessein — ce seuil ne
  // protège pas Atlas, il évite que l'adresse publique du banc d'essai serve de
  // relais vers un service public qui, lui, nous couperait.
  rechercheAdresse: { max: 120, fenetreMs: 60 * 1000 },
} as const;

export type ResultatLimite = { autorise: true } | { autorise: false; retryAfterMs: number };

export interface MagasinLimite {
  // Incrémente le compteur pour `cle` dans la fenêtre courante et renvoie le
  // résultat. Implémentations : mémoire (dev/test) et Redis (production).
  verifierEtIncrementer(cle: string, max: number, fenetreMs: number): Promise<ResultatLimite>;

  // Libère ce qui doit l'être. Facultatif : l'adaptateur mémoire n'a rien à
  // fermer. L'adaptateur Redis, lui, tient une connexion ouverte — et une
  // connexion oubliée empêche un processus de rendre la main (voir
  // `fermerLimiteur`, et le défaut du 8 août 2026 qu'il documente).
  fermer?(): Promise<void>;
}
