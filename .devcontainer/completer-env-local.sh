#!/usr/bin/env bash
# Écrit `.env.local` s'il manque, et **le complète s'il existe déjà**.
#
# ─────────────────────────────────────────────────────────────────────────────
# **POURQUOI IL NE SUFFIT PAS DE L'ÉCRIRE UNE FOIS.** La première version
# vivait dans `demarrer.sh`, sous un `if [ ! -f ]` : le fichier naissait au
# premier démarrage, avec les deux clés d'IA de l'époque, et plus jamais
# ensuite. Une clé ajoutée à Atlas par la suite n'avait donc **aucun moyen
# d'atteindre un espace déjà allumé une fois** — le fichier de secours créé
# pour lui épargner un geste devenait la raison pour laquelle le geste
# revenait, sans que rien ne le dise.
#
# Payé le 10 septembre 2026 : la porte affiche Google et Apple dès que leurs
# clés sont posées, et son écran ne les montrait pas. Le code était juste ; il
# n'y avait nulle part où coller `AUTH_GOOGLE_ID`.
#
# **Complété, jamais réécrit.** Une valeur déjà collée ne se touche pas : on
# ajoute uniquement les noms absents, à la fin, avec la phrase qui dit à quoi
# ils servent. Un nom vide n'efface rien — `charger-cles.sh` ignore les valeurs
# vides, et c'est ce qui rend l'ajout sans danger.
#
# Ignoré par git (`.gitignore` : `.env*`) — une clé ne se versionne pas.
#
# Usage : `completer-env-local.sh <chemin du .env.local>`
set -uo pipefail

FICHIER="${1:-}"
[ -n "$FICHIER" ] || exit 0

if [ ! -f "$FICHIER" ]; then
  cat > "$FICHIER" <<'MODELE'
# Collez vos clés après le signe = , puis rechargez la page de l'éditeur.
# Rien d'autre à faire : Atlas les prend en compte au démarrage suivant.
#
# Ce fichier n'est jamais envoyé sur GitHub.
MODELE
fi

# Un nom par ligne, avec la phrase qui le précède. L'ordre est celui du
# fichier modèle : ce qui sert à la dictée d'abord, la porte ensuite.
ajouter() {
  nom="$1"
  phrase="$2"
  # Le nom, et lui seul : `AUTH_GOOGLE_ID` ne doit pas se reconnaître dans
  # `AUTH_GOOGLE_ID_ANCIEN`, ni dans une phrase de commentaire qui le cite.
  if ! grep -qE "^[[:space:]]*${nom}[[:space:]]*=" "$FICHIER"; then
    printf '\n# %s\n%s=\n' "$phrase" "$nom" >> "$FICHIER"
  fi
}

ajouter OPENAI_API_KEY      "Pour que votre voix devienne du texte :"
ajouter ANTHROPIC_API_KEY   "Pour que ce texte devienne un devis structuré :"
# Le bouton n'apparaît que si les DEUX lignes de la marque sont remplies :
# un identifiant sans son secret ne mène qu'à une page d'erreur.
ajouter AUTH_GOOGLE_ID      "Pour entrer avec Google (voir docs/entrer-avec-google.md) :"
ajouter AUTH_GOOGLE_SECRET  "Le secret du même identifiant Google :"
ajouter AUTH_APPLE_ID       "Pour entrer avec Apple (Service ID, compte développeur payant) :"
ajouter AUTH_APPLE_SECRET   "Le secret du même Service ID Apple :"
