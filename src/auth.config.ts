import type { NextAuthConfig } from "next-auth";
import { estBancDEssai } from "@/profil-banc";

// Configuration MINIMALE, compatible avec le runtime Edge du middleware —
// aucune dépendance Node (bcrypt, pg) ici. Le provider Credentials complet
// (avec accès base de données) vit exclusivement dans src/auth.ts, utilisé
// par les Server Actions/Route Handlers (runtime Node), jamais par le
// middleware.
export const authConfig = {
  pages: { signIn: "/login" },

  /**
   * **Faire confiance à l'hôte annoncé — hors production, ou sur un banc déclaré.**
   *
   * Trouvé le 9 août 2026 par `npm run verifier:connexion`, et par lui seul.
   * Depuis que le banc sert une version BÂTIE, `NODE_ENV` y vaut `production` :
   * Auth.js cesse alors de faire confiance à l'hôte transmis par le mandataire
   * et refuse tout, avec ce message dans le journal du serveur —
   *
   *     [auth][error] UntrustedHost: Host must be trusted.
   *     URL was: http://…-3000.app.github.dev/api/auth/session
   *
   * — pendant que l'artisan, lui, ne voit qu'un écran « Une erreur. Cette page
   * n'a pas pu s'afficher. » C'est le même piège que « Invalid Server Actions
   * request. » (`ARCHITECTURE.md` §30), un cran plus loin : une protection
   * pensée pour un serveur joignable en direct, appliquée à un serveur qui ne
   * l'est jamais.
   *
   * **Ce que cela n'affaiblit pas :** une vraie mise en production ne déclare
   * pas le profil banc, et retrouve le refus entier. Elle devra poser
   * `AUTH_TRUST_HOST` en connaissance de cause, ce qui est exactement la
   * décision qu'Auth.js veut rendre explicite.
   */
  trustHost: process.env.NODE_ENV !== "production" || estBancDEssai(),
  providers: [],
  callbacks: {
    async session({ session, token }) {
      if (token.utilisateurId && session.user) {
        session.user.id = token.utilisateurId as string;
        /**
         * **QUAND ce jeton a été signé — ce qui rend « me déconnecter partout »
         * possible sans table de sessions.**
         *
         * Atlas n'en garde aucune : il n'y a donc rien à supprimer pour fermer
         * une session ouverte ailleurs. Mais chaque jeton porte son instant
         * d'émission (`iat`, la convention JWT), et il suffit de refuser ceux
         * qui précèdent une coupure — c'est `getCurrentCtx` qui compare, côté
         * Node, parce qu'il faut lire la base pour connaître cette coupure.
         *
         * **Recopié ici plutôt que lu du jeton là-bas** : `auth()` ne rend que
         * la session, jamais le jeton brut. Sans cette ligne, l'instant existe
         * et reste inatteignable.
         */
        session.user.emisLe = typeof token.iat === "number" ? token.iat : undefined;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
