// Point d'entrée UNIQUE pour toute variable d'environnement métier. Aucun
// autre module ne doit lire process.env directement. Échoue immédiatement et
// clairement si une variable obligatoire manque ou est mal formée — jamais un
// repli silencieux vers un comportement de développement en production.

export type FournisseurStockage = "local" | "s3";

export type Env = {
  nodeEnv: "development" | "test" | "production";
  databaseUrl: string;
  authSecret: string;
  llmProvider: string;
  transcriptionProvider: string;
  anthropicApiKey?: string;
  openaiApiKey?: string;
  geminiApiKey?: string;
  deepgramApiKey?: string;
  googleApiKey?: string;
  stockageProvider: FournisseurStockage;
  s3?: {
    bucket: string;
    region: string;
    endpoint?: string;
    accessKeyId: string;
    secretAccessKey: string;
  };
  redisUrl?: string;
  cronSecret?: string;
  sentryDsn?: string;
  sentryEnvironment: string;
  releaseVersion?: string;
  /**
   * Version affichée au patron (« 04/08/2026 21:12 · b05e282 »), posée par
   * `.devcontainer/demarrer.sh`. Faite pour être lue sur une capture d'écran :
   * elle répond à « quelle version essayez-vous ? » sans avoir à la poser.
   * Absente hors banc d'essai — on dit alors « inconnue » plutôt que d'inventer.
   */
  versionAffichee?: string;
  logLevel: string;
};

export class ErreurConfiguration extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErreurConfiguration";
  }
}

function requis(nom: string): string {
  const valeur = process.env[nom];
  if (!valeur || valeur.trim() === "") {
    throw new ErreurConfiguration(`Variable d'environnement obligatoire manquante : ${nom}`);
  }
  return valeur;
}

// Construit et valide la configuration une seule fois. Ne journalise JAMAIS
// une valeur — seulement le nom de la variable en cause en cas d'erreur.
function construireEnv(): Env {
  const nodeEnv = (process.env.NODE_ENV as Env["nodeEnv"]) ?? "development";
  const estProduction = nodeEnv === "production";

  const databaseUrl = requis("DATABASE_URL");

  // AUTH_SECRET : obligatoire en production (signature des sessions Auth.js).
  // En développement/test, une valeur par défaut fixe est acceptée pour ne
  // pas alourdir la configuration locale — jamais utilisée si NODE_ENV=production.
  const authSecret = estProduction
    ? requis("AUTH_SECRET")
    : (process.env.AUTH_SECRET ?? "dev-secret-non-utilise-en-production");

  const llmProvider = process.env.LLM_PROVIDER ?? "dev";
  if (estProduction && llmProvider !== "dev" && !process.env.ANTHROPIC_API_KEY && !process.env.OPENAI_API_KEY) {
    console.error(
      `[env] LLM_PROVIDER=${llmProvider} configuré en production sans ANTHROPIC_API_KEY ni OPENAI_API_KEY.`
    );
  }

  // Le stockage local ne doit JAMAIS être utilisé en production (fichiers
  // éphémères / non partagés entre instances) — échec explicite au démarrage.
  const stockageProviderBrut = process.env.STORAGE_PROVIDER ?? "local";
  if (estProduction && stockageProviderBrut !== "s3") {
    throw new ErreurConfiguration(
      "STORAGE_PROVIDER doit valoir 's3' en production (le stockage local ne persiste pas entre instances/déploiements)."
    );
  }
  const stockageProvider: FournisseurStockage = stockageProviderBrut === "s3" ? "s3" : "local";

  const s3 =
    stockageProvider === "s3"
      ? {
          bucket: requis("STORAGE_S3_BUCKET"),
          region: process.env.STORAGE_S3_REGION ?? "auto",
          endpoint: process.env.STORAGE_S3_ENDPOINT,
          accessKeyId: requis("STORAGE_S3_ACCESS_KEY_ID"),
          secretAccessKey: requis("STORAGE_S3_SECRET_ACCESS_KEY"),
        }
      : undefined;

  // CRON_SECRET : obligatoire et non-trivial en production (protège le point
  // d'entrée de purge planifiée) — une valeur triviale/par défaut en
  // production serait une porte dérobée, jamais acceptée silencieusement.
  const cronSecret = process.env.CRON_SECRET;
  if (estProduction && (!cronSecret || cronSecret.length < 16)) {
    throw new ErreurConfiguration("CRON_SECRET manquant ou trop court en production (16 caractères minimum).");
  }

  // Le rate limiting en mémoire n'est jamais partagé entre plusieurs
  // instances : REDIS_URL est donc obligatoire en production, comme pour le
  // stockage — échec explicite au démarrage plutôt qu'un rate limit
  // silencieusement inefficace une fois déployé.
  if (estProduction && !process.env.REDIS_URL) {
    throw new ErreurConfiguration("REDIS_URL manquant en production (la limitation de débit en mémoire n'est jamais autorisée).");
  }

  return {
    nodeEnv,
    databaseUrl,
    authSecret,
    llmProvider,
    transcriptionProvider: process.env.TRANSCRIPTION_PROVIDER ?? "dev",
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    openaiApiKey: process.env.OPENAI_API_KEY,
    geminiApiKey: process.env.GEMINI_API_KEY,
    deepgramApiKey: process.env.DEEPGRAM_API_KEY,
    googleApiKey: process.env.GOOGLE_API_KEY,
    stockageProvider,
    s3,
    redisUrl: process.env.REDIS_URL,
    cronSecret,
    sentryDsn: process.env.SENTRY_DSN,
    sentryEnvironment: process.env.SENTRY_ENVIRONMENT ?? nodeEnv,
    releaseVersion: process.env.RELEASE_VERSION,
    versionAffichee: process.env.ATLAS_VERSION ?? process.env.RELEASE_VERSION,
    logLevel: process.env.LOG_LEVEL ?? (estProduction ? "info" : "debug"),
  };
}

let instance: Env | null = null;

// Lazy + mémoïsé : validé au premier accès (démarrage du premier
// Server Action/route), jamais silencieusement recalculé avec des valeurs
// différentes en cours de vie du process.
export function getEnv(): Env {
  if (!instance) instance = construireEnv();
  return instance;
}

// Réservé aux tests : force une reconstruction (chaque test contrôle son
// propre process.env, sans fuite d'état entre cas de test).
export function _reinitialiserEnvPourTests(): void {
  instance = null;
}
