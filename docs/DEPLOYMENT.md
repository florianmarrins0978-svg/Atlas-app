# Runbook de déploiement — Atlas

## 1. Pré-requis avant le tout premier déploiement

- Base PostgreSQL managée provisionnée, `DATABASE_URL` disponible.
- `AUTH_SECRET` généré (32+ octets aléatoires) et injecté via le gestionnaire
  de secrets de la plateforme — jamais commité, jamais en clair dans un
  fichier de configuration versionné.
- Bucket S3 (ou compatible, ex. R2) provisionné, `STORAGE_S3_*` renseignés.
- Instance Redis provisionnée, `REDIS_URL` renseigné (obligatoire dès que
  `NODE_ENV=production` — voir `src/server/env.ts`).
- `CRON_SECRET` généré (16+ caractères), injecté au service de planification
  externe (cron de la plateforme, GitHub Actions schedule, etc.).
- **Deux fournisseurs d'IA retenus, avec leurs clés.** `LLM_PROVIDER` +
  `TRANSCRIPTION_PROVIDER`, et la clé que chacun exige. L'application refuse de
  démarrer en production si l'un vaut `dev`, porte un nom inconnu, ou n'a pas sa
  clé — sinon un vrai chantier recevrait les textes de l'IA simulée sans que
  rien ne le signale (voir `src/server/env.ts`). Écrits et complets aujourd'hui :
  `anthropic` pour le raisonnement, `openai` pour la transcription ; les autres
  noms sont acceptés mais leur raccordement reste à écrire.
  **Ce choix engage un contrat de sous-traitance** — c'est le point 1 de
  `docs/A-FAIRE.md`, à trancher avant, pas pendant le déploiement.
- Sauvegardes automatiques activées côté fournisseur de base de données —
  voir `docs/PRODUCTION_BACKUP_RESTORE.md`.
- (Optionnel mais recommandé) `SENTRY_DSN` configuré pour le monitoring
  d'erreurs — son absence ne bloque jamais le démarrage.

## 2. Étapes de déploiement standard

1. `npm ci` — installation reproductible depuis `package-lock.json`.
2. `npm run typecheck` — doit être vert.
3. `npm run lint` — doit être vert (ou sans nouvelle erreur introduite).
4. **Sauvegarde manuelle avant migration** si le déploiement inclut une
   nouvelle migration — voir `docs/PRODUCTION_BACKUP_RESTORE.md` §3.
5. `npm run db:migrate` — applique uniquement les migrations non encore
   appliquées (suivi via la table `_migrations`), idempotent.
6. `npm run build`.
7. Démarrage du service (`npm run start`, ou équivalent plateforme).
8. **Vérification post-déploiement** (voir §3 ci-dessous) avant de considérer
   le déploiement terminé.

## 3. Vérification post-déploiement

Dans cet ordre, avant de router du trafic réel vers la nouvelle version :

1. `GET /api/health/live` → doit répondre `200 {"statut":"vivant"}`.
2. `GET /api/health/ready` → doit répondre `200` avec
   `dependances.base_de_donnees = "ok"`.
3. Se connecter manuellement via `/login` avec un compte de test dédié
   (jamais un compte client réel) et vérifier l'accès au tableau de bord.
4. Vérifier qu'un appel à `/api/cron/purge-fichiers` sans le bon secret
   renvoie bien `401` (confirme que la protection est active après
   déploiement, pas seulement en local).

## 4. Stratégie de rollback

- **Rollback applicatif seul** (redéployer la version précédente du code,
  sans toucher à la base) : sûr si la migration la plus récente était
  purement additive — voir `docs/PRODUCTION_BACKUP_RESTORE.md`, section
  "Conditions de rollback applicatif sûr".
- **Une migration ne se « rollback » jamais directement en production** :
  toute correction se fait par une nouvelle migration (roll-forward), jamais
  en ré-exécutant une version antérieure d'un fichier déjà appliqué.
- Si le rollback applicatif seul ne suffit pas (migration non additive
  déployée), la procédure de restauration complète de
  `docs/PRODUCTION_BACKUP_RESTORE.md` §4 s'applique.

## 5. Configuration des sondes de la plateforme d'hébergement

- **Liveness probe** → `GET /api/health/live`.
- **Readiness probe** → `GET /api/health/ready`.
- Ces deux routes sont explicitement exclues de l'authentification par
  session (voir `src/middleware.ts`) — elles restent accessibles même si
  Auth.js ou la session sont indisponibles.

## 6. Tests E2E en CI

Résolu : les scripts E2E utilisaient auparavant un chemin d'exécutable
Chromium codé en dur, spécifique à l'environnement de développement dans
lequel ils ont été écrits. Ils passent désormais par
`scripts/e2e-browser.ts`, qui détecte ce chemin s'il existe (sandbox de
développement) et se rabat sinon sur l'installation Playwright standard
(`npx playwright install --with-deps chromium`, déjà intégrée au pipeline
CI). `PLAYWRIGHT_EXECUTABLE_PATH` permet une surcharge explicite si un autre
environnement de développement en a besoin.
