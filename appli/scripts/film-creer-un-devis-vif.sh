#!/bin/bash
# =======================================================================
# Le film de l'ouverture du site de vente en mouvement, recoupé :
# vente/images/nov-creer-un-devis-vif.mp4 et .webm.
#
# Sa remarque du 19 novembre 2026, sur vente/cause-2-visite.html : « un léger bug
# sur la première cinématique quand on clique sur créer le devis et que la
# fiche client apparaît [...] comme si elle freezait une demi-seconde. »
#
# Ce n'était pas un gel. Dans l'appli, « Créer un devis + » joue un geste
# qu'il a choisi (le « + » d'or fait trois quarts de tour, une gerbe de
# grains en part) et la fiche ne monte qu'au bout de 520 ms
# (src/app/EcranChantiers.tsx, ouvrirAvecLeGeste). Le film d'origine le
# montre tel quel. Mais sur le site le téléphone fait 271 px de large : le
# « + » y mesure une dizaine de pixels, ses grains n'existent plus, et une
# demi-seconde où rien d'autre ne bouge se lit comme une panne.
#
# Ici le « + » fait son premier quart de tour (les images 0 à 4), et la
# fiche monte aussitôt (les images 13 à 30). Le raccord est exact : un « + »
# tourné d'un quart ou de trois quarts de tour se dessine pareil, et la
# phrase, qui enfle pendant le geste, a la même largeur à un pixel près aux
# images 4 et 13 (307 et 306). Le film passe de 1,24 s à 0,92 s. Sa première
# et sa dernière image n'ont pas bougé : nov-creer-un-devis.jpg et
# nov-creer-un-devis-fin.jpg servent toujours.
#
# Le film d'origine (nov-creer-un-devis.*) reste tel quel : cause.html et
# chapitres-6.html le jouent.
#
# Utilisation, depuis la racine du dépôt :
#   bash appli/scripts/film-creer-un-devis-vif.sh appli/vente/images
# Il faut ffmpeg (libx264, libvpx-vp9).
# =======================================================================
set -euo pipefail
dossier="${1:?Usage : bash appli/scripts/film-creer-un-devis-vif.sh <dossier des images du site>}"
source="$dossier/nov-creer-un-devis.mp4"
sortie="$dossier/nov-creer-un-devis-vif"

# Le film d'origine doit être celui qu'on a mesuré : 31 images. Autrement
# les numéros d'images ci-dessous couperaient ailleurs, sans rien dire.
images=$(ffprobe -v error -select_streams v:0 -count_frames -show_entries stream=nb_read_frames -of csv=p=0 "$source")
if [ "$images" != "31" ]; then echo "REFUS : $source a $images images, on en attendait 31. Le film d'origine a changé : remesurer où finit le quart de tour et où commence la montée." >&2; exit 1; fi

garde="select='lt(n\,5)+gte(n\,13)',setpts=N/25/TB"
couleur=(-color_range tv -colorspace bt709 -color_primaries bt709 -color_trc bt709)
ffmpeg -v error -y -i "$source" -vf "$garde,format=yuv420p" -r 25 -c:v libx264 -preset veryslow -crf 17 -profile:v high -level 4.0 -g 250 -movflags +faststart "${couleur[@]}" -an "$sortie.mp4"
ffmpeg -v error -y -i "$source" -vf "$garde,format=yuv420p" -r 25 -c:v libvpx-vp9 -crf 30 -b:v 0 -deadline good -cpu-used 1 -row-mt 1 -g 250 "${couleur[@]}" -an "$sortie.webm"
echo "Écrits : $(basename "$sortie").mp4 ($(stat -c %s "$sortie.mp4") octets) et $(basename "$sortie").webm ($(stat -c %s "$sortie.webm") octets)"
