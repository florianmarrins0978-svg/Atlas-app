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
  // Tous les cas ci-dessous décrivent une application **qui tourne**, jamais
  // une compilation. Si l'environnement ambiant portait `NEXT_PHASE`, ils
  // éprouveraient autre chose que ce qu'ils affirment — et les refus de
  // production sembleraient tous cassés sans qu'on sache pourquoi. Les trois
  // cas de construction, en fin de fichier, la posent explicitement.
  delete process.env.NEXT_PHASE;

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

  // **Ni variable ni clé : c'est le mode simulé, et il est refusé.** Depuis le
  // 6 août 2026, l'absence de variable ne suffit plus à conclure : une clé
  // présente choisit le fournisseur (`ARCHITECTURE.md` §26). Ces deux cas
  // retirent donc aussi les clés — sans quoi ils éprouveraient l'inverse de ce
  // qu'ils annoncent.
  test("Production sans LLM_PROVIDER ni clé (défaut 'dev') : rejet explicite", () => {
    avecEnv({ ...PRODUCTION_VALIDE, LLM_PROVIDER: undefined, ANTHROPIC_API_KEY: undefined, OPENAI_API_KEY: undefined }, () => {
      assert.throws(() => getEnv(), ErreurConfiguration);
    });
  });

  test("Production sans TRANSCRIPTION_PROVIDER ni clé (défaut 'dev') : rejet explicite", () => {
    avecEnv({ ...PRODUCTION_VALIDE, TRANSCRIPTION_PROVIDER: undefined, OPENAI_API_KEY: undefined }, () => {
      assert.throws(() => getEnv(), ErreurConfiguration);
    });
  });

  // L'autre moitié de la même règle : une clé posée SUFFIT, y compris en
  // production. C'est ce que le patron attendait — « les clés sont mises, je ne
  // comprends pas pourquoi l'IA n'est toujours pas branchée ».
  test("Production sans variable mais AVEC les clés : accepté, et le bon fournisseur est choisi", () => {
    avecEnv({ ...PRODUCTION_VALIDE, LLM_PROVIDER: undefined, TRANSCRIPTION_PROVIDER: undefined }, () => {
      const env = getEnv();
      assert.equal(env.llmProvider, "anthropic");
      assert.equal(env.transcriptionProvider, "openai");
    });
  });

  // Le cas ordinaire d'une valeur qui ne traverse pas : `${VAR:-dev}` dans
  // docker-compose et `${localEnv:VAR}` dans devcontainer.json produisent la
  // chaîne VIDE, jamais `undefined`. Elle doit valoir « absente », faute de quoi
  // le message accuse une faute de frappe là où il n'y a qu'une variable non
  // transmise — et envoie chercher au mauvais endroit.
  test("Production avec LLM_PROVIDER vide et sans clé : rejeté comme 'dev', pas comme un nom inconnu", () => {
    avecEnv({ ...PRODUCTION_VALIDE, LLM_PROVIDER: "", ANTHROPIC_API_KEY: undefined, OPENAI_API_KEY: undefined }, () => {
      assert.throws(
        () => getEnv(),
        (e: Error) => {
          assert.ok(e instanceof ErreurConfiguration, `type inattendu : ${e.name}`);
          assert.match(e.message, /vaut « dev »/, `message trompeur : ${e.message}`);
          assert.doesNotMatch(e.message, /n'est pas un fournisseur reconnu/);
          return true;
        }
      );
    });
  });

  test("Développement avec TRANSCRIPTION_PROVIDER vide : retombe sur 'dev', sans bruit", () => {
    avecEnv({ NODE_ENV: "development", DATABASE_URL: "postgresql://x", TRANSCRIPTION_PROVIDER: "  ", LLM_PROVIDER: "" }, () => {
      const env = getEnv();
      assert.equal(env.transcriptionProvider, "dev");
      assert.equal(env.llmProvider, "dev");
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

  // ------------------------------------------------------------------
  // Bâtir n'est pas déployer — et la porte ouverte pour bâtir doit rester
  // fermée pour servir.
  // ------------------------------------------------------------------
  //
  // **Le défaut du 9 août 2026.** `npm run build` était impossible : `next
  // build` se déclare `NODE_ENV=production`, importe `src/auth.ts` (qui lit le
  // secret de session dès l'import), et les refus ci-dessus tombaient **pendant
  // la compilation**. Produire une version optimisée exigeait donc une clé d'IA
  // facturée, un compartiment S3 et un secret de tâche planifiée. Personne
  // n'avait jamais bâti cette application, et c'est pourquoi personne ne
  // connaissait sa vraie vitesse.
  //
  // Les trois cas qui suivent vont ensemble, et le deuxième est le plus
  // important : **un contrôle qu'on assouplit doit être vu refuser encore.**
  // Sans lui, `NEXT_PHASE` deviendrait un interrupteur pour désactiver toutes
  // les protections de production, et rien ne le dirait.

  // Ce qu'un banc d'essai ou une CI possèdent : une base, et rien d'autre.
  const CONSTRUCTION_SANS_SECRETS = {
    NODE_ENV: "production",
    DATABASE_URL: "postgresql://x",
    AUTH_SECRET: undefined,
    STORAGE_PROVIDER: undefined,
    STORAGE_S3_BUCKET: undefined,
    STORAGE_S3_ACCESS_KEY_ID: undefined,
    STORAGE_S3_SECRET_ACCESS_KEY: undefined,
    REDIS_URL: undefined,
    CRON_SECRET: undefined,
    LLM_PROVIDER: undefined,
    TRANSCRIPTION_PROVIDER: undefined,
    ANTHROPIC_API_KEY: undefined,
    OPENAI_API_KEY: undefined,
  } as const;

  test("Construction (next build) sans aucun secret de production : ne lève pas", () => {
    avecEnv({ ...CONSTRUCTION_SANS_SECRETS, NEXT_PHASE: "phase-production-build" }, () => {
      const env = getEnv();
      // Les valeurs restent celles d'une installation non configurée : on n'a
      // rien inventé, on a seulement cessé de refuser de compiler.
      assert.equal(env.llmProvider, "dev");
      assert.equal(env.stockageProvider, "local");
    });
  });

  test("Exécution (même configuration, hors construction) : refuse toujours", () => {
    // **Le cas qui prouve que la porte s'est refermée.** Exactement le même
    // environnement que ci-dessus, à `NEXT_PHASE` près.
    avecEnv({ ...CONSTRUCTION_SANS_SECRETS, NEXT_PHASE: undefined }, () => {
      assert.throws(() => getEnv(), ErreurConfiguration);
    });
  });

  test("Démarrage du serveur bâti (phase-production-server) : refuse aussi", () => {
    // Next.js pose `phase-production-server` quand `next start` sert le site.
    // Une comparaison trop lâche — « NEXT_PHASE contient production » — aurait
    // laissé passer celui-là, et le serveur aurait démarré avec l'IA simulée.
    avecEnv({ ...CONSTRUCTION_SANS_SECRETS, NEXT_PHASE: "phase-production-server" }, () => {
      assert.throws(() => getEnv(), ErreurConfiguration);
    });
  });


  // ───────────────────────────────────────────────────────────────────────────
  // **Le profil « banc d'essai ».**
  //
  // Depuis le 9 août 2026, le banc sert une version BÂTIE — `next start`, donc
  // `NODE_ENV=production`. Sans ce profil, il faudrait une clé d'IA facturée et
  // un compartiment S3 pour le démarrer : impossible, et c'est ce qui l'avait
  // laissé sur `next dev`, à trente-huit secondes par écran.
  //
  // Le profil relâche EXACTEMENT deux choses. Les cas ci-dessous tiennent les
  // deux sens : ce qu'il autorise, et surtout ce qu'il n'autorise pas. Sans le
  // second groupe, `ATLAS_PROFIL` deviendrait un interrupteur ouvrant toutes les
  // protections de production, et rien ne le dirait.

  // Ce qu'un banc d'essai possède réellement : un secret de session, un secret
  // de tâche planifiée, un Redis. Ce qu'il ne possède pas : une clé d'IA
  // facturée et un compartiment S3.
  const BANC_COMPLET = {
    ...CONSTRUCTION_SANS_SECRETS,
    NEXT_PHASE: undefined,
    ATLAS_PROFIL: "banc",
    AUTH_SECRET: "secret-de-banc-non-utilise-en-production-000",
    CRON_SECRET: "secret-de-tache-planifiee-de-banc",
    REDIS_URL: "redis://localhost:6379",
  };

  test("Banc déclaré : l'IA simulée et le stockage local sont acceptés", () => {
    avecEnv(
      BANC_COMPLET,
      () => {
        const env = getEnv();
        assert.equal(env.bancDEssai, true);
        assert.equal(env.llmProvider, "dev");
        assert.equal(env.stockageProvider, "local");
      }
    );
  });

  test("Banc NON déclaré : la même configuration reste refusée", () => {
    // Le cas qui empêche le profil de devenir une porte dérobée.
    avecEnv(
      { ...BANC_COMPLET, ATLAS_PROFIL: undefined },
      () => {
        assert.throws(() => getEnv(), ErreurConfiguration);
      }
    );
  });

  test("Banc déclaré : AUTH_SECRET, CRON_SECRET et Redis restent EXIGÉS", () => {
    // **Le profil ne relâche que ce qu'un banc ne peut pas avoir.** Un banc a
    // déjà ces trois-là ; les rendre optionnels n'apporterait rien et laisserait
    // passer des configurations réellement dangereuses.
    for (const manquante of ["AUTH_SECRET", "CRON_SECRET", "REDIS_URL"]) {
      avecEnv(
        { ...BANC_COMPLET, [manquante]: undefined },
        () => {
          assert.throws(
            () => getEnv(),
            ErreurConfiguration,
            `${manquante} absente est acceptée sur un banc : le profil relâche trop`
          );
        }
      );
    }
  });

  test("Une valeur approchante ne déclare pas un banc", () => {
    // `ATLAS_PROFIL=bancs`, `=banc-essai`, `=1`… ne doivent rien ouvrir : un
    // profil deviné est un profil qui s'active par accident.
    for (const valeur of ["bancs", "banc-essai", "1", "true", ""]) {
      avecEnv(
        { ...BANC_COMPLET, ATLAS_PROFIL: valeur },
        () => {
          assert.throws(
            () => getEnv(),
            ErreurConfiguration,
            `« ${valeur} » a été pris pour une déclaration de banc`
          );
        }
      );
    }
  });

  // ──────────────────────────────────────────────────────────────────────────
  // **UN DÉPLOIEMENT RÉEL NE PEUT PAS SE DÉCLARER BANC D'ESSAI**
  // (audit du 23 août 2026, constat M8).
  //
  // Le profil banc désactive la protection contre le CSRF des actions serveur :
  // `src/middleware.ts` aligne alors l'hôte sur l'ORIGINE annoncée par le
  // navigateur, et `next.config.ts` élargit les origines autorisées. Une seule
  // variable mal posée sur un vrai déploiement ouvrait toute l'application.
  //
  // **Le critère ne peut pas être `NODE_ENV`** — le banc EST « production +
  // profil banc », puisqu'il sert une version bâtie. Ce qu'on cherche est une
  // CONTRADICTION : le profil d'une machine d'essai posé en même temps qu'un
  // signe qu'aucun banc ne peut produire.

  test("Banc déclaré AVEC un compartiment S3 : refusé — c'est une contradiction", () => {
    for (const declaration of [{ ATLAS_PROFIL: "banc" }, { ATLAS_BANC_ESSAI: "1" }]) {
      avecEnv(
        {
          ...BANC_COMPLET,
          ATLAS_PROFIL: undefined,
          ATLAS_BANC_ESSAI: undefined,
          ...declaration,
          STORAGE_PROVIDER: "s3",
          STORAGE_S3_BUCKET: "compartiment",
          STORAGE_S3_ACCESS_KEY_ID: "cle",
          STORAGE_S3_SECRET_ACCESS_KEY: "secret",
        },
        () => {
          assert.throws(
            () => getEnv(),
            (e: unknown) =>
              e instanceof ErreurConfiguration && /contradictoire/i.test(e.message) && /CSRF/i.test(e.message),
            `${JSON.stringify(declaration)} + S3 a été accepté`
          );
        }
      );
    }
  });

  test("Banc déclaré AVEC ATLAS_DEPLOIEMENT=production : refusé", () => {
    avecEnv({ ...BANC_COMPLET, ATLAS_DEPLOIEMENT: "production" }, () => {
      assert.throws(() => getEnv(), ErreurConfiguration);
    });
  });

  // **La moitié qui protège le banc du patron.** Sans ces cas, la correction
  // aurait éteint sa machine à la seconde : son espace pose `ATLAS_PROFIL=banc`
  // ET tourne sous `NODE_ENV=production`, parce que `next start` l'impose.
  test("Le banc ORDINAIRE continue de démarrer — production bâtie comprise", () => {
    avecEnv({ ...BANC_COMPLET, NODE_ENV: "production" }, () => {
      const env = getEnv();
      assert.equal(env.bancDEssai, true);
      assert.equal(env.stockageProvider, "local");
    });
  });

  test("Un déploiement réel avec S3, SANS profil banc, démarre normalement", () => {
    avecEnv(
      {
        ...BANC_COMPLET,
        ATLAS_PROFIL: undefined,
        ATLAS_BANC_ESSAI: undefined,
        NODE_ENV: "production",
        LLM_PROVIDER: "anthropic",
        ANTHROPIC_API_KEY: "sk-ant-fictive-pour-les-tests",
        TRANSCRIPTION_PROVIDER: "openai",
        OPENAI_API_KEY: "sk-fictive-pour-les-tests",
        STORAGE_PROVIDER: "s3",
        STORAGE_S3_BUCKET: "compartiment",
        STORAGE_S3_ACCESS_KEY_ID: "cle",
        STORAGE_S3_SECRET_ACCESS_KEY: "secret",
      },
      () => {
        const env = getEnv();
        assert.equal(env.bancDEssai, false);
        assert.equal(env.stockageProvider, "s3");
      }
    );
  });

  // ──────────────────────────────────────────────────────────────────────────
  // **Les mandataires de confiance** (audit du 23 août 2026, constat C1).
  //
  // Le défaut SÛR est zéro : sans déclaration, aucune adresse transmise n'est
  // crue, et le seuil par visiteur redevient commun. Une valeur absurde ne doit
  // jamais devenir une confiance.

  test("ATLAS_PROXY_SAUTS : zéro par défaut, et jamais négatif", () => {
    avecEnv({ ...BANC_COMPLET, ATLAS_PROXY_SAUTS: undefined }, () => {
      assert.equal(getEnv().proxySauts, 0);
    });
    for (const [pose, attendu] of [
      ["1", 1],
      ["2", 2],
      ["", 0],
      ["-3", 0],
      ["abc", 0],
      ["1.9", 1],
    ] as const) {
      avecEnv({ ...BANC_COMPLET, ATLAS_PROXY_SAUTS: pose }, () => {
        assert.equal(getEnv().proxySauts, attendu, `« ${pose} » a donné autre chose que ${attendu}`);
      });
    }
  });

  console.log(`\n${passed} test(s) réussi(s), ${failed} échoué(s).`);
  if (failed > 0) process.exit(1);
}

main();
