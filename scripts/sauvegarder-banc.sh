#!/usr/bin/env bash
# Met la base du banc d'essai à l'abri, dans un fichier qu'on peut emporter.
#
# **Pourquoi ce script existe.** Le 10 août 2026, j'ai conseillé au patron de
# supprimer son espace de travail pour repartir sur un disque sain. Il a
# répondu, et il avait raison : « ça va effacer tout ce qu'il y a en mémoire ».
# La base vit DANS le conteneur — supprimer l'espace emporte ses chantiers, ses
# clients, et tout ce que l'agent a appris : corrections, leçons de prix,
# grilles. Aucun conseil de dépannage ne doit être payé de ça.
#
# Ce script écrit une copie complète à la racine du dépôt, où l'éditeur la voit
# et permet de la télécharger d'un geste. Il ne modifie rien dans la base.
#
#     bash scripts/sauvegarder-banc.sh
set -uo pipefail

CD="$(cd "$(dirname "$0")/.." && pwd)"
# L'horodatage vient du système : deux sauvegardes du même jour ne doivent pas
# s'écraser l'une l'autre — c'est précisément le jour où on en fait deux qu'on
# a besoin des deux.
FICHIER="$CD/sauvegarde-atlas-$(date +%Y%m%d-%H%M).sql"

# **Le rôle SUPERUTILISATEUR, et pas un autre.** `atlas_app` ne traverse pas la
# RLS : une sauvegarde faite sous lui serait vide de la moitié des lignes, et
# personne ne s'en apercevrait avant d'en avoir besoin.
URL="${DATABASE_SUPER_URL:-${DATABASE_ADMIN_URL:-${DATABASE_URL:-}}}"
if [ -z "$URL" ]; then
  echo "❌ Aucune adresse de base connue (DATABASE_SUPER_URL, DATABASE_ADMIN_URL, DATABASE_URL)."
  echo "   Sans elle, il n'y a rien à sauvegarder : on s'arrête plutôt que d'écrire un fichier vide."
  exit 1
fi

# `ATLAS_SANS_PGDUMP=1` sert à ÉPROUVER ce repli sur une machine qui, elle,
# possède pg_dump. Un chemin de secours jamais joué ne protège de rien.
if [ "${ATLAS_SANS_PGDUMP:-}" = "1" ] || ! command -v pg_dump > /dev/null 2>&1; then
  echo "→ pg_dump absent de ce conteneur — sauvegarde par l'application."
  cd "$CD" && exec node scripts/sauvegarder-banc.mjs
fi

echo "→ Copie de la base en cours…"
if ! pg_dump "$URL" > "$FICHIER" 2> /tmp/sauvegarde-banc.err; then
  echo "❌ La copie a échoué. Ce que PostgreSQL a répondu :"
  sed 's/^/   /' /tmp/sauvegarde-banc.err | head -5
  rm -f "$FICHIER"
  exit 1
fi

# **Un fichier de zéro octet n'est pas une sauvegarde.** Le contrôle existe
# parce qu'une commande qui « ne plante pas » n'a jamais prouvé qu'elle a écrit
# quelque chose.
TAILLE=$(wc -c < "$FICHIER")
if [ "$TAILLE" -lt 1000 ]; then
  echo "❌ Le fichier fait $TAILLE octets — ce n'est pas une base, c'est un accident."
  exit 1
fi

echo
echo "  ─────────────────────────────────────────────────────────────"
echo "   Sauvegarde faite : $(basename "$FICHIER")"
echo "   $(du -h "$FICHIER" | cut -f1) — elle est à la racine, dans la liste de gauche."
echo
echo "   Pour l'emporter : appui long sur le fichier → « Télécharger »."
echo "   Tant qu'elle n'est pas sur votre appareil, elle disparaît"
echo "   avec l'espace de travail — elle vit au même endroit."
echo "  ─────────────────────────────────────────────────────────────"
