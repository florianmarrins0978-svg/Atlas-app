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
# **Avec une seule exception, et elle est mesurée** : `package-lock.json`, que
# l'espace réécrit lui-même et que personne n'édite à la main. Il est mis de
# côté (`git stash`, donc récupérable), jamais jeté — sans quoi un unique
# démarrage malheureux fige l'espace pour toujours. Le pourquoi entier est au
# bloc qui le fait, plus bas.
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

# ─────────────────────────────────────────────────────────────────────────────
# **CE QUE L'ESPACE ÉCRIT LUI-MÊME N'EST LE TRAVAIL DE PERSONNE — 12 septembre
# 2026, et cela a figé le sien deux fois dans la même journée.**
#
# La prudence ci-dessous est juste et elle reste : on ne touche pas à ce qu'il
# était en train d'écrire. Mais elle s'appliquait AUSSI à `package-lock.json`,
# que personne n'écrit à la main — c'est `npm install` qui le réécrit, le repli
# de `demarrer.sh` quand `npm ci` refuse.
#
# **Et le piège se referme sur lui-même** : l'installation ne tourne qu'APRÈS
# une mise à jour réussie. Le fichier une fois sali, plus aucune mise à jour ne
# passe, donc plus aucune installation ne tourne, donc rien ne le remet en
# état. Son espace a servi le code de 3 h 38 pendant que `main` était quatorze
# versions plus loin, et il l'aurait servi indéfiniment.
#
# **Il ne se jette pas, il se met de côté** : `git stash` le rend par
# `git stash pop`. C'est exactement le geste que le diagnostic demandait au
# patron de taper sur son téléphone — la machine le fait désormais elle-même.
#
# La liste ne contient QUE ce fichier, et volontairement : un fichier ajouté ici
# au jugé serait du travail mis de côté sans que personne l'ait demandé.
#
# L'identité git est posée pour ce seul appel (`git -c`, qui n'écrit aucune
# configuration) : `git stash` fabrique un commit et refuse sans elle — un
# espace sans identité serait resté bloqué pour la même raison, un cran plus
# loin. Un échec ici ne coûte rien : on retombe sur le refus d'après, qui est
# exactement l'état d'avant.
for FICHIER in package-lock.json; do
  [ -n "$(git status --porcelain -- "$FICHIER" 2>/dev/null)" ] || continue
  if git -c user.name="Atlas" -c user.email="atlas@local" \
       stash push --quiet -m "atlas : $FICHIER mis de côté pour la mise à jour" \
       -- "$FICHIER" > /dev/null 2>&1; then
    echo "mise à jour : $FICHIER mis de côté (« git stash pop » le rend)" >&2
  else
    echo "mise à jour : $FICHIER n'a PAS pu être mis de côté — l'espace restera en retard" >&2
  fi
done

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
