import type { NextConfig } from "next";

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
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
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

const nextConfig: NextConfig = {
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
    },
  },
};

export default nextConfig;
