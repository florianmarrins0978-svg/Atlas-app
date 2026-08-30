import type { NextConfig } from "next";
import { originesAutoriseesPourLesActions } from "./src/profil-banc";

// En-têtes de sécurité — appliqués à toutes les routes. Next.js exige encore
// 'unsafe-inline' pour script-src (scripts d'hydratation générés par le
// framework lui-même, sans nonce configuré dans ce lot) et pour style-src
// (attributs style={{...}} utilisés directement dans plusieurs écrans,
// ex. src/app/login/page.tsx) — ce sont les deux seules exceptions à une
// politique par ailleurs stricte, documentées ici plutôt que masquées.
// connect-src inclut les hôtes d'ingestion Sentry car le logger transmet les
// erreurs au navigateur Sentry lorsque SENTRY_DSN est configuré (voir
// src/server/logger.ts) — sans DSN, ces hôtes ne sont simplement jamais
// contactés, la directive reste inoffensive.
// React a besoin d'eval() en mode développement (reconstruction des piles
// d'appel). Sans cette exception, le navigateur signale une erreur permanente
// et l'indicateur d'anomalie de Next recouvre la barre de navigation pendant
// les essais. Strictement limitée au développement : la politique de production
// reste inchangée, et React n'utilise jamais eval() en production.
const SCRIPT_SRC =
  process.env.NODE_ENV === "development"
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self' 'unsafe-inline'";

const CSP = [
  "default-src 'self'",
  SCRIPT_SRC,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "font-src 'self'",
  "connect-src 'self' https://*.sentry.io https://*.ingest.sentry.io",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

// **Le dossier de construction est déplaçable, et ce n'est pas un confort.**
//
// Le 10 août 2026, le patron regarde une page blanche pendant que son banc se
// rebâtit. Sur son disque — que Next.js mesure lui-même deux cents fois trop
// lent — la construction dure des dizaines de minutes, et RIEN ne sert pendant
// ce temps : `scripts/banc.mjs` bâtissait d'abord, servait ensuite.
//
// Pour servir en même temps qu'on bâtit, il faut deux dossiers : le serveur de
// développement garde `.next`, la construction écrit ailleurs. Sans cela les
// deux se marchent dessus, et le remède casserait ce qu'il répare.
const DIST = process.env.ATLAS_DIST_DIR;

const nextConfig: NextConfig = {
  ...(DIST ? { distDir: DIST } : {}),
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: CSP },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" },
        ],
      },
    ];
  },
  experimental: {
    serverActions: {
      // Remédiation : limite explicite, jamais la valeur par défaut de
      // Next.js (1 Mo — insuffisante pour une photo de smartphone réelle).
      // 15 Mo couvre une photo compressée standard et un enregistrement
      // vocal de quelques minutes ; voir src/server/upload-limits.ts pour la
      // valeur centralisée réutilisée côté validation applicative.
      bodySizeLimit: "15mb",

      // Origines autorisées à poster une action serveur. Next.js compare
      // l'en-tête Origin à l'hôte : derrière le proxy d'un environnement
      // d'essai (GitHub Codespaces), les deux diffèrent, et TOUTE action est
      // refusée — à commencer par la connexion, puis créer un chantier,
      // envoyer un devis, confirmer une facture.
      //
      // Ce que ça donnait à l'écran : « Invalid Server Actions request. » Le
      // patron a passé une demi-journée à croire que l'application ne
      // démarrait pas, alors qu'elle démarrait très bien et refusait sa
      // connexion.
      //
      // La cause était plus bête encore : le conteneur de l'application est
      // décrit par un docker-compose avec une liste d'environnement EXPLICITE,
      // et `CODESPACE_NAME` n'y était pas repris. À l'intérieur, la variable
      // n'existait pas, la liste ci-dessous restait vide, et rien ne
      // fonctionnait. Elle est désormais transmise (.devcontainer/docker-
      // compose.yml) — mais on ne fait plus reposer la connexion là-dessus.
      //
      // D'où le caractère générique EN DÉVELOPPEMENT SEULEMENT : le domaine de
      // redirection de Codespaces varie (`app.github.dev`, parfois un domaine
      // régional), et une seule variable d'environnement manquante suffisait à
      // tout bloquer. En production, la liste reste vide : la protection est
      // entière, et ce banc d'essai ne tourne jamais en production.
      // Le banc d'essai sert désormais une version BÂTIE, donc `NODE_ENV` y
      // vaut `production` : sans `estBancDEssai()`, la liste redeviendrait vide
      // et toute action serveur serait refusée derrière le mandataire.
      allowedOrigins: originesAutoriseesPourLesActions(),
    },
  },
};

export default nextConfig;
