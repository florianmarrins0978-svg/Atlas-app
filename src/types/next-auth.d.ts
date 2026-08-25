import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      /**
       * L'instant où le jeton a été signé, en secondes (`iat`).
       *
       * Sert au seul « me déconnecter partout » : `getCurrentCtx` refuse un
       * jeton antérieur à la coupure posée en base (migration 0042).
       * Facultatif — un jeton d'avant cette version n'en porte pas, et un
       * jeton sans instant est traité comme valable : refuser par défaut
       * déconnecterait tout le monde au déploiement.
       */
      emisLe?: number;
      /**
       * L'instant de la CONNEXION, en secondes — posé une fois, jamais avancé.
       *
       * C'est lui que « me déconnecter partout » doit comparer. `emisLe` est
       * remis à l'instant présent à chaque réémission du jeton par Auth.js, et
       * la coupure se contournait donc par `GET /api/auth/session`.
       */
      connexionLe?: number;
      /**
       * Ce qui identifie UNE session — posé par Atlas, car ni `jti` ni `iat`
       * ne survit à une réémission. Porte la ré-authentification récente.
       */
      sessionId?: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    utilisateurId?: string;
    /** Posé une fois à la connexion, recopié aux réémissions. */
    connexionLe?: number;
    /** Idem — ce qui identifie une session pour la ré-authentification. */
    sessionId?: string;
  }
}
