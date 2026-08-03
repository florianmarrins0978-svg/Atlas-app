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

# L'adresse exacte, écrite par la machine plutôt que devinée par le patron.
#
# Pourquoi : le mode d'emploi donnait « https://<nom-de-l-espace>-3000.app.github.dev »
# et il a répondu « je comprends pas ce que je dois faire avec ça ». Il avait
# raison — on lui demandait de recomposer une adresse à partir d'un modèle, au
# doigt, sur six pouces, alors que l'espace connaît son propre nom. Un mode
# d'emploi qui laisse un blanc à remplir n'est pas un mode d'emploi.
#
# Les deux variables sont posées par Codespaces. Absentes ailleurs (essai en
# local, autre machine) : on ne raconte alors rien plutôt que d'inventer une
# adresse fausse.
ADRESSE=""
if [ -n "${CODESPACE_NAME:-}" ] && [ -n "${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:-}" ]; then
  ADRESSE="https://${CODESPACE_NAME}-3000.${GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}"
  # Déposée dans un fichier aussi : le terminal défile et se perd, ce fichier
  # non. `docs/ESSAYER.md` y renvoie.
  printf '%s\n' "$ADRESSE" > /tmp/adresse-atlas.txt 2>/dev/null || true
fi

echo
echo "──────────────────────────────────────────────"
if [ -n "$ADRESSE" ]; then
  echo "  Atlas démarre tout seul. Votre adresse :"
  echo
  echo "  $ADRESSE"
  echo
  echo "  Mettez-la en favori : elle ne change pas tant"
  echo "  que cet espace de travail existe, et elle"
  echo "  s'ouvre sans passer par cet éditeur."
else
  echo "  Atlas démarre tout seul, sur le port 3000."
fi
echo "──────────────────────────────────────────────"
echo "  Ça prend une minute ou deux. Journal : $JOURNAL"
echo
exit 0
