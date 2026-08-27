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

# ─────────────────────────────────────────────────────────────────────────────
# **ET LA TAILLE NE SUFFIT PAS. Mesuré le 27 août 2026.**
#
# Une sauvegarde prise sous un rôle qui ne traverse pas la RLS s'arrête sur
# `ERROR: query would be affected by row-level security policy` — mais elle a
# DÉJÀ écrit son en-tête : 867 octets, un `COPY public.clients (…) FROM stdin;`
# parfaitement crédible, et pas une ligne de données. Le seuil de 1 000 octets
# est passé de justesse ; le schéma seul d'Atlas, lui, le dépasse largement.
#
# Autrement dit : le contrôle de taille attrape le fichier vide, et laisse
# passer le fichier PLAUSIBLE ET VIDE DE DONNÉES — celui qu'on découvre le jour
# où on en a besoin.
#
# On compte donc les lignes de données. `COPY … FROM stdin;` est suivi des
# lignes, puis d'un `\.` seul sur sa ligne : ce qui est entre les deux, ce sont
# les données. Zéro partout, c'est une sauvegarde qui ne sauvegarde rien.
LIGNES_DONNEES=$(awk '
  /^COPY .* FROM stdin;$/ { dedans = 1; next }
  /^\\\.$/             { dedans = 0; next }
  dedans                  { n++ }
  END                     { print n + 0 }
' "$FICHIER")

if [ "$LIGNES_DONNEES" -eq 0 ]; then
  echo "❌ La sauvegarde ne contient AUCUNE ligne de données."
  echo
  echo "   Le fichier fait pourtant $TAILLE octets : c'est le SCHÉMA, sans les données."
  echo
  # **On n'accuse PAS le rôle ici, et c'est réfléchi.** Un rôle qui ne traverse
  # pas la RLS fait ÉCHOUER pg_dump (code 1), ce qui est attrapé plus haut. Si
  # l'on arrive jusqu'ici, c'est que pg_dump a réussi : le rôle était bon, et
  # dire le contraire enverrait chercher au mauvais endroit. La première version
  # de ce message faisait exactement cette faute (27 août 2026).
  echo "   La copie a RÉUSSI : le rôle employé était donc le bon. Il reste"
  echo "   deux causes, et une seule est grave :"
  echo "     · la base est réellement vide — normal sur une installation neuve ;"
  echo "     · la copie n'a pris que le schéma (option --schema-only quelque part)."
  echo
  echo "   Dans les deux cas, ce fichier ne protège de rien : il est effacé"
  echo "   plutôt que d'être gardé sous un nom qui promet une sauvegarde."
  rm -f "$FICHIER"
  exit 1
fi

# **Et on confronte au vivant.** Un fichier peut porter des lignes et en avoir
# perdu la moitié. On compare donc à ce que la base annonce, sur une table qui
# ne ment pas : celle des migrations, présente sur toute base d'Atlas.
MIGRATIONS_EN_BASE=$(psql "$URL" -tAc "SELECT count(*) FROM _migrations" 2>/dev/null | tr -d ' ')
MIGRATIONS_DANS_LE_FICHIER=$(awk '
  /^COPY public\._migrations .* FROM stdin;$/ { dedans = 1; next }
  /^\\\.$/                                  { dedans = 0; next }
  dedans                                       { n++ }
  END                                          { print n + 0 }
' "$FICHIER")
if [ -n "$MIGRATIONS_EN_BASE" ] && [ "$MIGRATIONS_EN_BASE" != "$MIGRATIONS_DANS_LE_FICHIER" ]; then
  echo "❌ La sauvegarde ne porte pas toutes les migrations."
  echo "   En base : $MIGRATIONS_EN_BASE — dans le fichier : $MIGRATIONS_DANS_LE_FICHIER."
  echo "   Restaurée telle quelle, elle rendrait une base que le code ne reconnaît pas."
  rm -f "$FICHIER"
  exit 1
fi

echo
echo "  ─────────────────────────────────────────────────────────────"
echo "   Sauvegarde faite : $(basename "$FICHIER")"
echo "   $(du -h "$FICHIER" | cut -f1), $LIGNES_DONNEES lignes de données, $MIGRATIONS_DANS_LE_FICHIER migrations."
echo "   Elle est à la racine, dans la liste de gauche."
echo
echo "   Pour l'emporter : appui long sur le fichier → « Télécharger »."
echo "   Tant qu'elle n'est pas sur votre appareil, elle disparaît"
echo "   avec l'espace de travail — elle vit au même endroit."
echo
echo "   Pour PROUVER qu'elle vaut quelque chose, sans toucher à la base :"
echo "     npx tsx scripts/eprouver-restauration.ts $(basename "$FICHIER")"
echo "  ─────────────────────────────────────────────────────────────"
