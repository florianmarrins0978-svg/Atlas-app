#!/usr/bin/env bash
# Décide de l'état de l'IA au démarrage de l'espace d'essai, et l'annonce en un
# mot. **Ne modifie rien** : il constate, l'appelant agit.
#
# Pourquoi un fichier séparé plutôt que quinze lignes dans `demarrer.sh` : pour
# la même raison que `mettre-a-jour.sh`. Un script de démarrage n'est jamais
# relu et jamais vu échouer. Isolé, celui-ci est confronté à chacun des états
# qu'il prétend distinguer par `scripts/test-reglage-ia-espace.ts`.
#
# Il sort UN de ces mots :
#
#   branchee    une clé est présente, rien ne s'y oppose
#   neutralise  une clé est présente, mais le conteneur fige encore `dev` —
#               héritage d'un espace construit avant le 6 août 2026.
#               L'appelant doit alors retirer LLM_PROVIDER et
#               TRANSCRIPTION_PROVIDER avant de démarrer l'application.
#   coupee      une clé est présente et le patron a délibérément posé `dev`
#   sans-cle    aucune clé : mode déterministe, rien ne sort
#
# **Pourquoi `neutralise` existe, et pourquoi ce n'est pas une entorse.**
# La règle du dépôt est qu'une variable explicite l'emporte sur la détection
# automatique. Mais dans un espace construit avant le correctif, `LLM_PROVIDER`
# ne vaut pas `dev` parce que le patron l'a voulu : il vaut `dev` parce qu'un
# fichier qu'il n'a jamais ouvert l'écrivait en dur. Sans cette distinction, il
# lui faudrait reconstruire son conteneur pour que ses clés servent enfin — un
# geste introuvable sur un téléphone, et c'est précisément le genre d'obstacle
# qui a déjà coûté quatre tentatives.
#
# La distinction ne se devine pas : le conteneur d'après le correctif porte
# `ATLAS_CONTENEUR`. Sa présence signifie « ce que tu lis a été voulu ».
set -uo pipefail

CLE_PRESENTE=0
[ -n "${ANTHROPIC_API_KEY:-}" ] && CLE_PRESENTE=1
[ -n "${OPENAI_API_KEY:-}" ] && CLE_PRESENTE=1

if [ "$CLE_PRESENTE" = "0" ]; then
  echo "sans-cle"
  exit 0
fi

FIGE=0
[ "${LLM_PROVIDER:-}" = "dev" ] && FIGE=1
[ "${TRANSCRIPTION_PROVIDER:-}" = "dev" ] && FIGE=1

if [ "$FIGE" = "0" ]; then
  echo "branchee"
elif [ -n "${ATLAS_CONTENEUR:-}" ]; then
  echo "coupee"
else
  echo "neutralise"
fi
