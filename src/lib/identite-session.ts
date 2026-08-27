/**
 * CE QUI IDENTIFIE UNE SESSION ATLAS, et depuis quand elle existe.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **POURQUOI ATLAS DOIT LES POSER LUI-MÊME — mesuré, pas supposé.**
 *
 * `@auth/core` réémet le jeton (`lib/actions/session.js:46`, et quatre endroits
 * de `lib/actions/callback/index.js`). À **chaque** réémission :
 *
 *     .setIssuedAt()                    // ← iat remis à l'instant présent
 *     .setJti(crypto.randomUUID())      // ← jti neuf
 *
 * Ni `iat` ni `jti` ne survit donc à une réémission — constaté sur la version
 * installée par `scripts/sonde-jeton-session.mts`. **Aucun des deux ne peut
 * porter « une session logique ».**
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **LES DEUX MARQUES, ET CE QUE CHACUNE SERT :**
 *
 * | `sessionId` | l'identité — une preuve de ré-authentification lui est liée, donc une autre session n'en profite jamais |
 * | `authentifieLe` | l'ancienneté — c'est ce que « me déconnecter partout » compare |
 *
 * **Deux marques et non une**, parce qu'elles répondent à deux questions
 * différentes : *qui es-tu* et *depuis quand*. Un identifiant seul ne dit pas
 * l'âge ; un instant seul ne distingue pas deux sessions nées dans la même
 * seconde.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **LA PROPRIÉTÉ TENUE :**
 *
 * | Une VRAIE authentification | `sessionId` neuf, `authentifieLe` neuf |
 * | Une réémission technique | **les deux inchangés** |
 *
 * C'est cette seconde ligne qui ferme le contournement de « me déconnecter
 * partout » : réémettre ne rajeunit plus une session coupée.
 *
 * Fonction pure, sans base ni réseau : c'est ici qu'elle est éprouvée.
 */

/** Ce que le jeton porte, du point de vue de cette règle. */
export type MarquesSession = {
  sessionId?: unknown;
  authentifieLe?: unknown;
};

/**
 * Marquer un jeton — **une seule fois**, à l'authentification.
 *
 * @param nouvelleAuthentification `true` quand Auth.js vient de vérifier une
 *   identité (mot de passe ou clé d'appareil) ; `false` pour toute réémission.
 * @param maintenant l'instant, en secondes. Passé en paramètre pour que la
 *   fonction reste pure et éprouvable.
 * @param tirerIdentifiant de quoi fabriquer un identifiant imprévisible.
 */
export function marquerSession<T extends MarquesSession>(
  jeton: T,
  nouvelleAuthentification: boolean,
  maintenant: number,
  tirerIdentifiant: () => string
): T {
  if (nouvelleAuthentification) {
    return { ...jeton, sessionId: tirerIdentifiant(), authentifieLe: maintenant };
  }
  /**
   * **On ne réécrit RIEN à la réémission — pas même si les marques manquent.**
   *
   * Un jeton signé avant cette version n'en porte aucune. Lui en poser à la
   * volée lui donnerait un `authentifieLe` valant *maintenant*, c'est-à-dire
   * exactement le rajeunissement qu'on referme : une session coupée
   * redeviendrait valable au premier passage. C'est `instantDAuthentification`
   * qui gère ces jetons-là, en retombant sur leur `iat`.
   */
  return jeton;
}

/**
 * L'instant à comparer à la coupure — **jamais celui de la signature**.
 *
 * Le repli sur `iat` est délibéré : un jeton d'avant cette version ne porte pas
 * `authentifieLe`, et le refuser d'office déconnecterait tout le monde au
 * déploiement — un geste que personne n'a demandé. Ce repli s'éteint seul quand
 * les anciens jetons expirent.
 *
 * Il ne rouvre pas le contournement pour autant : un jeton d'avant reste
 * exposé à la réémission, mais un jeton d'après ne l'est plus, et c'est la seule
 * façon de passer d'un état à l'autre sans mettre tout le monde dehors.
 */
export function instantDAuthentification(marques: {
  authentifieLe?: unknown;
  emisLe?: unknown;
}): number | undefined {
  if (typeof marques.authentifieLe === "number") return marques.authentifieLe;
  if (typeof marques.emisLe === "number") return marques.emisLe;
  return undefined;
}

/** La session est-elle antérieure à la coupure posée par le patron ? */
export function sessionCoupee(
  instantAuthentification: number | undefined,
  coupure: Date | null
): boolean {
  if (!coupure) return false;
  // Une session dont on ne sait rien n'est pas coupée : voir le repli ci-dessus.
  if (typeof instantAuthentification !== "number") return false;
  return instantAuthentification * 1000 < coupure.getTime();
}
