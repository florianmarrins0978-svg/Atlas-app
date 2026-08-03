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

  // Fournisseurs d'IA : quel nom est reconnu, et quelle clé il exige. Cette
  // table est la seule source — les fabriques (providers/*/fabrique.ts) doivent
  // en accepter exactement les mêmes noms.
  const CLES_LLM: Record<string, string> = {
    anthropic: "ANTHROPIC_API_KEY",
    openai: "OPENAI_API_KEY",
    gemini: "GEMINI_API_KEY",
  };
  const CLES_TRANSCRIPTION: Record<string, string> = {
    openai: "OPENAI_API_KEY",
    deepgram: "DEEPGRAM_API_KEY",
    google: "GOOGLE_API_KEY",
  };

  const llmProvider = process.env.LLM_PROVIDER ?? "dev";
  const transcriptionProvider = process.env.TRANSCRIPTION_PROVIDER ?? "dev";

  // Trois façons de se retrouver en production avec l'IA simulée, et les trois
  // passaient sans un mot : laisser la valeur par défaut, écrire « dev »
  // explicitement, ou faire une faute de frappe dans le nom du fournisseur —
  // les fabriques retombent sur `dev` par leur `default:`. Le patron l'aurait
  // découvert en dictant sur un chantier : la transcription lui aurait rendu
  // « [Transcription simulée — … ] » au lieu de ses mots.
  //
  // Ce fichier refuse déjà le stockage local, un CRON_SECRET faible et
  // l'absence de Redis pour exactement la même raison — voir son en-tête :
  // en production, jamais de repli silencieux vers un comportement de
  // développement. L'IA simulée était le seul oubli qui passait en silence.
  if (estProduction) {
    for (const [variable, valeur, cles] of [
      ["LLM_PROVIDER", llmProvider, CLES_LLM],
      ["TRANSCRIPTION_PROVIDER", transcriptionProvider, CLES_TRANSCRIPTION],
    ] as const) {
      if (valeur === "dev") {
        throw new ErreurConfiguration(
          `${variable} vaut « dev » en production : l'IA simulée répond sans appeler personne, ` +
            `et servirait de faux textes à de vrais chantiers. Choisir un fournisseur parmi ` +
            `${Object.keys(cles).join(", ")} et renseigner sa clé (voir docs/A-FAIRE.md §1).`
        );
      }
      const cleAttendue = cles[valeur];
      if (!cleAttendue) {
        throw new ErreurConfiguration(
          `${variable}="${valeur}" n'est pas un fournisseur reconnu. Valeurs acceptées en production : ` +
            `${Object.keys(cles).join(", ")}. Sans cela l'application retomberait silencieusement sur l'IA simulée.`
        );
      }
      if (!process.env[cleAttendue]?.trim()) {
        throw new ErreurConfiguration(
          `${variable}="${valeur}" exige ${cleAttendue}, qui est absente. ` +
            `Sans clé, chaque dictée échouerait une fois l'application déployée, jamais au démarrage.`
        );
      }
    }
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
    transcriptionProvider,
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
