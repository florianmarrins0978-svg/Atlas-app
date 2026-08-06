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
  /**
   * Adresses des fournisseurs, surchargeables **pour les essais uniquement**.
   *
   * Elles existent parce qu'aucune suite ne pouvait éprouver l'appel réel :
   * sans elles, vérifier qu'on envoie la bonne requête et qu'on lit bien la
   * réponse supposait d'appeler le vrai service, avec une vraie clé, et de le
   * payer. Les suites lancent désormais un serveur local et pointent ici.
   * En l'absence de valeur, ce sont les adresses officielles — jamais une
   * adresse devinée.
   */
  anthropicBaseUrl: string;
  openaiBaseUrl: string;
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

/**
 * Une variable vide vaut une variable absente.
 *
 * **Ce piège a coûté cher.** Le patron avait posé ses clés d'API ; l'IA
 * restait débranchée. Une des causes : un conteneur qui transmet
 * `ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY:-}` déclare la variable **à vide**
 * quand elle n'existe pas côté hôte. `process.env.X ?? défaut` ne rattrape
 * PAS la chaîne vide — la configuration se croyait alors renseignée, et le
 * fournisseur refusait sans que rien ne l'explique. Tout ce qui est optionnel
 * passe donc par ici, et une valeur vide ressort `undefined`.
 */
function optionnel(nom: string): string | undefined {
  const valeur = process.env[nom]?.trim();
  return valeur ? valeur : undefined;
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

  const anthropicApiKey = optionnel("ANTHROPIC_API_KEY");
  const openaiApiKey = optionnel("OPENAI_API_KEY");
  const geminiApiKey = optionnel("GEMINI_API_KEY");
  const deepgramApiKey = optionnel("DEEPGRAM_API_KEY");
  const googleApiKey = optionnel("GOOGLE_API_KEY");

  // **Poser une clé suffit à brancher l'IA.**
  //
  // Avant : `LLM_PROVIDER` valait `dev` par défaut, et rien d'autre ne le
  // changeait. Le patron avait renseigné ses deux clés et voyait une
  // application toujours déterministe — la dictée recopiée mot à mot, jamais
  // comprise. Aucun écran ne disait pourquoi, et la seule variable qui aurait
  // tout expliqué ne s'affichait nulle part.
  //
  // Désormais : la variable explicite l'emporte toujours (une installation qui
  // veut rester déterministe pose `LLM_PROVIDER=dev`), et **à défaut, la
  // présence d'une clé décide**. Sans clé, rien ne change : `dev`, aucun appel
  // réseau, aucune donnée qui sort — c'est l'état des tests et de la CI, et il
  // doit le rester.
  //
  // Le couple naturel des deux clés du patron : Anthropic rédige (seul
  // fournisseur LLM éprouvé de bout en bout ici), OpenAI transcrit — Anthropic
  // ne prend pas d'audio.
  //
  // Le nom est ramené en minuscules : `LLM_PROVIDER=Anthropic` tombait sinon
  // dans le cas par défaut de la fabrique — c'est-à-dire en mode déterministe,
  // sans un mot. Une majuscule ne doit pas décider du produit.
  const llmProvider =
    optionnel("LLM_PROVIDER")?.toLowerCase() ?? (anthropicApiKey ? "anthropic" : openaiApiKey ? "openai" : "dev");
  const transcriptionProvider = optionnel("TRANSCRIPTION_PROVIDER")?.toLowerCase() ?? (openaiApiKey ? "openai" : "dev");

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
    anthropicApiKey,
    openaiApiKey,
    geminiApiKey,
    deepgramApiKey,
    googleApiKey,
    anthropicBaseUrl: optionnel("ANTHROPIC_BASE_URL") ?? "https://api.anthropic.com",
    openaiBaseUrl: optionnel("OPENAI_BASE_URL") ?? "https://api.openai.com",
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
