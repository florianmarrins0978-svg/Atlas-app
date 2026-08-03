import assert from "node:assert";
import { _reinitialiserEnvPourTests, getEnv, ErreurConfiguration } from "../src/server/env";

let passed = 0;
let failed = 0;
function test(nom: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ ${nom}`);
    passed++;
  } catch (err) {
    console.error(`❌ ${nom}`);
    console.error(`   ${err instanceof Error ? err.message : err}`);
    failed++;
  }
}

function avecEnv<T>(vars: Record<string, string | undefined>, fn: () => T): T {
  const sauvegarde: Record<string, string | undefined> = {};
  for (const cle of Object.keys(vars)) sauvegarde[cle] = process.env[cle];
  for (const [cle, valeur] of Object.entries(vars)) {
    if (valeur === undefined) delete process.env[cle];
    else process.env[cle] = valeur;
  }
  _reinitialiserEnvPourTests();
  try {
    return fn();
  } finally {
    for (const [cle, valeur] of Object.entries(sauvegarde)) {
      if (valeur === undefined) delete process.env[cle];
      else process.env[cle] = valeur;
    }
    _reinitialiserEnvPourTests();
  }
}

function main() {
  test("Configuration développement valide : ne lève jamais", () => {
    avecEnv({ NODE_ENV: "development", DATABASE_URL: "postgresql://x", STORAGE_PROVIDER: undefined }, () => {
      const env = getEnv();
      assert.equal(env.stockageProvider, "local");
    });
  });

  test("DATABASE_URL manquant : échoue explicitement, quel que soit l'environnement", () => {
    avecEnv({ NODE_ENV: "development", DATABASE_URL: "" }, () => {
      assert.throws(() => getEnv(), ErreurConfiguration);
    });
  });

  test("Production sans AUTH_SECRET : échoue explicitement", () => {
    avecEnv(
      {
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://x",
        AUTH_SECRET: "",
        STORAGE_PROVIDER: "s3",
        STORAGE_S3_BUCKET: "b",
        STORAGE_S3_ACCESS_KEY_ID: "k",
        STORAGE_S3_SECRET_ACCESS_KEY: "s",
      },
      () => {
        assert.throws(() => getEnv(), ErreurConfiguration);
      }
    );
  });

  test("Production avec stockage local explicite : rejet explicite", () => {
    avecEnv({ NODE_ENV: "production", DATABASE_URL: "postgresql://x", AUTH_SECRET: "secret", STORAGE_PROVIDER: "local" }, () => {
      assert.throws(() => getEnv(), ErreurConfiguration);
    });
  });

  test("Production sans STORAGE_PROVIDER du tout (défaut 'local') : rejet explicite, jamais un repli silencieux", () => {
    avecEnv({ NODE_ENV: "production", DATABASE_URL: "postgresql://x", AUTH_SECRET: "secret", STORAGE_PROVIDER: undefined }, () => {
      assert.throws(() => getEnv(), ErreurConfiguration);
    });
  });

  // Base commune d'une production correctement configurée. Chaque test qui
  // suit n'en change qu'une variable : ce qui échoue désigne alors sans
  // ambiguïté la variable en cause, et non « la production ne démarre plus ».
  const PRODUCTION_VALIDE = {
    NODE_ENV: "production",
    DATABASE_URL: "postgresql://x",
    AUTH_SECRET: "secret-de-production",
    STORAGE_PROVIDER: "s3",
    STORAGE_S3_BUCKET: "mon-bucket",
    STORAGE_S3_ACCESS_KEY_ID: "AKIA...",
    STORAGE_S3_SECRET_ACCESS_KEY: "secret-s3",
    REDIS_URL: "redis://localhost:6379",
    CRON_SECRET: "un-secret-cron-suffisamment-long",
    LLM_PROVIDER: "anthropic",
    ANTHROPIC_API_KEY: "sk-ant-fictive-pour-les-tests",
    TRANSCRIPTION_PROVIDER: "openai",
    OPENAI_API_KEY: "sk-fictive-pour-les-tests",
  } as const;

  test("Production avec S3, Redis et CRON_SECRET correctement configurés : ne lève pas", () => {
    avecEnv(PRODUCTION_VALIDE, () => {
      const env = getEnv();
      assert.equal(env.stockageProvider, "s3");
      assert.equal(env.s3?.bucket, "mon-bucket");
    });
  });

  // Les cinq tests suivants gardent le même défaut : en production, l'IA
  // simulée répond sans appeler personne, et rendrait « [Transcription
  // simulée — … ] » à un artisan qui dicte devant un vrai client. Aucun de ces
  // cinq cas ne se signalait avant : l'application démarrait normalement.

  test("Production sans LLM_PROVIDER du tout (défaut 'dev') : rejet explicite", () => {
    avecEnv({ ...PRODUCTION_VALIDE, LLM_PROVIDER: undefined }, () => {
      assert.throws(() => getEnv(), ErreurConfiguration);
    });
  });

  test("Production sans TRANSCRIPTION_PROVIDER du tout (défaut 'dev') : rejet explicite", () => {
    avecEnv({ ...PRODUCTION_VALIDE, TRANSCRIPTION_PROVIDER: undefined }, () => {
      assert.throws(() => getEnv(), ErreurConfiguration);
    });
  });

  test("Production avec TRANSCRIPTION_PROVIDER='dev' explicite : rejet explicite", () => {
    avecEnv({ ...PRODUCTION_VALIDE, TRANSCRIPTION_PROVIDER: "dev" }, () => {
      assert.throws(() => getEnv(), ErreurConfiguration);
    });
  });

  // Le cas le plus traître : la fabrique retombe sur `dev` par son `default:`,
  // donc une faute de frappe donnait l'IA simulée sans le moindre signal.
  test("Production avec un fournisseur mal orthographié : rejet explicite, jamais un repli sur 'dev'", () => {
    avecEnv({ ...PRODUCTION_VALIDE, LLM_PROVIDER: "antropic" }, () => {
      assert.throws(() => getEnv(), ErreurConfiguration);
    });
  });

  test("Production avec un fournisseur réel mais sans sa clé : rejet au démarrage, pas à la première dictée", () => {
    avecEnv({ ...PRODUCTION_VALIDE, ANTHROPIC_API_KEY: "" }, () => {
      assert.throws(() => getEnv(), ErreurConfiguration);
    });
  });

  // Le message doit désigner le bon coupable : une erreur qui envoie chercher
  // au mauvais endroit coûte plus cher que pas d'erreur du tout (AGENTS.md).
  test("Le message d'erreur nomme la variable en cause et le document qui explique", () => {
    avecEnv({ ...PRODUCTION_VALIDE, TRANSCRIPTION_PROVIDER: "dev" }, () => {
      assert.throws(
        () => getEnv(),
        (err: unknown) => {
          assert.ok(err instanceof ErreurConfiguration);
          assert.match(err.message, /TRANSCRIPTION_PROVIDER/);
          assert.match(err.message, /A-FAIRE\.md/);
          // Ne doit PAS accuser le LLM, qui est correctement configuré ici.
          assert.doesNotMatch(err.message, /LLM_PROVIDER/);
          return true;
        }
      );
    });
  });

  // Le mode simulé reste le fonctionnement normal du banc d'essai : le
  // contrôle ne doit pas déborder hors de la production, sinon il rend
  // l'application inutilisable là où elle sert justement à essayer.
  test("Développement avec l'IA simulée : ne lève pas (c'est le mode du banc d'essai)", () => {
    avecEnv(
      { NODE_ENV: "development", DATABASE_URL: "postgresql://x", LLM_PROVIDER: undefined, TRANSCRIPTION_PROVIDER: undefined },
      () => {
        const env = getEnv();
        assert.equal(env.llmProvider, "dev");
        assert.equal(env.transcriptionProvider, "dev");
      }
    );
  });

  test("Production sans REDIS_URL : échoue explicitement (limitation de débit en mémoire jamais autorisée)", () => {
    avecEnv(
      {
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://x",
        AUTH_SECRET: "secret-de-production",
        STORAGE_PROVIDER: "s3",
        STORAGE_S3_BUCKET: "mon-bucket",
        STORAGE_S3_ACCESS_KEY_ID: "AKIA...",
        STORAGE_S3_SECRET_ACCESS_KEY: "secret-s3",
        REDIS_URL: "",
        CRON_SECRET: "un-secret-cron-suffisamment-long",
      },
      () => {
        assert.throws(() => getEnv(), ErreurConfiguration);
      }
    );
  });

  test("Production sans CRON_SECRET (ou trop court) : échoue explicitement", () => {
    avecEnv(
      {
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://x",
        AUTH_SECRET: "secret-de-production",
        STORAGE_PROVIDER: "s3",
        STORAGE_S3_BUCKET: "mon-bucket",
        STORAGE_S3_ACCESS_KEY_ID: "AKIA...",
        STORAGE_S3_SECRET_ACCESS_KEY: "secret-s3",
        REDIS_URL: "redis://localhost:6379",
        CRON_SECRET: "trop-court",
      },
      () => {
        assert.throws(() => getEnv(), ErreurConfiguration);
      }
    );
  });

  test("S3 sélectionné sans bucket : échoue explicitement (même en développement)", () => {
    avecEnv(
      {
        NODE_ENV: "development",
        DATABASE_URL: "postgresql://x",
        STORAGE_PROVIDER: "s3",
        STORAGE_S3_BUCKET: "",
        STORAGE_S3_ACCESS_KEY_ID: "k",
        STORAGE_S3_SECRET_ACCESS_KEY: "s",
      },
      () => {
        assert.throws(() => getEnv(), ErreurConfiguration);
      }
    );
  });

  console.log(`\n${passed} test(s) réussi(s), ${failed} échoué(s).`);
  if (failed > 0) process.exit(1);
}

main();
