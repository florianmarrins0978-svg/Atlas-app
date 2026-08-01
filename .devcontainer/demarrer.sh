#!/usr/bin/env bash
# Démarre l'application dès que l'espace de travail s'allume, sans qu'on ait
# rien à taper.
#
# Pourquoi ce script existe : le patron essaie Atlas depuis un téléphone. Lui
# demander de lancer `npm run essai` dans un terminal, c'est lui demander de
# viser un curseur au doigt sur six pouces, de ne pas se tromper de commande, et
# de faire un Ctrl+C qui n'existe pas sur son clavier. Quatre tentatives ont
# échoué là-dessus — jamais sur l'application elle-même.
#
# Joué par `postStartCommand` : à chaque allumage de l'espace, y compris après
# la mise en veille automatique de trente minutes. Ne doit donc PAS bloquer,
# sinon l'éditeur reste en attente.
set -uo pipefail

CD="$(cd "$(dirname "$0")/.." && pwd)"
JOURNAL=/tmp/essai.log

# Un serveur resté en écoute après une veille ferait échouer le suivant sur
# « port déjà pris » — message sans rapport avec la cause, et impossible à
# corriger sans terminal.
#
# Les crochets autour du « n » sont indispensables : `pkill -f` compare la ligne
# de commande ENTIÈRE de chaque processus, y compris celle du shell qui joue ce
# script. Sans eux, le motif se trouve lui-même et le script se tue avant
# d'avoir rien démarré. Constaté en le lançant, pas en le relisant.
pkill -f "[n]ext dev" 2>/dev/null || true

cd "$CD" || exit 0

# `setsid` détache le serveur du processus de démarrage : sans cela, l'éditeur
# le tue en même temps que la commande de démarrage, et l'adresse ne répond
# jamais.
setsid nohup npm run essai > "$JOURNAL" 2>&1 < /dev/null &

echo "→ Atlas démarre tout seul. L'adresse s'ouvrira dans une minute ou deux."
echo "   Journal : $JOURNAL"
exit 0
