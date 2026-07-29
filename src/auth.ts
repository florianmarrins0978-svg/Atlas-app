import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "./server/db/client";
import { users } from "./server/db/schema";
import { getEnv } from "./server/env";
import { authConfig } from "./auth.config";

// Provider Credentials : aucun accès réseau externe requis (contrairement à
// un provider OAuth), donc utilisable tel quel dans n'importe quel
// environnement de déploiement. Session JWT — aucune table "sessions" en
// base n'est nécessaire (le schéma Auth.js en place — users/accounts/
// verification_tokens — reste disponible pour un futur provider OAuth sans
// modification de ce fichier).
//
// Ce fichier étend authConfig (Edge-safe) avec tout ce qui dépend de Node
// (bcrypt, connexion PostgreSQL) — il n'est JAMAIS importé par le middleware,
// uniquement par les Server Actions et Route Handlers (runtime Node).
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  secret: getEnv().authSecret,
  session: { strategy: "jwt" },
  trustHost: true,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      async authorize(credentials) {
        const email = typeof credentials?.email === "string" ? credentials.email.trim().toLowerCase() : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        if (!email || !password) return null;

        const [utilisateur] = await db.select().from(users).where(eq(users.email, email)).limit(1);
        if (!utilisateur?.passwordHash) return null;

        const motDePasseValide = await compare(password, utilisateur.passwordHash);
        if (!motDePasseValide) return null;

        return { id: utilisateur.id, email: utilisateur.email, name: utilisateur.nom ?? undefined };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    // Le jeton ne porte que l'id utilisateur — jamais entrepriseId/rôle, qui
    // sont toujours résolus server-side depuis la base à chaque requête (voir
    // session-ctx.ts), jamais fait confiance depuis le jeton lui-même.
    async jwt({ token, user }) {
      if (user?.id) token.utilisateurId = user.id;
      return token;
    },
  },
});
