#!/usr/bin/env bash
# Garde le serveur du banc d'essai debout, et le relève quand il tombe.
#
# **Le défaut du 9 août 2026, et il n'était pas une lenteur.** Le patron ouvre
# l'application : « Cette page … est introuvable — HTTP ERROR 404 ». Son
# terminal montrait l'invite revenue sous `npm run essai` : **le serveur était
# mort**. Un 404 sur cette adresse ne veut pas dire « page absente », il veut
# dire « plus rien n'écoute sur le port 3000 ».
#
# Rien ne le relevait. Le démarrage de l'espace lance le serveur une fois, et
# une seule ; s'il meurt ensuite — un `pkill` du démarrage rejoué, une commande
# tapée dans le mauvais terminal, une compilation qui épuise la mémoire des deux
# cœurs — l'application reste morte jusqu'à ce que le patron s'en aperçoive et
# aille taper une commande. C'est-à-dire jusqu'à ce qu'il perde une demi-heure.
#
# Ce veilleur regarde toutes les quinze secondes, et relance ce qu'il faut.
#
# **Deux conditions avant de relancer, pas une.** Le serveur peut mettre
# longtemps à répondre pendant une grosse compilation : sur ce seul critère, on
# lancerait un second serveur qui se battrait avec le premier pour le port —
# exactement le désordre qui a tué celui du patron. On exige donc que la santé
# ne réponde plus ET qu'aucun `next dev` ne tourne.
#
# Ne rend jamais la main : lancé par `demarrer.sh` avec `setsid`, détaché.
set -uo pipefail

DEPOT="${1:-$(pwd)}"
PORT="${PORT:-3000}"
JOURNAL="${JOURNAL:-/tmp/essai.log}"
VERROU=/tmp/atlas-veilleur.pid
INTERVALLE=15

# **Un seul veilleur.** Deux veilleurs relanceraient deux serveurs, et le remède
# reproduirait la panne. Le verrou porte un identifiant de processus : un
# fichier resté d'un conteneur précédent ne bloque donc rien.
if [ -f "$VERROU" ]; then
  ANCIEN="$(cat "$VERROU" 2>/dev/null || true)"
  if [ -n "$ANCIEN" ] && kill -0 "$ANCIEN" 2>/dev/null; then
    echo "veilleur déjà en place (pid $ANCIEN)"
    exit 0
  fi
fi
echo $$ > "$VERROU"

cd "$DEPOT" || exit 0

# Les crochets autour du « n » : sans eux, `pgrep -f` trouverait la ligne de
# commande de ce script lui-même et conclurait toujours que le serveur tourne.
# Le même piège avait déjà fait que `demarrer.sh` se tuait avant de rien lancer.
MOTIF='[n]ext dev'

while true; do
  if ! curl -fsS -o /dev/null --max-time 10 "http://127.0.0.1:${PORT}/api/health/live" 2>/dev/null; then
    if ! pgrep -f "$MOTIF" >/dev/null 2>&1; then
      echo "$(date '+%d/%m %H:%M:%S') — plus rien n'écoute sur le port ${PORT}, relance du serveur" >> "$JOURNAL"
      # Rend la main seulement quand le serveur meurt : la boucle le relèvera.
      npm run essai >> "$JOURNAL" 2>&1
      echo "$(date '+%d/%m %H:%M:%S') — le serveur s'est arrêté" >> "$JOURNAL"
    fi
  fi
  sleep "$INTERVALLE"
done
