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
// **`trustHost` N'EST PLUS POSÉ ICI, et c'était une vraie faille** (audit du
// 23 août 2026, constat M7). Ce fichier portait `trustHost: true`, sans
// condition, après l'étalement de `authConfig` — il écrasait donc la valeur que
// `src/auth.config.ts` calcule avec soin, et dont le commentaire promet qu'elle
// protège la production. Le middleware, lui, gardait la valeur conditionnelle :
// deux chemins, deux comportements, pour la même question.
//
// La règle vit maintenant dans `src/lib/confiance-hote.ts` et n'est appelée
// qu'une fois, depuis `authConfig`. **Ne rien remettre ici** : l'étalement
// ci-dessous la fait déjà descendre.
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  secret: getEnv().authSecret,
  session: { strategy: "jwt" },
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
