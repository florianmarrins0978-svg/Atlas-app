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

# **Le chemin de secours pour les clés d'IA — et il est créé d'avance.**
#
# Un secret d'espace de travail n'entre dans le conteneur qu'après une
# reconstruction : geste introuvable sur un téléphone. Un fichier `.env.local`
# à la racine, lui, est pris en compte au prochain allumage, sans rien
# reconstruire.
#
# Il est **écrit ici, vide, dès le premier démarrage**, parce que « créez un
# fichier nommé .env.local à la racine du projet » n'a pas été compris — et
# c'était une consigne mal posée : demander de créer un fichier caché, au bon
# endroit, avec le bon nom, sur six pouces. Le fichier existe donc déjà ; il
# n'y a qu'à coller une clé après le signe égal.
#
# Jamais réécrit s'il existe : une clé déjà collée ne doit pas disparaître à
# l'allumage suivant. Ignoré par git (`.gitignore` : `.env*`) — une clé ne se
# versionne pas.
if [ ! -f "$CD/.env.local" ]; then
  cat > "$CD/.env.local" <<'MODELE'
# Collez vos clés après le signe = , puis rechargez la page de l'éditeur.
# Rien d'autre à faire : Atlas les prend en compte au démarrage suivant.
#
# Sans clé, la dictée est recopiée mot à mot au lieu d'être comprise.
# Ce fichier n'est jamais envoyé sur GitHub.

# Pour que votre voix devienne du texte :
OPENAI_API_KEY=

# Pour que ce texte devienne un devis structuré :
ANTHROPIC_API_KEY=
MODELE
fi

# Chargé ICI plutôt que laissé à Next.js seul : le bandeau ci-dessous et
# `npm run verifier:ia` doivent voir exactement ce que voit l'application.
#
# **Jamais par `. .env.local`**, qui aurait écrasé avec du vide les clés déjà
# présentes dans le conteneur — le modèle écrit juste au-dessus aurait alors
# causé la panne qu'il répare. Le tri vit dans `charger-cles.sh`, éprouvé par
# `scripts/test-charger-cles.ts`.
while IFS= read -r ligne; do
  [ -n "$ligne" ] && export "${ligne?}"
done < <(bash "$(dirname "$0")/charger-cles.sh" "$CD/.env.local")

# **Un conteneur ancien ne doit pas annuler des clés fraîchement posées.**
# La décision — et la raison pour laquelle ce n'est pas une entorse à la règle
# « la variable explicite l'emporte » — vit dans `reglage-ia.sh`, qui est
# éprouvé par `scripts/test-reglage-ia-espace.ts`.
ETAT_IA="$(bash "$(dirname "$0")/reglage-ia.sh")"
if [ "$ETAT_IA" = "neutralise" ]; then
  unset LLM_PROVIDER TRANSCRIPTION_PROVIDER
fi

# Récupérer le code neuf, à chaque allumage. La logique — et ses prudences —
# vit dans `mettre-a-jour.sh`, qui est éprouvé par
# `scripts/test-mise-a-jour-espace.ts` : enfouie ici, elle n'aurait jamais été
# vue échouer.
MISE_A_JOUR="$(bash "$(dirname "$0")/mettre-a-jour.sh" "$CD")"

# Les dépendances et la base doivent suivre le code, sinon la mise à jour
# produit une panne au lieu d'un correctif : un écran qui plante sur une colonne
# absente est pire que l'ancienne version.
if [ "$MISE_A_JOUR" = "faite" ]; then
  npm ci --silent >> "$JOURNAL" 2>&1 || npm install --silent >> "$JOURNAL" 2>&1 || true

  # **Les migrations passent par leur propre script, sous le rôle
  # PROPRIÉTAIRE.** Lancées ici avec la variable ambiante, elles tournaient sous
  # `atlas_app` — qui n'a aucun droit de créer une table — et le `|| true`
  # avalait l'échec. Le code neuf arrivait sur une base vieille, et l'écran qui
  # touchait une table absente tombait sans que rien ne l'ait annoncé.
  MIGRATIONS="$(bash "$(dirname "$0")/appliquer-migrations.sh" "$CD")"
  echo "migrations : $MIGRATIONS" >> "$JOURNAL"

  # **Rejouer ce script dans sa version neuve.**
  #
  # Sans cela, un démarrage qui récupère du code neuf continue d'exécuter
  # l'ANCIEN script : le correctif n'entre en vigueur qu'au démarrage suivant.
  # Le patron aurait dû redémarrer deux fois pour voir un changement livré une
  # fois — et n'aurait eu aucun moyen de le deviner. C'est la même famille de
  # défaut que « l'espace ne se met pas à jour tout seul » (`ARCHITECTURE.md`
  # §24), déplacée d'un cran.
  #
  # Le garde-fou n'est pas optionnel : sans lui, un script qui se relance
  # pourrait le faire sans fin. Au second passage la mise à jour répond « à
  # jour », mais on ne s'en remet pas à cela — on s'en remet à la variable.
  if [ "${ATLAS_DEMARRAGE_RELANCE:-}" != "1" ]; then
    export ATLAS_DEMARRAGE_RELANCE=1
    # **Ce que le premier passage a constaté doit survivre à l'`exec`.** Voir
    # juste en dessous : sans ces deux variables, l'avertissement le plus
    # important du démarrage se perdait à chaque vraie mise à jour.
    export ATLAS_MISE_A_JOUR="$MISE_A_JOUR"
    export ATLAS_MIGRATIONS="$MIGRATIONS"
    exec bash "$0" "$@"
  fi
fi

# **L'`exec` effaçait ce qu'il fallait justement dire, et c'est un défaut trouvé
# en jouant ce script pour de bon, le 9 août 2026.**
#
# Le second passage recalcule tout : la mise à jour répond alors « à jour » — le
# code vient d'être tiré — et `MIGRATIONS` n'existe même plus, puisque le bloc
# ci-dessus est sauté. Conséquences, toutes les deux invisibles :
#
#   1. après une vraie mise à jour, le démarrage affichait « Déjà à jour. » —
#      exactement le contraire de ce qui venait de se passer, sur un banc dont
#      l'historique est fait de « je réessaie une version d'avant sans le
#      savoir » (`ARCHITECTURE.md` §24) ;
#   2. **l'avertissement « LA BASE N'A PAS SUIVI LE CODE » ne pouvait PLUS
#      JAMAIS s'afficher.** Il ne se déclenche qu'après une mise à jour — et
#      c'est précisément le cas où l'`exec` effaçait la variable. Le correctif
#      du matin même était donc mort-né, sans qu'aucun contrôle ne le voie.
MISE_A_JOUR="${ATLAS_MISE_A_JOUR:-$MISE_A_JOUR}"
MIGRATIONS="${ATLAS_MIGRATIONS:-${MIGRATIONS:-}}"

# La version exécutée, transmise à l'application pour qu'elle l'affiche.
# Le format est fait pour être lu sur une capture d'écran, pas par une machine.
ATLAS_VERSION="$(git log -1 --date=format:'%d/%m/%Y %H:%M' --format='%cd · %h' 2>/dev/null || echo 'inconnue')"
export ATLAS_VERSION

# `setsid` détache le veilleur du processus de démarrage : sans cela, l'éditeur
# le tue en même temps que la commande de démarrage, et l'adresse ne répond
# jamais.
#
# **Un veilleur plutôt qu'un serveur, depuis le 9 août 2026.** Le serveur était
# lancé ici une fois, et une seule. Quand il mourait — et il est mort —, plus
# rien ne le relevait : le patron a lu « HTTP ERROR 404 », qui sur cette adresse
# veut dire « plus rien n'écoute », et il n'avait aucun moyen de le savoir.
# `veiller.sh` regarde toutes les quinze secondes et relance ce qu'il faut.
setsid nohup bash "$(dirname "$0")/veiller.sh" "$CD" > /dev/null 2>&1 < /dev/null &

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
echo "  Version exécutée : $ATLAS_VERSION"

# **L'IA est-elle branchée ?** Écrit ici parce que la question s'est posée un
# jour où rien ne pouvait y répondre : les clés étaient enregistrées, elles
# n'entraient pas dans le conteneur, et le seul symptôme était un devis recopié
# mot à mot. Lu au démarrage, ce constat évite d'aller chercher ailleurs.
#
# Volontairement en shell, à partir des variables réellement présentes DANS le
# conteneur : c'est exactement ce que l'application lira. Un contrôle qui
# interrogerait autre chose ne prouverait rien.
case "$ETAT_IA" in
  sans-cle)
    echo "  IA : mode déterministe — votre dictée sera recopiée mot à mot."
    echo "       Pour la brancher : ouvrez le fichier .env.local à la racine,"
    echo "       collez vos clés après le signe = , et rechargez cette page."
    ;;
  coupee)
    echo "  IA : coupée volontairement (LLM_PROVIDER=dev), clés en place."
    ;;
  *)
    if [ -n "${ANTHROPIC_API_KEY:-}" ] && [ -n "${OPENAI_API_KEY:-}" ]; then
      echo "  IA : branchée — OpenAI écoute la dictée, Anthropic écrit le devis."
    elif [ -n "${ANTHROPIC_API_KEY:-}" ]; then
      echo "  IA : Anthropic écrit le devis ; la dictée n'est PAS écoutée."
      echo "       Il manque OPENAI_API_KEY pour cela."
    else
      echo "  IA : branchée sur OpenAI (écoute la dictée et écrit le devis)."
    fi
    [ "$ETAT_IA" = "neutralise" ] && echo "       (réglage figé d'un ancien conteneur neutralisé)"
    ;;
esac
case "$MISE_A_JOUR" in
  faite) echo "  Le code a été mis à jour au démarrage." ;;
  impossible*) echo "  ⚠ MISE À JOUR $MISE_A_JOUR" ;;
  *) echo "  Déjà à jour." ;;
esac

# **Une base restée en arrière se DIT, en toutes lettres.** C'est le défaut du
# 9 août 2026 : les migrations échouaient sous le mauvais rôle, l'échec était
# avalé, et le patron ouvrait un écran qui tombait sur une table absente sans
# rien pour le relier à la mise à jour qu'il venait de faire.
case "${MIGRATIONS:-}" in
  échec*)
    echo
    echo "  ⚠ LA BASE N'A PAS SUIVI LE CODE — $MIGRATIONS"
    echo "    Les écrans qui touchent une table neuve vont tomber."
    echo "    Ne cherchez pas ailleurs : c'est ça, et c'est réparable."
    ;;
esac
echo "──────────────────────────────────────────────"
echo "  Ça prend une minute ou deux, puis Atlas compile"
echo "  ses écrans d'avance : les premières ouvertures"
echo "  ne feront donc plus attendre. Journal : $JOURNAL"
echo
exit 0
