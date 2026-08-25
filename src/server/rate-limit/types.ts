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
  /**
   * SE PROUVER À NOUVEAU avant un geste sensible (M11).
   *
   * **Ce seuil existe parce que cette action est plus commode à marteler que la
   * page de connexion** : elle est atteignable avec une session déjà ouverte, et
   * elle dit oui ou non sur un mot de passe. Sans borne, elle serait un banc
   * d'essai pour qui a volé un cookie et cherche le mot de passe.
   *
   * Compté par UTILISATEUR — à cet instant il est nommé, contrairement à la
   * connexion. Cinq essais couvrent largement une faute de frappe ; au-delà,
   * quinze minutes d'attente ne gênent que celui qui cherche.
   */
  preuveRecente: { max: 5, fenetreMs: 15 * 60 * 1000 },
  /**
   * RÉPONDRE À UN DEVIS depuis le lien public (constat F9).
   *
   * **Ce que ce seuil protège, et ce qu'il ne protège PAS.** Il ne défend aucun
   * secret : le jeton du lien fait 256 bits tirés au sort
   * (`envois-devis.ts`, `randomBytes(32)`), il ne se devine pas, et aucun
   * nombre d'essais n'y changerait rien. Le dire compte — une alerte qui
   * exagère s'apprend à être ignorée.
   *
   * Ce qu'il borne, c'est le COÛT : c'est la seule écriture d'Atlas ouverte
   * SANS session, donc la seule qu'on puisse marteler sans rien voler. Chaque
   * appel lit le jeton en base, écrit la réponse, et peut poser une date de
   * chantier.
   *
   * **Deux compteurs, parce qu'ils ne bornent pas la même chose :**
   *
   * | | |
   * |---|---|
   * | par JETON | un lien précis noyé sous les réponses, depuis n'importe où |
   * | par SOURCE | quelqu'un qui martèle, quel que soit le lien employé |
   *
   * Dix par minute sur un lien : un client répond une fois, et recommence tout
   * au plus deux ou trois fois — « cette date vient d'être retenue, choisissez-en
   * une autre » est un aller-retour normal.
   *
   * **Et le compteur par source NE S'APPLIQUE QUE SI LA SOURCE EST ÉTABLIE.**
   * Corrigé à la revue hostile de ce lot, avant toute livraison. Sans
   * `ATLAS_PROXY_SAUTS` posé, `sourceDuVisiteur` rend délibérément une valeur
   * commune (`src/lib/source-visiteur.ts`) : tous les clients partagent alors
   * un seul seau, et ce seuil devenait **une arme retournée** — soixante appels
   * depuis n'importe où, et plus aucun client de plus aucun artisan ne peut
   * signer son devis. Une dépense de calcul échangée contre un blocage
   * commercial n'est pas une protection.
   *
   * La condition vit au point d'appel (`src/app/devis/[jeton]/actions.ts`), là
   * où la source est lue. Le seuil par jeton, lui, s'applique toujours : il ne
   * borne qu'un lien, celui qu'on martèle.
   *
   * Soixante reste large à dessein, même quand la source est établie : derrière
   * un mandataire d'entreprise, plusieurs clients peuvent partager une adresse.
   * Même raisonnement que `rechercheAdresse` et `cleAppareil`.
   */
  reponseDevis: { max: 10, fenetreMs: 60 * 1000 },
  reponseDevisParSource: { max: 60, fenetreMs: 60 * 1000 },
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
