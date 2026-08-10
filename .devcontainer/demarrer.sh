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
# **Le motif doit couvrir `next-server`, et c'est la cause première du 404 du
# 9 août 2026.** `npx next dev` n'est qu'une pile d'enveloppes ; le processus qui
# écoute vraiment se renomme `next-server (v16.2.12)`. L'ancien motif tuait donc
# les enveloppes et laissait le vrai serveur vivant, orphelin, **accroché au
# port 3000** : le suivant ne pouvait plus s'y attacher, et l'orphelin servait un
# cache périmé — toutes les pages en 404. Reproduit sur cette machine, en
# regardant la liste des processus, pas en relisant le script.
pkill -f "[n]ext(-server| dev| start)" 2>/dev/null || true
# Laisser le port se libérer : tuer n'est pas instantané, et se précipiter
# reproduirait la panne qu'on vient d'éviter.
sleep 1

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

# **Le banc sert une version BÂTIE, et il faut le DÉCLARER.**
#
# `next start` impose `NODE_ENV=production` : sans ce profil, la configuration
# refuserait l'IA simulée et le stockage local — les deux seules choses qu'un
# banc ne peut pas avoir — et le proxy éteindrait l'alignement d'origine, ce qui
# ramènerait « Invalid Server Actions request. » à la connexion.
#
# Posé ICI plutôt que dans `docker-compose.yml` : une variable déclarée là
# n'existe pas dans un espace créé avant qu'elle n'y soit écrite, et deux
# correctifs de suite sont restés inertes pour ce motif. Ce fichier, lui,
# descend avec le code.
export ATLAS_PROFIL=banc

# La version exécutée, transmise à l'application pour qu'elle l'affiche.
# Le format est fait pour être lu sur une capture d'écran, pas par une machine.
ATLAS_VERSION="$(git log -1 --date=format:'%d/%m/%Y %H:%M' --format='%cd · %h' 2>/dev/null || echo 'inconnue')"
export ATLAS_VERSION

# Pose le veilleur, qui monte le serveur et le relève s'il tombe.
# `setsid` le détache du processus de démarrage : sans cela, l'éditeur le tue en
# même temps que la commande de démarrage, et l'adresse ne répond jamais.
# Le veilleur refuse lui-même de se dédoubler (verrou), donc appeler deux fois
# est sans conséquence.
lancer_veilleur() {
  setsid nohup bash "$(dirname "$0")/veiller.sh" "$CD" > /dev/null 2>&1 < /dev/null &
}

# ─────────────────────────────────────────────────────────────────────────────
# **LE SERVEUR D'ABORD, LA MISE À JOUR ENSUITE — et c'est le correctif du
# 9 août 2026, au soir.**
#
# Ce que le patron a vécu : son journal s'arrêtait net sur `migrations : faites`,
# et plus rien. `curl localhost:3000` ne répondait pas. L'application n'était pas
# lente, pas cassée : **elle n'avait jamais été lancée.** Il a passé la soirée
# devant des pages blanches, des 502 et des 404 en croyant à des pannes
# d'application.
#
# La cause est dans l'ordre des opérations. Ce script faisait, dans cet ordre :
# mise à jour, `npm ci`, migrations, **puis seulement** le lancement. Or il est
# joué par `postStartCommand`, que l'environnement peut interrompre — un délai
# dépassé pendant un `npm ci` de plusieurs minutes suffit. Tout ce qui vient
# après meurt avec lui, **et le lancement venait en dernier.**
#
# Désormais le veilleur est posé **en premier**, avant toute opération longue. Il
# monte le serveur avec le code présent sur le disque — celui d'hier, s'il le
# faut. Si la mise à jour aboutit ensuite, on remplace veilleur et serveur par
# leurs versions neuves. Quoi qu'il arrive après cette ligne, **le patron a une
# application qui répond.**
#
# Ce que cela remplace : l'`exec bash "$0"` qui rejouait ce script dans sa
# version neuve (`ARCHITECTURE.md` §24). Il n'existe plus, et c'est délibéré —
# c'était l'endroit précis où le démarrage mourait. Ce qui compte vraiment est
# relu depuis le disque au redémarrage du veilleur : `veiller.sh`, `banc.mjs`,
# et l'application elle-même. Seule la fin de CE fichier reste, pour un
# allumage, dans sa version d'avant — un bandeau, contre une application qui
# démarre.
lancer_veilleur

# Récupérer le code neuf, à chaque allumage. La logique — et ses prudences —
# vit dans `mettre-a-jour.sh`, qui est éprouvé par
# `scripts/test-mise-a-jour-espace.ts` : enfouie ici, elle n'aurait jamais été
# vue échouer.
MISE_A_JOUR="$(bash "$(dirname "$0")/mettre-a-jour.sh" "$CD")"
MIGRATIONS=""

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

  # Le code a changé sous le serveur qui tourne : on remplace le veilleur ET le
  # serveur par leurs versions neuves. C'est ce qui rend l'`exec` inutile.
  echo "$(date '+%d/%m %H:%M:%S') — code neuf : on remplace veilleur et serveur" >> "$JOURNAL"
  pkill -f "[v]eiller.sh" 2>/dev/null || true
  rm -f /tmp/atlas-veilleur.pid
  pkill -f "[n]ext(-server| dev| start)" 2>/dev/null || true
  sleep 1
  lancer_veilleur
fi

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
# **Le banc se diagnostique tout seul, sans qu'on le lui demande.**
#
# Le 10 août 2026, le patron a passé une soirée entre une page blanche, un
# téléchargement proposé par deux navigateurs différents, et des messages qui
# accusaient tour à tour la base, le réseau et sa session. Aucun n'avait raison,
# et la seule réponse — ce que reçoit VRAIMENT son téléphone — n'était joignable
# que d'ici : le réseau de l'agent refuse `*.app.github.dev`.
#
# Ce contrôle part donc en arrière-plan, attend que le serveur réponde, puis
# écrit son verdict dans un fichier. Détaché et sans conséquence : il ne modifie
# rien, et son échec ne peut pas empêcher le banc de servir.
VERDICT=/tmp/verdict-banc.txt
setsid nohup bash -c "
  for _ in \$(seq 1 60); do
    curl -sf -o /dev/null --max-time 5 http://127.0.0.1:3000/api/health/live && break
    sleep 10
  done
  cd '$CD' && node scripts/diagnostiquer-banc.mjs > '$VERDICT' 2>&1
" > /dev/null 2>&1 < /dev/null &

echo "──────────────────────────────────────────────"
echo "  Si l'adresse ne s'ouvre pas, une seule commande"
echo "  vous dira pourquoi — elle est déjà en train de"
echo "  chercher :"
echo
echo "      cat $VERDICT"
echo "──────────────────────────────────────────────"
echo "  Atlas se BÂTIT au démarrage : deux à cinq minutes,"
echo "  une seule fois. Ensuite chaque écran s'ouvre du"
echo "  premier coup, sans attente. Journal : $JOURNAL"
echo
exit 0
