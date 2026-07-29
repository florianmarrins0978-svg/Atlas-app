import * as Sentry from "@sentry/nextjs";

// Sans SENTRY_DSN, Sentry.init() ne fait rien d'observable (pas d'appel
// réseau, pas d'erreur) — l'application fonctionne à l'identique, avec ou
// sans monitoring configuré. Le DSN n'est jamais une valeur obligatoire :
// contrairement à AUTH_SECRET/STORAGE_*, l'absence de monitoring ne bloque
// jamais le démarrage (dégradation acceptable, pas une faille de sécurité).
const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    release: process.env.RELEASE_VERSION,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    // Ne jamais envoyer les en-têtes de requête (peuvent contenir des
    // cookies de session) ni les corps de requête bruts à Sentry.
    sendDefaultPii: false,
  });
}
