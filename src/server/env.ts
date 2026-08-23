// Point d'entrée UNIQUE pour toute variable d'environnement métier. Aucun
// autre module ne doit lire process.env directement. Échoue immédiatement et
// clairement si une variable obligatoire manque ou est mal formée — jamais un
// repli silencieux vers un comportement de développement en production.

import { estBancDEssai } from "../profil-banc";

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
  /** Connexions simultanées à PostgreSQL, par instance. Voir `db/client.ts`. */
  poolMax: number;

  /**
   * Combien de mandataires de CONFIANCE se trouvent devant Atlas. `0` = aucun.
   *
   * **Pourquoi ce réglage existe** (audit du 23 août 2026, constat C1) : la
   * limitation des tentatives de connexion se calait sur la première valeur de
   * `x-forwarded-for` — un en-tête que celui qui frappe écrit lui-même. Il
   * suffisait donc de le changer à chaque essai pour repartir d'un compteur
   * neuf, et la protection n'existait pas.
   *
   * Une adresse transmise ne vaut que par le mandataire qui l'a écrite. Ce
   * nombre dit lequel : la liste se lit par la droite, chaque mandataire y
   * ajoutant l'adresse de qui s'est connecté à lui. **Sans ce réglage, aucune
   * valeur transmise n'est retenue** — jamais de confiance devinée.
   *
   * À poser en production : le nombre de mandataires de confiance (1 pour un
   * hébergeur ordinaire). Voir `src/app/login/actions.ts`.
   */
  proxySauts: number;
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
  /**
   * Vrai quand cette installation est un banc d'essai déclaré.
   * L'écran s'en sert pour le DIRE : un banc qu'on prend pour la vraie
   * application, c'est un devis d'essai envoyé à un vrai client.
   */
  bancDEssai: boolean;

  // ── Diagnostic végétal (20 août 2026) ────────────────────────────────────
  //
  // **Trois réglages qui existent pour ne pas enfermer Atlas.** Sa règle :
  // *« l'architecture doit rester indépendante du fournisseur afin qu'un moteur
  // spécialisé puisse être ajouté ou remplacé ultérieurement sans reconstruire
  // le module »*.

  /**
   * Qui REGARDE les photos — distinct de qui rédige.
   *
   * Sans valeur, c'est `llmProvider` : sa configuration actuelle marche donc
   * sans qu'il ait rien à poser. Avec une valeur, le diagnostic part chez un
   * autre fournisseur que la rédaction des devis — ce qui permet d'en changer,
   * d'en couper un sans couper l'autre, ou de comparer les deux sur les mêmes
   * photos.
   */
  visionProvider: string;

  /**
   * Le nom du modèle qui regarde.
   *
   * **Il était écrit EN DUR dans le fournisseur Anthropic** (`claude-sonnet-4-6`),
   * ce qui obligeait à rebâtir l'application pour en changer. Absent ici, le
   * fournisseur garde son défaut : rien ne change pour l'existant.
   */
  visionModele?: string;

  /**
   * Conservation des photos de diagnostic, en jours. `0` = ne jamais purger.
   *
   * Deux durées parce que les deux cas n'ont rien à voir : une photo libre n'a
   * plus d'utilité une fois le résultat rendu, une photo versée au dossier d'un
   * chantier est une pièce du dossier. Voir `src/lib/retention-diagnostic.ts`,
   * qui porte la règle — ici, il n'y a que les nombres.
   */
  photosDiagnosticRetentionJours?: string;
  photosDiagnosticRetentionJoursChantier?: string;
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
  // **`next start` impose `NODE_ENV=production`, même sur un banc d'essai.**
  // Sans cette distinction, la seule façon de servir une version BÂTIE serait
  // de détenir une clé d'IA facturée et un compartiment S3 — ce qu'aucun banc
  // n'a. On resterait donc à `next dev`, c'est-à-dire à trente-huit secondes
  // par écran. Voir `src/profil-banc.ts` pour ce que ce profil autorise, et
  // surtout pour ce qu'il n'autorise pas.
  const bancDEssai = estBancDEssai();
  const estProduction = nodeEnv === "production";

  /**
   * **Bâtir n'est pas déployer.**
   *
   * Découvert le 9 août 2026 en cherchant, pour la première fois, à mesurer la
   * vitesse réelle de l'application : `npm run build` était **impossible**.
   *
   *     ErreurConfiguration: LLM_PROVIDER vaut « dev » en production…
   *     Failed to collect page data for /api/agenda/google/retour
   *
   * `next build` se déclare `NODE_ENV=production` et importe chaque module pour
   * préparer les pages. Tout module qui lit la configuration à l'import —
   * `src/auth.ts` a besoin du secret de session pour construire NextAuth —
   * déclenchait donc les refus ci-dessous **pendant la compilation**. Résultat :
   * produire une version optimisée exigeait de détenir une clé d'IA facturée,
   * un compartiment S3 et un secret de tâche planifiée. Ni la CI, ni le banc
   * d'essai, ni personne ne pouvait le faire — et personne ne l'avait jamais
   * fait, ce qui est précisément pourquoi le défaut a vécu si longtemps.
   *
   * Ces refus protègent une application **qui sert des clients**, pas un
   * compilateur qui produit des fichiers. On les suspend donc pendant la
   * construction, et pendant elle seule : au démarrage du serveur, `NEXT_PHASE`
   * ne vaut plus `phase-production-build`, et tout s'applique à nouveau.
   *
   * **Ce n'est pas un affaiblissement**, et il faut pouvoir le démontrer : la
   * suite `scripts/test-env.ts` éprouve les deux sens — construction acceptée,
   * exécution toujours refusée. Sans ce second cas, la porte serait ouverte
   * pour de bon.
   */
  const enConstruction = process.env.NEXT_PHASE === "phase-production-build";
  const exigencesDeProduction = estProduction && !enConstruction;

  /**
   * **Deux exigences distinctes, et les confondre coûterait cher.**
   *
   * `exigencesDeProduction` couvre ce qu'un banc d'essai a DÉJÀ et doit garder :
   * un secret de session, un secret de tâche planifiée, un Redis. Rien de tout
   * cela ne se relâche ici — les affaiblir n'apporterait rien et ferait passer
   * des configurations réellement dangereuses.
   *
   * `exigencesDeDeploiement` couvre les deux seules choses qu'un banc ne peut
   * pas avoir : une clé d'IA facturée et un compartiment S3. Sans cette
   * distinction, servir une version BÂTIE sur le banc était impossible — et
   * c'est ce qui l'a laissé sur `next dev`, à trente-huit secondes par écran.
   */
  const exigencesDeDeploiement = exigencesDeProduction && !bancDEssai;

  const databaseUrl = requis("DATABASE_URL");

  // AUTH_SECRET : obligatoire en production (signature des sessions Auth.js).
  // En développement/test, une valeur par défaut fixe est acceptée pour ne
  // pas alourdir la configuration locale — jamais utilisée si NODE_ENV=production.
  const authSecret = exigencesDeProduction
    ? requis("AUTH_SECRET")
    : (process.env.AUTH_SECRET ?? "dev-secret-non-utilise-en-production");

  const anthropicApiKey = optionnel("ANTHROPIC_API_KEY");
  const openaiApiKey = optionnel("OPENAI_API_KEY");
  const geminiApiKey = optionnel("GEMINI_API_KEY");
  const deepgramApiKey = optionnel("DEEPGRAM_API_KEY");
  const googleApiKey = optionnel("GOOGLE_API_KEY");

  // Quel nom est reconnu, et quelle clé il exige. Cette table est la seule
  // source — les fabriques (`providers/*/fabrique.ts`) doivent en accepter
  // exactement les mêmes noms.
  const CLES_LLM: Record<string, string | undefined> = {
    anthropic: anthropicApiKey,
    openai: openaiApiKey,
    gemini: geminiApiKey,
  };
  const CLES_TRANSCRIPTION: Record<string, string | undefined> = {
    openai: openaiApiKey,
    deepgram: deepgramApiKey,
    google: googleApiKey,
  };
  const NOM_VARIABLE: Record<string, string> = {
    anthropic: "ANTHROPIC_API_KEY",
    openai: "OPENAI_API_KEY",
    gemini: "GEMINI_API_KEY",
    deepgram: "DEEPGRAM_API_KEY",
    google: "GOOGLE_API_KEY",
  };

  // **Poser une clé suffit à brancher l'IA.**
  //
  // Le patron, le 6 août 2026 : « J'ai déjà mis Anthropic et OpenAI. Les clés
  // sont mises, je ne comprends pas pourquoi l'IA n'est toujours pas branchée.
  // Elle est censée l'être. » Elle ne l'était pas : `LLM_PROVIDER` valait `dev`
  // par défaut, et il fallait le poser à la main EN PLUS des clés. Deux fois de
  // suite, c'est là qu'il s'est arrêté — et rien ne le lui disait.
  //
  // La variable explicite reste souveraine : `LLM_PROVIDER=dev` coupe l'IA sans
  // qu'il faille retirer les clés, ce dont on a besoin pour rejouer un parcours
  // sans qu'une donnée d'essai ne sorte. À défaut seulement, la présence d'une
  // clé décide. Sans clé, rien ne change — `dev`, aucun appel réseau, aucune
  // donnée qui sort : c'est l'état des tests et de la CI, et il doit le rester.
  //
  // **Ce que cela déplace, et qu'il faut avoir en tête** (`docs/RGPD.md` §3) :
  // la protection ne tient plus à une valeur par défaut, mais à l'absence de
  // clé. Une clé posée quelque part suffit à faire partir l'audio et le texte
  // dicté chez un tiers.
  //
  // Le couple naturel de ses deux clés : Anthropic rédige, OpenAI transcrit —
  // Anthropic ne prend pas d'audio.
  //
  // Le nom est ramené en minuscules : `LLM_PROVIDER=Anthropic` tombait sinon
  // dans le cas par défaut de la fabrique, c'est-à-dire en mode déterministe,
  // sans un mot. Une majuscule ne doit pas décider du produit.
  const llmProvider =
    optionnel("LLM_PROVIDER")?.toLowerCase() ?? (anthropicApiKey ? "anthropic" : openaiApiKey ? "openai" : "dev");
  const transcriptionProvider = optionnel("TRANSCRIPTION_PROVIDER")?.toLowerCase() ?? (openaiApiKey ? "openai" : "dev");

  // **Qui REGARDE les photos, à distinguer de qui rédige** (20 août 2026).
  //
  // Le repli sur `llmProvider` rend ce réglage indolore : une installation qui
  // ne dit rien se comporte exactement comme avant. Il existe pour qu'un moteur
  // spécialisé puisse remplacer le généraliste sans reconstruire le module —
  // et pour qu'on puisse couper le diagnostic sans couper la dictée.
  //
  // Ramené en minuscules pour la même raison que les deux au-dessus :
  // `VISION_PROVIDER=Anthropic` tomberait sinon dans le cas par défaut de la
  // fabrique, c'est-à-dire en mode déterministe, sans un mot.
  const visionProvider = optionnel("VISION_PROVIDER")?.toLowerCase() ?? llmProvider;

  // Trois façons de se retrouver en production avec l'IA simulée, et les trois
  // passaient sans un mot : laisser la valeur par défaut, écrire « dev »
  // explicitement, ou faire une faute de frappe dans le nom du fournisseur —
  // les fabriques retombent sur `dev` par leur `default:`. Le patron l'aurait
  // découvert en dictant sur un chantier : la transcription lui aurait rendu
  // « [Transcription simulée — … ] » au lieu de ses mots.
  //
  // Ce fichier refuse déjà le stockage local, un CRON_SECRET faible et
  // l'absence de Redis pour exactement la même raison — voir son en-tête : en
  // production, jamais de repli silencieux vers un comportement de
  // développement. L'IA simulée était le seul oubli qui passait en silence.
  if (exigencesDeDeploiement) {
    for (const [variable, valeur, cles] of [
      ["LLM_PROVIDER", llmProvider, CLES_LLM],
      ["TRANSCRIPTION_PROVIDER", transcriptionProvider, CLES_TRANSCRIPTION],
      // Sans cette ligne, `VISION_PROVIDER=dev` passerait en production alors
      // que les deux autres sont refusés — et le diagnostic végétal rendrait
      // silencieusement des observations fabriquées sur de vraies photos. Le
      // trou aurait été le même que celui du 6 août, à un module près.
      ["VISION_PROVIDER", visionProvider, CLES_LLM],
    ] as const) {
      if (valeur === "dev") {
        throw new ErreurConfiguration(
          `${variable} vaut « dev » en production : l'IA simulée répond sans appeler personne, ` +
            `et servirait de faux textes à de vrais chantiers. Choisir un fournisseur parmi ` +
            `${Object.keys(cles).join(", ")} et renseigner sa clé (voir docs/A-FAIRE.md §1).`
        );
      }
      if (!(valeur in cles)) {
        throw new ErreurConfiguration(
          `${variable}="${valeur}" n'est pas un fournisseur reconnu. Valeurs acceptées en production : ` +
            `${Object.keys(cles).join(", ")}. Sans cela l'application retomberait silencieusement sur l'IA simulée.`
        );
      }
      if (!cles[valeur]) {
        throw new ErreurConfiguration(
          `${variable}="${valeur}" exige ${NOM_VARIABLE[valeur]}, qui est absente. ` +
            `Sans clé, chaque dictée échouerait une fois l'application déployée, jamais au démarrage.`
        );
      }
    }
  }

  // Le stockage local ne doit JAMAIS être utilisé en production (fichiers
  // éphémères / non partagés entre instances) — échec explicite au démarrage.
  const stockageProviderBrut = process.env.STORAGE_PROVIDER ?? "local";
  if (exigencesDeDeploiement && stockageProviderBrut !== "s3") {
    throw new ErreurConfiguration(
      "STORAGE_PROVIDER doit valoir 's3' en production (le stockage local ne persiste pas entre instances/déploiements)."
    );
  }
  const stockageProvider: FournisseurStockage = stockageProviderBrut === "s3" ? "s3" : "local";

  /**
   * **UN DÉPLOIEMENT RÉEL NE PEUT PAS SE DÉCLARER BANC D'ESSAI** (audit du
   * 23 août 2026, constat M8).
   *
   * Le profil banc relâche trois choses, et l'une d'elles est grave :
   * `src/middleware.ts` aligne alors l'hôte sur l'ORIGINE annoncée par le
   * navigateur, ce qui **désactive intégralement la protection contre le CSRF**
   * des actions serveur (Next.js compare les deux). `next.config.ts` élargit
   * dans la foulée les origines autorisées. Une seule variable mal posée sur un
   * vrai déploiement ouvrait donc toute l'application.
   *
   * ───────────────────────────────────────────────────────────────────────────
   * **POURQUOI `NODE_ENV` NE PEUT PAS ÊTRE LE CRITÈRE — et c'est tout le
   * dessin.** Le banc d'essai EST, littéralement, « production + profil banc » :
   * il sert une version bâtie, et `next start` impose `NODE_ENV=production`
   * (`.devcontainer/demarrer.sh` pose `ATLAS_PROFIL=banc` juste à côté).
   * Refuser sur cette base-là aurait éteint le banc du patron à la seconde,
   * pour une correction censée le protéger.
   *
   * **Ce qu'on cherche, c'est donc une CONTRADICTION** : un profil qui dit
   * « machine d'essai, données inventées » posé en même temps qu'un signe
   * qu'aucun banc ne peut produire. Deux signes, et le premier se déclenche
   * tout seul :
   *
   *   - `STORAGE_PROVIDER=s3` — le profil banc existe précisément parce qu'un
   *     banc n'a pas de compartiment S3. Les deux ensemble n'ont aucun sens ;
   *   - `ATLAS_DEPLOIEMENT=production` — la déclaration explicite, pour un
   *     hébergement qui n'utiliserait pas S3.
   *
   * **Aucune heuristique sur un nom de domaine** : une adresse se change, et un
   * garde-fou qui se fie à l'apparence finit par accuser à tort.
   *
   * **Volontairement PAS suspendu pendant `next build`.** Les autres refus le
   * sont — bâtir n'est pas déployer, et cela a coûté une construction
   * impossible le 9 août. Celui-ci est différent : il n'exige aucun secret, il
   * ne peut se déclencher que sur une contradiction que personne ne pose par
   * accident, et une construction faite dans cette configuration produirait
   * justement l'image dangereuse.
   */
  if (bancDEssai) {
    const signaux = [
      stockageProviderBrut === "s3" ? "STORAGE_PROVIDER=s3" : null,
      optionnel("ATLAS_DEPLOIEMENT")?.toLowerCase() === "production" ? "ATLAS_DEPLOIEMENT=production" : null,
    ].filter((s): s is string => s !== null);

    if (signaux.length > 0) {
      throw new ErreurConfiguration(
        `Configuration contradictoire : le profil BANC D'ESSAI est déclaré (ATLAS_PROFIL/ATLAS_BANC_ESSAI) ` +
          `en même temps que ${signaux.join(" et ")}. ` +
          `Le profil banc DÉSACTIVE la protection contre le CSRF des actions serveur (voir src/middleware.ts) ` +
          `et élargit les origines autorisées : il ne doit jamais servir de vrais clients. ` +
          `Retirer ATLAS_PROFIL et ATLAS_BANC_ESSAI de ce déploiement.`
      );
    }
  }

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
  if (exigencesDeProduction && (!cronSecret || cronSecret.length < 16)) {
    throw new ErreurConfiguration("CRON_SECRET manquant ou trop court en production (16 caractères minimum).");
  }

  // Le rate limiting en mémoire n'est jamais partagé entre plusieurs
  // instances : REDIS_URL est donc obligatoire en production, comme pour le
  // stockage — échec explicite au démarrage plutôt qu'un rate limit
  // silencieusement inefficace une fois déployé.
  if (exigencesDeProduction && !process.env.REDIS_URL) {
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
    // 10 par défaut : la valeur qui existait en dur, pour qu'une installation
    // qui ne dit rien ne change pas de comportement. Une valeur illisible est
    // ignorée plutôt que de rendre le pool absurde — un `max: NaN` ouvrirait
    // une connexion et une seule, sans le moindre message.
    poolMax: Math.max(1, Number(optionnel("DATABASE_POOL_MAX")) || 10),
    // Zéro par défaut, et c'est le défaut SÛR : sans déclaration, aucune
    // adresse transmise n'est crue. Une valeur illisible ou négative vaut zéro
    // plutôt que d'ouvrir une confiance que personne n'a accordée.
    proxySauts: Math.max(0, Math.trunc(Number(optionnel("ATLAS_PROXY_SAUTS")) || 0)),
    redisUrl: process.env.REDIS_URL,
    cronSecret,
    sentryDsn: process.env.SENTRY_DSN,
    sentryEnvironment: process.env.SENTRY_ENVIRONMENT ?? nodeEnv,
    releaseVersion: process.env.RELEASE_VERSION,
    versionAffichee: process.env.ATLAS_VERSION ?? process.env.RELEASE_VERSION,
    logLevel: process.env.LOG_LEVEL ?? (estProduction ? "info" : "debug"),
    bancDEssai,
    visionProvider,
    visionModele: optionnel("VISION_MODELE"),
    photosDiagnosticRetentionJours: optionnel("PHOTOS_DIAGNOSTIC_RETENTION_JOURS"),
    photosDiagnosticRetentionJoursChantier: optionnel("PHOTOS_DIAGNOSTIC_RETENTION_JOURS_CHANTIER"),
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
