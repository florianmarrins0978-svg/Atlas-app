#!/usr/bin/env bash
# Empêche l'espace de se bloquer LUI-MÊME en réécrivant `package-lock.json`.
#
# **La panne du 12 septembre 2026, et elle a duré la journée.** Le patron :
# « je ne vois pas les modifications ». Son espace tournait, servait, répondait
# — et exécutait le code de 3 h 38 alors que `main` était à 4 h 00, trois
# versions plus loin. Sa fiche donnait la raison en deux lignes :
#
#     ⚠ Des modifications non enregistrées sont présentes.
#       M package-lock.json
#
# Personne ne l'avait modifié. `npm install` l'avait fait — le repli de
# `demarrer.sh` quand `npm ci` refuse. Et `mettre-a-jour.sh` s'abstient devant
# un arbre sale, à raison : il ne peut pas savoir que ce fichier-là n'est le
# travail de personne.
#
# **Le piège est qu'il se referme sur lui-même.** L'installation ne tourne
# qu'APRÈS une mise à jour réussie (`demarrer.sh` : `if [ "$MISE_A_JOUR" =
# "faite" ]`). Une fois l'arbre sali, plus aucune mise à jour ne passe, donc
# plus aucune installation ne tourne, donc rien ne remet le fichier en état.
# **Un seul démarrage malheureux fige l'espace pour toujours** — et la seule
# trace est une ligne dans une fiche que le patron n'a aucune raison de lire.
#
# Ce qu'on fait ici, et rien de plus : **on ne rend propre que ce qu'on vient
# de salir soi-même**. Un `package-lock.json` déjà modifié AVANT l'installation
# peut être le travail de quelqu'un ; on n'y touche pas, et la mise à jour
# continuera de s'abstenir — c'est exactement le comportement voulu.
#
# Vit dans son propre fichier, comme `mettre-a-jour.sh` et pour la même raison :
# ainsi il est ÉPROUVABLE (`scripts/test-proteger-lock.ts` le confronte à un
# fichier sali par l'installation, à un fichier déjà sale avant, à un dépôt qui
# ne répond pas — et vérifie qu'après son passage la mise à jour repasse).
#
# Deux gestes, qui encadrent l'installation :
#     AVANT="$(bash proteger-lock.sh etat "$DEPOT")"
#     … npm ci / npm install …
#     bash proteger-lock.sh remettre "$DEPOT" "$AVANT"
#
# Écrit sur la sortie standard une seule ligne : l'issue.
#   propre | sale | remis | rien à faire | laissé : <raison> | sans avis : <raison>
set -uo pipefail

GESTE="${1:-}"
DEPOT="${2:-$(pwd)}"
FICHIER="package-lock.json"

cd "$DEPOT" 2>/dev/null || { echo "sans avis : dossier introuvable"; exit 0; }

# Hors d'un dépôt git il n'y a rien à protéger — et surtout rien à casser : ce
# script tourne au démarrage de son espace, il ne doit jamais en être la cause.
git rev-parse --git-dir >/dev/null 2>&1 || { echo "sans avis : pas un dépôt git"; exit 0; }

modifie() {
  [ -n "$(git status --porcelain -- "$FICHIER" 2>/dev/null)" ]
}

case "$GESTE" in
  etat)
    if modifie; then echo "sale"; else echo "propre"; fi
    ;;

  remettre)
    AVANT="${3:-}"
    # Le doute profite au travail non enregistré : sans état d'avant fiable,
    # on ne touche à rien. Effacer le fichier de quelqu'un pour livrer une mise
    # à jour serait un remède pire que le mal (`mettre-a-jour.sh`, même règle).
    if [ "$AVANT" != "propre" ]; then
      echo "laissé : déjà modifié avant l'installation"
      exit 0
    fi
    if ! modifie; then
      echo "rien à faire"
      exit 0
    fi
    if git checkout -- "$FICHIER" 2>/dev/null; then
      echo "remis"
    else
      echo "laissé : la remise en état a échoué"
    fi
    ;;

  *)
    echo "sans avis : geste inconnu"
    ;;
esac

exit 0
