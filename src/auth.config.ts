import type { NextAuthConfig } from "next-auth";

// Configuration MINIMALE, compatible avec le runtime Edge du middleware —
// aucune dépendance Node (bcrypt, pg) ici. Le provider Credentials complet
// (avec accès base de données) vit exclusivement dans src/auth.ts, utilisé
// par les Server Actions/Route Handlers (runtime Node), jamais par le
// middleware.
export const authConfig = {
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    async session({ session, token }) {
      if (token.utilisateurId && session.user) {
        session.user.id = token.utilisateurId as string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
