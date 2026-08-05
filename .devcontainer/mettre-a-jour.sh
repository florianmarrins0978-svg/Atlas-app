#!/usr/bin/env bash
# Récupère le code neuf dans l'espace de travail, et dit ce qu'il a fait.
#
# **Le défaut qui a coûté le plus cher.** Un espace de travail garde le code
# qu'il avait le jour de sa création. Le patron a donc réessayé, un jour plus
# tard, des correctifs livrés la veille — et constaté qu'ils « ne marchaient
# toujours pas » : la bande déroulante des durées « avait disparu », le numéro
# du client « ne se mettait toujours pas ». Les deux étaient corrigés et
# fusionnés. Il éprouvait une version d'avant, sans que rien ne le lui dise.
#
# Deux règles, tirées de là :
#   1. l'espace se met à jour tout seul, à chaque allumage ;
#   2. quand il ne peut pas, il le DIT — et l'application affiche de toute façon
#      la version qu'elle exécute (Réglages), pour qu'une capture d'écran
#      réponde à la question sans avoir à la poser.
#
# **Prudence, dans cet ordre :** on ne touche à rien si du travail n'est pas
# enregistré, et on n'avance qu'en ligne droite (`--ff-only`). Écraser le
# travail du patron pour lui livrer une mise à jour serait un remède pire que
# le mal.
#
# Vit dans son propre fichier, et non dans `demarrer.sh`, pour une raison
# simple : ainsi il est **éprouvable** (`scripts/test-mise-a-jour-espace.ts` le
# confronte à un dépôt en retard, à un dépôt sale et à un historique divergent).
# Enfoui dans le script de démarrage, il n'aurait jamais été vu échouer.
#
# Écrit sur la sortie standard une seule ligne : l'issue.
#   à jour | faite | impossible : <raison>
set -uo pipefail

DEPOT="${1:-$(pwd)}"
cd "$DEPOT" 2>/dev/null || { echo "impossible : dossier introuvable"; exit 0; }

BRANCHE="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '')"
if [ -z "$BRANCHE" ] || [ "$BRANCHE" = "HEAD" ]; then
  echo "impossible : aucune branche courante"
  exit 0
fi

# Un dépôt sale n'est pas forcément un accident : le patron a pu corriger un
# tarif dans un fichier, ou l'éditeur laisser un brouillon. On s'abstient.
if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
  echo "impossible : des modifications non enregistrées sont présentes"
  exit 0
fi

if ! git fetch --quiet origin "$BRANCHE" 2>/dev/null; then
  echo "impossible : le dépôt distant n'a pas pu être joint"
  exit 0
fi

AVANT="$(git rev-parse HEAD)"
if ! git merge --ff-only --quiet "origin/$BRANCHE" 2>/dev/null; then
  echo "impossible : l'historique local a divergé"
  exit 0
fi

if [ "$AVANT" = "$(git rev-parse HEAD)" ]; then
  echo "à jour"
  exit 0
fi

echo "faite"
