#!/bin/bash
# =======================================================================
# Les états d'un tournage : des copies entières de la base d'essai locale,
# pour rejouer une prise sans tout resaisir.
#
#   bash appli/scripts/tournage/etat.sh garder <nom>     copie la base vers atlas_scene_<nom>
#   bash appli/scripts/tournage/etat.sh reprendre <nom>  remet la base telle que la copie
#
# Une prise consomme son état : un devis accepté ne s'accepte pas deux fois.
# On garde donc « envoye » avant de tourner la signature, « accepte » avant
# de tourner la fiche.
#
# Le serveur de l'appli doit être arrêté (serveur.sh arreter) : une copie
# exige que personne ne soit branché sur la base, et ce script le vérifie.
# Il ne connaît que la base d'essai de CE poste : « reprendre » la remplace
# entièrement, et ne se joue donc jamais ailleurs.
# =======================================================================
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/_lieu.sh"
geste="${1:?garder ou reprendre}"; nom="${2:?un nom}"
case "$nom" in *[!a-z0-9_]*) echo "REFUS : un nom en minuscules, chiffres et tirets bas." >&2; exit 2 ;; esac
branches=$(psql "$PG_LOCAL/postgres" -tA -c "select count(*) from pg_stat_activity where datname in ('$BASE_D_ESSAI','atlas_scene_$nom')")
if [ "$branches" != "0" ]; then echo "REFUS : $branches connexion(s) encore ouvertes sur la base. Arrêter le serveur de l'appli d'abord (et attendre deux secondes)." >&2; exit 1; fi
case "$geste" in
  garder)
    psql "$PG_LOCAL/postgres" -q -c "DROP DATABASE IF EXISTS atlas_scene_$nom" -c "CREATE DATABASE atlas_scene_$nom TEMPLATE $BASE_D_ESSAI" ;;
  reprendre)
    psql "$PG_LOCAL/postgres" -tA -c "select 1 from pg_database where datname='atlas_scene_$nom'" | grep -q 1 || { echo "REFUS : pas de copie atlas_scene_$nom" >&2; exit 1; }
    psql "$PG_LOCAL/postgres" -q -c "DROP DATABASE $BASE_D_ESSAI" -c "CREATE DATABASE $BASE_D_ESSAI TEMPLATE atlas_scene_$nom" ;;
  *) echo "garder ou reprendre" >&2; exit 2 ;;
esac
echo "$geste $nom : fait"
