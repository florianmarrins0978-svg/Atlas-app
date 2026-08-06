#!/usr/bin/env bash
# Lit `.env.local` et **n'en ressort que ce qui apporte quelque chose** : une
# ligne `NOM=valeur` par variable non vide dans le fichier ET absente de
# l'environnement. N'exporte rien lui-même — l'appelant s'en charge.
#
# **Pourquoi ce filtre existe.** `demarrer.sh` écrit d'avance un `.env.local`
# vide pour que le patron n'ait qu'à coller ses clés. Charger ce fichier
# naïvement (`set -a ; . .env.local`) aurait alors **écrasé avec du vide** des
# clés déjà présentes dans le conteneur — typiquement celles venues des secrets
# de l'espace de travail. Le remède aurait causé exactement la panne qu'il
# prétendait réparer : des clés posées, et une IA débranchée.
#
# Deux règles, donc, et l'ordre compte :
#   1. une valeur vide dans le fichier n'efface jamais rien ;
#   2. une variable déjà posée dans l'environnement l'emporte sur le fichier —
#      ce qui vient de la plateforme prime sur un modèle laissé sur le disque.
#
# Usage : `while IFS= read -r ligne; do export "$ligne"; done < <(charger-cles.sh FICHIER)`
set -uo pipefail

FICHIER="${1:-}"
[ -f "$FICHIER" ] || exit 0

while IFS= read -r ligne || [ -n "$ligne" ]; do
  # Commentaires, lignes vides, et tout ce qui n'a pas la forme NOM=…
  case "$ligne" in
    ''|'#'*) continue ;;
    *=*) ;;
    *) continue ;;
  esac

  nom="${ligne%%=*}"
  valeur="${ligne#*=}"

  # Espaces autour du nom, et guillemets facultatifs autour de la valeur : le
  # patron colle une clé à la main, pas un fichier généré par une machine.
  # L'ordre compte : d'abord les espaces, ENSUITE les guillemets. L'inverse
  # laissait `KEY = "sk-…"` avec ses guillemets, parce que l'espace de tête
  # empêchait de les reconnaître — et la clé partait fausse chez le
  # fournisseur, avec pour seul symptôme un « clé refusée » incompréhensible.
  nom="$(printf '%s' "$nom" | tr -d '[:space:]')"
  valeur="$(printf '%s' "$valeur" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
  valeur="${valeur#\"}"; valeur="${valeur%\"}"
  valeur="${valeur#\'}"; valeur="${valeur%\'}"

  [ -z "$nom" ] && continue
  [ -z "$valeur" ] && continue
  # Déjà posée et non vide : on n'y touche pas.
  [ -n "${!nom:-}" ] && continue

  printf '%s=%s\n' "$nom" "$valeur"
done < "$FICHIER"
