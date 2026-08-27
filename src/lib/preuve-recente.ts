/**
 * LA PREUVE RÉCENTE — ce qui autorise un geste vraiment sensible (M11).
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **CE QU'ON CHERCHE À ÉVITER, DES DEUX CÔTÉS.**
 *
 * | Une session volée qui peut tout, des semaines durant | inacceptable |
 * | Redemander son mot de passe à un artisan sur un chantier, à chaque geste | inacceptable aussi |
 *
 * D'où : une session ordinaire permet de **travailler**. Seuls quelques gestes
 * — ceux qui engagent l'argent ou l'accès au compte — exigent une
 * authentification récente, faite **depuis cette session-là**.
 *
 * Fonctions pures : ni base, ni session, ni réseau. C'est ici qu'elles sont
 * éprouvées.
 */

/**
 * **DIX MINUTES**, et le chiffre est un arbitrage, pas une constante trouvée.
 *
 * | Trop court | il retape son mot de passe entre deux réglages, et prend l'habitude de le faire sans lire |
 * | Trop long | une session volée hérite de la preuve du patron pendant tout ce temps |
 *
 * Dix minutes couvrent un passage entier dans Réglages — changer un IBAN, puis
 * regarder ses appareils, puis en retirer un — sans redemander une seule fois.
 * Et si son téléphone lui est pris pendant qu'il y est, la fenêtre est déjà
 * courte devant les semaines que dure une session.
 */
export const FENETRE_PREUVE_MINUTES = 10;

/** Les moyens qui valent une authentification réelle. Rien d'autre n'en est un. */
export type MethodePreuve = "mot-de-passe" | "cle-appareil";

/**
 * Cette preuve est-elle encore valable ?
 *
 * @param prouveLe l'instant de la preuve, ou `null` s'il n'y en a aucune.
 * @param maintenant passé en paramètre pour que la fonction reste pure.
 */
export function preuveEstRecente(
  prouveLe: Date | null | undefined,
  maintenant: Date,
  fenetreMinutes: number = FENETRE_PREUVE_MINUTES
): boolean {
  if (!prouveLe) return false;
  const age = maintenant.getTime() - prouveLe.getTime();
  /**
   * **Une preuve venue du futur ne vaut rien.** Elle ne peut naître que d'une
   * horloge qui recule — celle de la base, ou celle du serveur. La traiter comme
   * valable ouvrirait une fenêtre dont personne ne connaît la longueur ; la
   * refuser coûte au pire une saisie de mot de passe.
   */
  if (age < 0) return false;
  return age <= fenetreMinutes * 60_000;
}

/** Les gestes qui l'exigent — la liste FERMÉE, et pourquoi chacun y est. */
export const GESTES_SENSIBLES = {
  /** L'argent des clients arrive là. Le changer sans bruit détourne un virement. */
  coordonneesBancaires: "coordonnees-bancaires",
  /**
   * **Le plus grave, et il n'était dans aucun brief.** Une session volée qui
   * enregistre sa propre clé obtient une porte **qui survit au changement de mot
   * de passe** : le patron reprend son compte, et l'intrus entre toujours.
   */
  ajouterCleAppareil: "ajouter-cle-appareil",
  /** Priver le patron de sa porte est un geste hostile autant qu'un ajout. */
  retirerCleAppareil: "retirer-cle-appareil",
  /** Toute l'entreprise dans un fichier : clients, prix, factures. */
  exportComplet: "export-complet",
} as const;

export type GesteSensible = (typeof GESTES_SENSIBLES)[keyof typeof GESTES_SENSIBLES];

/**
 * Ce que l'artisan lit quand on lui redemande de se prouver.
 *
 * Une phrase, pas un code — et elle dit **pourquoi**, sinon le geste paraît
 * arbitraire et il cherche ce qu'il a fait de mal.
 */
export function messagePreuveExigee(geste: GesteSensible): string {
  switch (geste) {
    case GESTES_SENSIBLES.coordonneesBancaires:
      return "Vos coordonnées bancaires figurent sur vos factures : vérifiez que c'est bien vous.";
    case GESTES_SENSIBLES.ajouterCleAppareil:
      return "Ajouter un appareil lui ouvre votre compte pour de bon : vérifiez que c'est bien vous.";
    case GESTES_SENSIBLES.retirerCleAppareil:
      return "Retirer un appareil le prive de votre compte : vérifiez que c'est bien vous.";
    case GESTES_SENSIBLES.exportComplet:
      return "Ce fichier contient toute votre entreprise : vérifiez que c'est bien vous.";
  }
}
