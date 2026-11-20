# Ce que les scripts du tournage partagent : où l'on travaille, et sur quoi.
# Se charge par « source », depuis serveur.sh et etat.sh.
#
# TOUT se passe sur ce poste : la base d'essai locale (scripts/monter-base-locale.sh),
# jamais une base habitée. Les adresses ci-dessous sont celles de cette base-là,
# les mêmes que la CI (CLAUDE.md §5) ; aucune n'est un secret.
ICI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPOT="$(cd "$ICI/../../.." && pwd)"
TOURNAGE="${TOURNAGE:-/tmp/atlas-tournage}"
mkdir -p "$TOURNAGE"
PG_LOCAL="postgresql://postgres@localhost:5432"
BASE_D_ESSAI="atlas_test"
