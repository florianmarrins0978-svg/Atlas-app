#!/usr/bin/env bash
# Applique les migrations sur le banc d'essai, SOUS LE BON RÔLE, et dit ce qui
# s'est passé.
#
# **Le défaut que ce fichier répare, trouvé le 9 août 2026 en lisant.** Deux
# endroits lançaient `npm run db:migrate` : le démarrage de l'espace et le
# bouton « Chercher les dernières corrections ». Tous deux avec la variable
# ambiante `DATABASE_URL`, qui vaut `atlas_app` sur le banc — **le rôle
# applicatif, qui n'a délibérément aucun droit de créer une table**
# (`docker/init/01-bootstrap-atlas.sql`).
#
# La commande échouait donc sur « permission denied for schema public ». Et les
# deux appels **avalaient l'échec** : `|| true` d'un côté, `.catch(() =>
# undefined)` de l'autre. Le patron lisait « Mise à jour récupérée », le code
# neuf arrivait, la base restait vieille — et l'écran qui touchait une table
# absente tombait, sans que rien n'ait annoncé la panne.
#
# Deux corrections, et la seconde compte autant que la première :
#
#   1. **le rôle propriétaire**, comme `CLAUDE.md` §5 le dit déjà pour les
#      essais locaux : `DATABASE_ADMIN_URL` d'abord, `DATABASE_URL` à défaut ;
#   2. **l'échec se dit.** Un contrôle qui ne sait pas échouer ne prouve rien ;
#      une commande qui échoue en silence est pire, parce qu'elle affirme.
#
# Un seul fichier pour les deux appelants : deux copies auraient divergé, et
# l'une des deux serait restée sur le mauvais rôle.
#
# Écrit sur la sortie standard une seule ligne :
#   faites | échec : <ce que la base a répondu>
set -uo pipefail

DEPOT="${1:-$(pwd)}"
cd "$DEPOT" 2>/dev/null || { echo "échec : dossier introuvable"; exit 0; }

# Le rôle propriétaire s'il est connu. Sur le banc il l'est toujours
# (docker-compose le pose) ; ailleurs, on retombe sur ce qu'il y a, et le
# message dira ce que la base en a pensé.
URL="${DATABASE_ADMIN_URL:-${DATABASE_URL:-}}"
if [ -z "$URL" ]; then
  echo "échec : aucune adresse de base (ni DATABASE_ADMIN_URL ni DATABASE_URL)"
  exit 0
fi

SORTIE="$(DATABASE_URL="$URL" npm run --silent db:migrate 2>&1)"
CODE=$?

if [ "$CODE" -ne 0 ]; then
  # **La PREMIÈRE ligne qui nomme la cause, pas la dernière.**
  #
  # Le premier jet prenait la dernière ligne correspondante et rendait
  # « échec :   routine: 'aclcheck_error' » — le nom d'une fonction interne de
  # PostgreSQL, qui envoie chercher n'importe où. La vraie phrase, « permission
  # denied for schema public », se trouvait douze lignes plus haut.
  #
  # Une erreur qui accuse à tort coûte plus cher que pas d'erreur du tout
  # (`CLAUDE.md` §5). On cherche donc les formulations que PostgreSQL et le
  # pilote écrivent VRAIMENT, dans l'ordre où elles apparaissent.
  RAISON="$(printf '%s\n' "$SORTIE" \
    | grep -iE 'permission denied|does not exist|already exists|authentification|password authentication|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|no pg_hba|syntax error|violates' \
    | head -1 \
    | sed -E 's/^[[:space:]]*//; s/^Error:[[:space:]]*//')"
  # Rien de reconnu : on rend la première ligne d'erreur brute plutôt que la
  # dernière, qui est presque toujours un détail de pile.
  [ -z "$RAISON" ] && RAISON="$(printf '%s\n' "$SORTIE" | grep -iE 'error' | head -1 | sed -E 's/^[[:space:]]*//')"
  [ -z "$RAISON" ] && RAISON="$(printf '%s\n' "$SORTIE" | tail -1)"
  echo "échec : ${RAISON:-la commande a échoué sans rien écrire}"
  exit 0
fi

echo "faites"
