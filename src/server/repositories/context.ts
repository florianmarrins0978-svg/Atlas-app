export type Ctx = {
  utilisateurId: string;
  entrepriseId: string;
  /**
   * L'identité de la session qui fait la demande — posée par Atlas dans le jeton
   * signé (`src/lib/identite-session.ts`).
   *
   * **Facultative, et c'est délibéré :** un jeton signé avant la version du
   * 25 août 2026 n'en porte pas. La garde de ré-authentification traite alors
   * l'absence comme « pas de preuve » — jamais comme un passe-droit.
   *
   * Ne sert QU'À cela : rien d'autre ne doit s'y accrocher, sous peine de faire
   * dépendre du jeton ce qui doit être relu en base.
   */
  sessionId?: string;
};
