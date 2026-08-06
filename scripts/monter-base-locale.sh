#!/usr/bin/env bash
# Monter PostgreSQL et Redis dans cet environnement, sans Docker.
#
# **Pourquoi ce fichier existe.** Le dépôt a longtemps tenu pour acquis que la
# batterie base de données ne pouvait pas tourner ici. C'était faux, et la
# conséquence a été chère : « c'est la CI qui vérifiera » a été dit trois fois
# alors que la CI n'avait jamais tourné, et les suites base n'étaient éprouvées
# nulle part. Docker manque bien — mais les binaires PostgreSQL 16 et
# redis-server sont installés, et cela suffit.
#
# Usage :
#   source scripts/monter-base-locale.sh     # pose aussi les variables
#   npm test
#
# Le `source` importe : sans lui, les variables d'environnement meurent avec le
# sous-shell et la commande suivante échoue sur un DATABASE_URL absent.

# `pipefail` seulement, et surtout pas `set -e` ni `set -u` : ce fichier est
# *sourcé*, donc ces options survivraient dans le shell de l'appelant — où la
# première variable non définie tuerait sa session. Chaque étape vérifie donc
# son propre résultat, à la main.
set -o pipefail

BIN=/usr/lib/postgresql/16/bin
PGDATA_LOCAL="${PGDATA_LOCAL:-/tmp/atlas-pgdata}"

echouer() { echo "❌ $*" >&2; return 1; }

if [ ! -x "$BIN/initdb" ]; then
  echouer "PostgreSQL 16 est absent de $BIN — cet environnement a changé, revoir ce script."
  return 1 2>/dev/null || exit 1
fi

# initdb refuse de tourner en root, et c'est délibéré de sa part. On emprunte
# donc le compte postgres du système, qui existe déjà.
if [ ! -f "$PGDATA_LOCAL/PG_VERSION" ]; then
  echo "→ Création du cluster dans $PGDATA_LOCAL"
  rm -rf "$PGDATA_LOCAL"
  mkdir -p "$PGDATA_LOCAL"
  chown -R postgres:postgres "$PGDATA_LOCAL"
  su postgres -c "$BIN/initdb -D $PGDATA_LOCAL -U postgres --auth=trust" >/dev/null || {
    echouer "initdb a échoué."
    return 1 2>/dev/null || exit 1
  }
fi

if ! pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
  echo "→ Démarrage de PostgreSQL"
  su postgres -c "$BIN/pg_ctl -D $PGDATA_LOCAL -o '-p 5432 -c listen_addresses=localhost' -l $PGDATA_LOCAL/log start" >/dev/null
  for _ in $(seq 1 20); do
    pg_isready -h localhost -p 5432 >/dev/null 2>&1 && break
    sleep 1
  done
  pg_isready -h localhost -p 5432 >/dev/null 2>&1 || {
    echo "--- journal du serveur ---" >&2
    tail -20 "$PGDATA_LOCAL/log" >&2
    echouer "PostgreSQL n'a pas démarré."
    return 1 2>/dev/null || exit 1
  }
fi

if ! redis-cli ping >/dev/null 2>&1; then
  echo "→ Démarrage de Redis"
  redis-server --daemonize yes --port 6379 >/dev/null
  sleep 1
fi

# Base et rôles, exactement comme la CI les crée (ci.yml + bootstrap-postgres-ci.sql)
# — un banc d'essai qui diverge de la CI ne prouve pas ce qu'on croit.
if ! psql -h localhost -U postgres -lqt 2>/dev/null | cut -d'|' -f1 | grep -qw atlas_test; then
  echo "→ Création de la base atlas_test et des rôles"
  psql -h localhost -U postgres -q -c "CREATE DATABASE atlas_test;" || {
    echouer "Création de la base impossible."
    return 1 2>/dev/null || exit 1
  }
fi
psql -h localhost -U postgres -d atlas_test -q -v ON_ERROR_STOP=1 \
  -f "$(dirname "${BASH_SOURCE[0]:-$0}")/bootstrap-postgres-ci.sql" >/dev/null || {
  echouer "Le bootstrap des rôles a échoué."
  return 1 2>/dev/null || exit 1
}

export DATABASE_URL=postgresql://atlas_app:atlas_app_ci_pw@localhost:5432/atlas_test
export DATABASE_ADMIN_URL=postgresql://atlas_owner:atlas_owner_ci_pw@localhost:5432/atlas_test
export AUTH_SECRET=ci-secret-not-a-real-production-value-000000000000
export CRON_SECRET=ci-placeholder-cron-secret-0000000000
export NODE_ENV=test

# REDIS_URL n'est délibérément PAS posée ici, et ce n'est pas un oubli.
#
# La CI ne la pose pas non plus pour `npm test` (ci.yml : elle n'apparaît qu'au
# build et aux suites navigateur). La raison se paie cher quand on s'en écarte :
# plusieurs suites base importent une Server Action, qui importe la limitation
# de débit ; avec REDIS_URL, celle-ci ouvre une connexion ioredis qui ne se
# referme jamais. La suite affiche « 8 réussis, 0 échoué » puis **ne rend jamais
# la main** — le lanceur reste bloqué indéfiniment sur elle, sans la moindre
# erreur à se mettre sous la dent. Une heure perdue à chercher un défaut qui
# n'existait pas, sur une divergence d'une seule variable.
#
# Sans elle, la limitation de débit retombe sur son magasin mémoire, et
# `test-rate-limit-redis-real.ts` lit sa propre variable, REDIS_URL_TEST, avec
# 127.0.0.1:6379 par défaut — le Redis démarré ci-dessus. Rien n'est perdu.
#
# Règle générale : **un banc d'essai qui diverge de la CI ne prouve pas ce
# qu'on croit.** Toute variable ajoutée ici doit l'être aussi là-bas.

# Les migrations tournent sous le rôle PROPRIÉTAIRE, jamais sous le rôle
# applicatif : atlas_app n'a délibérément aucun droit de DDL
# (0001_securite_integrite.sql). Sans cette bascule, `db:migrate` échoue sur un
# « permission denied for schema public » qui envoie chercher un défaut de
# configuration là où il n'y a qu'un rôle mal choisi.
echo "→ Application des migrations (rôle propriétaire)"
if ! DATABASE_URL="$DATABASE_ADMIN_URL" npm run --silent db:migrate 2>&1 | tail -2; then
  echouer "Les migrations ont échoué."
  return 1 2>/dev/null || exit 1
fi

echo
echo "✅ PostgreSQL et Redis sont prêts, base migrée."
echo
echo "   Suites base       : npm test"
echo "   Suites navigateur : DATABASE_URL=postgresql://postgres@localhost:5432/atlas_test npm run test:e2e"
echo "                       (elles inspectent la base : il leur faut un rôle qui traverse la RLS)"
echo "   Jeu de démo       : DATABASE_URL=postgresql://postgres@localhost:5432/atlas_test npm run db:seed"
