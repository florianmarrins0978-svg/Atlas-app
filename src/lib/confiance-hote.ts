/**
 * Atlas fait-il confiance à l'hôte que le navigateur annonce ?
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **UNE SEULE SOURCE, ET C'EST TOUT LE SUJET** (audit du 23 août 2026,
 * constat M7).
 *
 * La réponse était donnée à deux endroits, et les deux ne disaient pas la même
 * chose. `src/auth.config.ts` calculait soigneusement :
 *
 *     trustHost: process.env.NODE_ENV !== "production" || estBancDEssai()
 *
 * et promettait, en toutes lettres : *« une vraie mise en production ne déclare
 * pas le profil banc, et retrouve le refus entier »*. Puis `src/auth.ts`
 * écrasait la valeur, trois lignes plus bas :
 *
 *     NextAuth({ ...authConfig, secret, session, trustHost: true, … })
 *
 * En production, Auth.js faisait donc confiance à l'hôte annoncé, pendant que
 * le dépôt affirmait le contraire. C'est le pire des deux mondes : la
 * protection n'existait pas, et sa documentation empêchait de s'en apercevoir.
 * Le middleware, lui, gardait la valeur conditionnelle — deux chemins, deux
 * comportements, pour la même question.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **CE QUE FAIT LA RÈGLE, ET POURQUOI DANS CET ORDRE.**
 *
 *   1. **Hors production** : oui. C'est un serveur de développement, joignable
 *      par son auteur seul.
 *   2. **Banc d'essai déclaré** : oui, et c'est indispensable. Le banc sert une
 *      version BÂTIE (`next start` impose `NODE_ENV=production`) derrière le
 *      mandataire d'un espace de travail : sans cela, Auth.js refuse tout avec
 *      « UntrustedHost: Host must be trusted », et l'artisan ne lit qu'« une
 *      erreur ». Cela a déjà coûté une journée, le 9 août 2026.
 *   3. **Production réelle** : non — **sauf déclaration explicite**
 *      `AUTH_TRUST_HOST`. Un déploiement derrière un mandataire en a besoin,
 *      mais c'est une décision qui se prend, pas un défaut qu'on hérite.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * **CE QU'IL FAUDRA POSER EN PRODUCTION, ET IL FAUT LE DIRE MAINTENANT.**
 *
 * Un déploiement derrière un mandataire — c'est-à-dire à peu près tous — doit
 * poser `AUTH_TRUST_HOST=1` **ou** `AUTH_URL` (l'adresse publique complète).
 * Sans l'un des deux, Auth.js refusera chaque connexion. C'est un refus
 * volontaire et il vaut mieux que l'inverse : une confiance héritée sans que
 * personne l'ait décidée. Mais il ne doit pas se découvrir le jour du
 * déploiement — voir `.env.example` et le rapport de correction.
 *
 * Fonction pure, éprouvée sans serveur : `scripts/test-confiance-hote.ts`.
 */

export type EnvironnementConfiance = {
  nodeEnv: string | undefined;
  /** Le résultat de `estBancDEssai()`, passé plutôt que relu. */
  bancDEssai: boolean;
  /** La valeur de `AUTH_TRUST_HOST`, telle qu'elle arrive. */
  authTrustHost: string | undefined;
};

/** Ce que `AUTH_TRUST_HOST` doit valoir pour compter comme un « oui ». */
function declarationExplicite(valeur: string | undefined): boolean {
  const v = valeur?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "oui";
}

export function faireConfianceALHote(env: EnvironnementConfiance): boolean {
  if (env.nodeEnv !== "production") return true;
  if (env.bancDEssai) return true;
  return declarationExplicite(env.authTrustHost);
}
