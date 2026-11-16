#!/usr/bin/env bash
# Remettre la base d'essai dans l'état de départ du tournage.
#
# À jouer depuis la racine du dépôt, la base montée par
# `source scripts/monter-base-locale.sh`. Ne touche qu'une base d'essai : le
# seed refuse lui-même toute autre base (src/lib/garde-seed.ts).
set -euo pipefail

BASE_ADMIN="${TOURNAGE_BASE:-postgresql://postgres@localhost:5432/atlas_test}"
ICI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

export AUTH_SECRET="${AUTH_SECRET:-ci-secret-not-a-real-production-value-000000000000}"
export CRON_SECRET="${CRON_SECRET:-ci-placeholder-cron-secret-0000000000}"
export DATABASE_ADMIN_URL="${DATABASE_ADMIN_URL:-postgresql://atlas_owner:atlas_owner_ci_pw@localhost:5432/atlas_test}"

echo "→ Jeu de démonstration (compte demo@atlas.local)"
DATABASE_URL="$BASE_ADMIN" npm run --silent db:seed | tail -3

echo "→ La scène : Les Jardins de Valmorin, ses tarifs, son mois de novembre"
psql "$BASE_ADMIN" -q -v ON_ERROR_STOP=1 -f "$ICI/scene.sql"

# Le limiteur de connexions garde la mémoire des essais précédents : celle de
# CE rang-là seulement (CLAUDE.md §5, jamais FLUSHALL).
redis-cli -n 0 FLUSHDB >/dev/null

echo "✅ Scène posée."
