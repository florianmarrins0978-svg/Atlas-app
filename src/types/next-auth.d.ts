import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      /**
       * L'instant où le jeton a été signé, en secondes (`iat`).
       *
       * Sert au seul « me déconnecter partout » : `getCurrentCtx` refuse un
       * jeton antérieur à la coupure posée en base (migration 0041).
       * Facultatif — un jeton d'avant cette version n'en porte pas, et un
       * jeton sans instant est traité comme valable : refuser par défaut
       * déconnecterait tout le monde au déploiement.
       */
      emisLe?: number;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    utilisateurId?: string;
  }
}
