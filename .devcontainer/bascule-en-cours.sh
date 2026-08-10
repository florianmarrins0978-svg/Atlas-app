#!/usr/bin/env bash
# Le drapeau de la BASCULE — et le seul endroit qui en connaisse le chemin.
#
# ─────────────────────────────────────────────────────────────────────────────
# **La panne qu'il évite, vue chez le patron le 10 août 2026 :**
#
#     Error: listen EADDRINUSE: address already in use 0.0.0.0:3000
#     errno: -98, syscall: 'listen'
#
# Elle survient au moment exact où le banc bascule du mode développement vers la
# version bâtie. Le mécanisme, et il tient à quinze secondes :
#
#   1. `banc.mjs` tue son `next dev` pour libérer le port ;
#   2. pendant ce battement, plus rien n'écoute et aucun processus `next` ne
#      tourne — c'est-à-dire, mot pour mot, les DEUX conditions que `veiller.sh`
#      exige pour conclure « le serveur est mort » ;
#   3. le veilleur lance donc `npm run banc`. Un SECOND banc démarre, prend le
#      port en mode développement ;
#   4. le `next start` du premier tombe sur EADDRINUSE et meurt.
#
# Le veilleur ne peut pas distinguer « le serveur est mort » d'« on est en train
# de le remplacer » : les deux se ressemblent trait pour trait. Il faut donc le
# lui DIRE. C'est tout ce que fait ce fichier.
#
# **Le drapeau EXPIRE, et c'est essentiel.** Un banc tué au mauvais moment
# laisserait sinon un drapeau éternel, et le veilleur — dont l'existence même
# répare le 404 du 9 août — ne relèverait plus jamais rien, sans un mot. Passé
# le délai, le drapeau ne vaut plus rien : on préfère une bascule bousculée à un
# veilleur muet.
#
# Trois usages, et le chemin n'est écrit qu'ici :
#   bascule-en-cours.sh            → sort 0 si une bascule est en cours
#   bascule-en-cours.sh --debut    → pose le drapeau
#   bascule-en-cours.sh --fin      → le retire
set -uo pipefail

DRAPEAU="${ATLAS_DRAPEAU_BASCULE:-/tmp/atlas-bascule}"
# Large : une construction se termine vite, mais `next start` peut mettre du
# temps à écouter sur un disque lent. Trois minutes couvrent le pire cas observé
# (47 s pour un seul écran chez le patron) sans jamais endormir le veilleur
# durablement.
DELAI="${ATLAS_DELAI_BASCULE:-180}"

case "${1:-}" in
  --debut)
    date +%s > "$DRAPEAU" 2>/dev/null || true
    exit 0
    ;;
  --fin)
    rm -f "$DRAPEAU" 2>/dev/null || true
    exit 0
    ;;
esac

[ -f "$DRAPEAU" ] || exit 1

POSE="$(cat "$DRAPEAU" 2>/dev/null || echo "")"
# Contenu illisible : on considère qu'il n'y a pas de bascule. **Toujours
# retomber du côté du veilleur actif** — un drapeau qu'on ne sait pas lire ne
# doit jamais valoir « ne fais rien ».
case "$POSE" in
  ''|*[!0-9]*) exit 1 ;;
esac

MAINTENANT="$(date +%s)"
AGE=$((MAINTENANT - POSE))
if [ "$AGE" -ge 0 ] && [ "$AGE" -lt "$DELAI" ]; then
  exit 0
fi
exit 1
