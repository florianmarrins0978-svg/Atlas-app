import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { eq } from "drizzle-orm";
import { db } from "./server/db/client";
import { users } from "./server/db/schema";
import { getEnv } from "./server/env";
import { authConfig } from "./auth.config";
import { ouvrirAvecCle } from "./server/cle-appareil";
import { identifiantSiMotDePasseJuste } from "./server/secret-authentification";
import type { AuthenticationResponseJSON } from "@simplewebauthn/types";

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

        /**
         * **LE CONDENSAT NE REMONTE PLUS JUSQU'ICI** — constat M9, 25 août 2026.
         *
         * Cette ligne était le seul `select()` nu du dépôt : elle ramenait la
         * ligne entière, `password_hash` compris. Le rôle applicatif n'a plus le
         * droit de lire cette colonne, et la vérification se fait en base
         * (`src/server/secret-authentification.ts`).
         *
         * Ce qui revient ici est un identifiant, ou rien. Les trois refus —
         * adresse inconnue, compte sans mot de passe, mot de passe faux — sont
         * délibérément indiscernables : les séparer dirait à un inconnu quelles
         * adresses existent.
         */
        const utilisateurId = await identifiantSiMotDePasseJuste(email, password);
        if (!utilisateurId) return null;

        // Les colonnes ordinaires, une fois l'identité établie. `atlas_app` les
        // lit toujours : seul le condensat lui a été retiré.
        const [utilisateur] = await db
          .select({ id: users.id, email: users.email, nom: users.nom })
          .from(users)
          .where(eq(users.id, utilisateurId))
          .limit(1);
        if (!utilisateur) return null;

        return { id: utilisateur.id, email: utilisateur.email, name: utilisateur.nom ?? undefined };
      },
    }),

    /**
     * « Ouvrir avec Face ID » — un SECOND fournisseur `Credentials`, et le
     * choix d'architecture le plus important de ce lot.
     *
     * ─────────────────────────────────────────────────────────────────────────
     * **POURQUOI PAS `next-auth/providers/passkey`, qui existe et est déjà
     * installé.** Parce qu'il ne peut pas fonctionner ici, et ce n'est pas une
     * supposition : `@auth/core/lib/utils/assert.js` refuse le WebAuthn sans
     * adaptateur de base de données —
     *
     *     if (!adapter) return new MissingAdapter("WebAuthn requires an adapter")
     *
     * Or Atlas n'en a **aucun** : la session est un JWT, sans table. En
     * brancher un ferait naître `accounts`, `sessions`, `verification_tokens`,
     * changerait la façon dont chaque requête retrouve l'utilisateur, et
     * remettrait en jeu tout ce qui pend au jeton — le contexte d'entreprise,
     * `middleware.ts`, `session-ctx.ts`, « me déconnecter partout ». **Pour un
     * bouton sur la porte.**
     *
     * Passer par un second fournisseur `Credentials` laisse la couche session
     * intacte : même jeton, même cookie, mêmes rappels. Elle ignore qu'un
     * second chemin existe.
     *
     * ─────────────────────────────────────────────────────────────────────────
     * **TOUTE la vérification vit dans `ouvrirAvecCle`, et une seule fois.**
     * L'action serveur ne pré-vérifie rien avant d'appeler `signIn` : deux
     * rédactions de la même règle divergeraient, et ici la divergence
     * s'appellerait « connexion acceptée d'un côté, refusée de l'autre »
     * (`CLAUDE.md` §3).
     *
     * **`noterEchec` n'est JAMAIS appelé sur ce chemin.** Un visage mal reconnu
     * ne doit pas temporiser le compte de son propriétaire : ce serait la panne
     * du 6 août 2026 refaite par l'autre bord.
     */
    Credentials({
      id: "cle-appareil",
      name: "Face ID",
      credentials: { reponse: { label: "Réponse de l'appareil", type: "text" } },
      async authorize(credentials) {
        const brut = typeof credentials?.reponse === "string" ? credentials.reponse : "";
        if (!brut) return null;

        let reponse: AuthenticationResponseJSON;
        try {
          reponse = JSON.parse(brut) as AuthenticationResponseJSON;
        } catch {
          // Une saisie illisible n'est pas une panne d'Atlas : on refuse, sans
          // bruit dans le journal, sinon n'importe qui le remplirait.
          return null;
        }

        const compte = await ouvrirAvecCle(reponse);
        if (!compte) return null;
        return { id: compte.id, email: compte.email, name: compte.nom ?? undefined };
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
