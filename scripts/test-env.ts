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

  test("Production avec S3, Redis et CRON_SECRET correctement configurés : ne lève pas", () => {
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
        CRON_SECRET: "un-secret-cron-suffisamment-long",
      },
      () => {
        const env = getEnv();
        assert.equal(env.stockageProvider, "s3");
        assert.equal(env.s3?.bucket, "mon-bucket");
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
